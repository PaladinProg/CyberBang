import type { Server, Socket } from 'socket.io';
import { prepareGame } from '../game/setup.js';
import { GAME_EVENTS, StartGamePayload } from '@cyberbang/shared/types';
import {
  CreateRoomPayload,
  JoinRoomPayload,
  LeaveRoomPayload,
  RoomStatus,
  SOCKET_EVENTS,
  SocketErrorCode,
} from '@cyberbang/shared/types';
import {
  makeSocketError,
  normalizeMaxPlayers,
  RoomStore,
  validateNickname,
  validateRoomName,
} from './store.js';
import { startTurn, endTurn, playCard } from '../game/engine.js';
import { GAME_EVENTS, StartGamePayload, PlayCardPayload, PickMarketCardPayload, } from '@cyberbang/shared/types'; // Нужно добавить PlayCardPayload в types

/** Рассылка списка комнат всем; актор получает персональный yourRoomId */
function notifyRoomUpdate(
  io: Server,
  store: RoomStore,
  actor?: Socket,
  yourRoomId?: string | null,
): void {
  const rooms = store.getSummaries();

  if (actor) {
    actor.emit(SOCKET_EVENTS.ROOM_UPDATE, { rooms, yourRoomId });
    actor.broadcast.emit(SOCKET_EVENTS.ROOM_UPDATE, { rooms });
  } else {
    io.emit(SOCKET_EVENTS.ROOM_UPDATE, { rooms });
  }
}

/** Регистрация обработчиков лобби на Socket.IO */
export function registerLobbyHandlers(io: Server, store: RoomStore): void {
  io.on('connection', (socket: Socket) => {
    socket.emit(SOCKET_EVENTS.ROOM_UPDATE, {
      rooms: store.getSummaries(),
      yourRoomId: store.getSession(socket.id)?.roomId ?? null,
    });

    socket.on(SOCKET_EVENTS.CREATE_ROOM, (payload: CreateRoomPayload) => {
      handleCreateRoom(io, socket, store, payload);
    });

    socket.on(SOCKET_EVENTS.JOIN_ROOM, (payload: JoinRoomPayload) => {
      handleJoinRoom(io, socket, store, payload);
    });

    socket.on(SOCKET_EVENTS.LEAVE_ROOM, (payload: LeaveRoomPayload) => {
      handleLeaveRoom(io, socket, store, payload);
    });

    socket.on(GAME_EVENTS.START_GAME, (payload: StartGamePayload) => {
      handleStartGame(io, socket, store, payload);
    });

    socket.on(GAME_EVENTS.REQUEST_STATE, (payload?: { roomId: string }) => {
      // Берем roomId из payload или из сессии сокета
      const roomId = payload?.roomId || store.getSession(socket.id)?.roomId;
      console.log(`[Server] REQUEST_STATE received for room: ${roomId}, socket: ${socket.id}`);
      
      if (roomId) {
        handleRequestState(io, socket, store, roomId);
      } else {
        console.log('[Server] REQUEST_STATE skipped: no roomId found');
      }
    });

    socket.on('disconnect', () => {
      store.handleDisconnect(socket.id);
      notifyRoomUpdate(io, store);
    });
   
    socket.on('endTurn', () => {
      handleEndTurn(io, socket, store);
    });
    
    // Обработчик розыгрыша карты
    socket.on('playCard', (payload: PlayCardPayload) => {
      handlePlayCard(io, socket, store, payload);
    });

    socket.on(GAME_EVENTS.PICK_MARKET_CARD, (payload: PickMarketCardPayload) => {
      handlePickMarketCard(io, socket, store, payload);
    });

    socket.on('reconnectToRoom', (payload: { roomId: string; nickname: string }) => {
      handleReconnectToRoom(io, socket, store, payload);
    });

    socket.on('discardSocialEngineeringCard', (payload: { cardId: string; location: string }) => {
      handleDiscardSocialEngineeringCard(io, socket, store, payload);
    });
  });
}

function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

function emitError(socket: Socket, code: SocketErrorCode): void {
  socket.emit(SOCKET_EVENTS.SOCKET_ERROR, makeSocketError(code));
}

function handleCreateRoom(
  io: Server,
  socket: Socket,
  store: RoomStore,
  payload: CreateRoomPayload,
): void {
  const nickname = payload.nickname?.trim() ?? '';
  const roomName = payload.roomName?.trim() ?? '';

  if (!validateNickname(nickname)) {
    emitError(socket, SocketErrorCode.INVALID_NICKNAME);
    return;
  }
  if (!validateRoomName(roomName)) {
    emitError(socket, SocketErrorCode.INVALID_ROOM_NAME);
    return;
  }

  const maxPlayers = normalizeMaxPlayers(payload.maxPlayers);
  if (maxPlayers < 4 || maxPlayers > 7) {
    emitError(socket, SocketErrorCode.INVALID_MAX_PLAYERS);
    return;
  }

  const session = store.getSession(socket.id);
  if (session?.roomId) {
    emitError(socket, SocketErrorCode.ALREADY_IN_ROOM);
    return;
  }

  store.upsertSession(socket.id, nickname);

  const roomId = crypto.randomUUID();
  store.createRoom(roomId, roomName, socket.id, maxPlayers);

  void socket.join(roomChannel(roomId));
  notifyRoomUpdate(io, store, socket, roomId);
}

function handleStartGame(
  io: Server,
  socket: Socket,
  store: RoomStore,
  payload: StartGamePayload
) {
  const session = store.getSession(socket.id);
  const room = store.getRoom(payload.roomId);

  // Валидация: только хост может начать игру
  if (!session || !room || room.hostId !== socket.id) {
    emitError(socket, SocketErrorCode.NOT_HOST); // Добавь этот код ошибки в types
    return;
  }

  // Валидация: минимум 4 игрока
  if (room.playerIds.length < 4) {
    emitError(socket, SocketErrorCode.NOT_ENOUGH_PLAYERS); // Добавь этот код
    return;
  }

  try {
    const gameState = prepareGame(room, store.sessions);
    room.game = gameState;
    room.status = 'PLAYING' as any; // RoomStatus.PLAYING

    // Заполняем никнеймы в gameState из сессий
    gameState.players.forEach(p => {
      const sess = store.sessions.get(p.id);
      if (sess) p.nickname = sess.nickname;
    });

    // Оповещаем всех в комнате
    io.to(`room:${room.id}`).emit(GAME_EVENTS.GAME_STARTED, { gameState });
    
    // Обновляем список комнат (статус changed)
    notifyRoomUpdate(io, store);
  } catch (err) {
    console.error('Game setup failed:', err);
    emitError(socket, SocketErrorCode.INTERNAL_ERROR);
  }
}

function handleJoinRoom(
  io: Server,
  socket: Socket,
  store: RoomStore,
  payload: JoinRoomPayload,
): void {
  const nickname = payload.nickname?.trim() ?? '';
  const roomId = payload.roomId;

  if (!validateNickname(nickname)) {
    emitError(socket, SocketErrorCode.INVALID_NICKNAME);
    return;
  }

  const room = store.getRoom(roomId);
  if (!room) {
    emitError(socket, SocketErrorCode.ROOM_NOT_FOUND);
    return;
  }

  if (room.status !== RoomStatus.WAITING) {
    emitError(socket, SocketErrorCode.GAME_ALREADY_STARTED);
    return;
  }

  if (room.playerIds.length >= room.maxPlayers && !room.playerIds.includes(socket.id)) {
    emitError(socket, SocketErrorCode.ROOM_FULL);
    return;
  }

  const session = store.getSession(socket.id);
  if (session?.roomId && session.roomId !== roomId) {
    emitError(socket, SocketErrorCode.ALREADY_IN_ROOM);
    return;
  }

  store.upsertSession(socket.id, nickname);
  store.addPlayer(roomId, socket.id);

  void socket.join(roomChannel(roomId));
  notifyRoomUpdate(io, store, socket, roomId);
}

function handleLeaveRoom(
  io: Server,
  socket: Socket,
  store: RoomStore,
  payload: LeaveRoomPayload,
): void {
  const session = store.getSession(socket.id);
  if (!session?.roomId) {
    emitError(socket, SocketErrorCode.NOT_IN_ROOM);
    return;
  }

  const roomId = payload.roomId || session.roomId;
  const room = store.getRoom(roomId);
  if (!room) {
    emitError(socket, SocketErrorCode.ROOM_NOT_FOUND);
    return;
  }

  if (!room.playerIds.includes(socket.id)) {
    emitError(socket, SocketErrorCode.NOT_IN_ROOM);
    return;
  }

  store.removePlayer(roomId, socket.id);
  void socket.leave(roomChannel(roomId));
  notifyRoomUpdate(io, store, socket, null);
}

function handleRequestState(io: Server, socket: Socket, store: RoomStore, roomId: string) {
  const session = store.getSession(socket.id);
  
  // Если игрок не в комнате или комната не найдена — ничего не делаем
  if (!session?.roomId) return;
  
  const room = store.getRoom(session.roomId);
  if (!room || !room.game) return;

  // Отправляем текущее состояние игры конкретному игроку
  // Используем то же событие GAME_STARTED или специальное, но для простоты можно переиспользовать логику синхронизации
  socket.emit(GAME_EVENTS.GAME_STARTED, { gameState: room.game });
  
  // Также обновляем его статус в лобби (чтобы он видел, что он в комнате PLAYING)
  const summaries = store.getSummaries();
  socket.emit(SOCKET_EVENTS.ROOM_UPDATE, { 
    rooms: summaries, 
    yourRoomId: session.roomId 
  });
}

function handleEndTurn(io: Server, socket: Socket, store: RoomStore) {
  const session = store.getSession(socket.id);
  if (!session?.roomId) return;
  
  const room = store.getRoom(session.roomId);
  if (!room?.game) return;

  // Проверяем, что это ход текущего игрока
  if (room.game.currentTurnPlayerId !== socket.id) return;

  endTurn(room.game);
  
  // Рассылаем обновленное состояние всем в комнате
  const safeGameState = {
    ...room.game,
    pendingAttacks: Object.fromEntries(room.game.pendingAttacks || [])
  };
  io.to(`room:${room.id}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { gameState: room.game });
}

function handlePlayCard(io: Server, socket: Socket, store: RoomStore, payload: PlayCardPayload) {
  const session = store.getSession(socket.id);
  if (!session?.roomId) return;
  
  const room = store.getRoom(session.roomId);
  if (!room?.game) return;

  const result = playCard(room.game, socket.id, payload.cardId, payload.targetId, io);
  
  if (result.success) {
    // Отправляем обновление состояния
    const safeGameState = {
      ...room.game,
      pendingAttacks: Object.fromEntries(room.game.pendingAttacks || [])
    };
    io.to(`room:${room.id}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { gameState: room.game });
  } else {
    // Отправляем ошибку конкретному игроку
    socket.emit(SOCKET_EVENTS.SOCKET_ERROR, { code: 'INVALID_ACTION', message: result.message });
  }
}

function handleReconnectToRoom(
  io: Server,
  socket: Socket,
  store: RoomStore,
  payload: { roomId: string; nickname: string }
) {
  const { roomId, nickname } = payload;
  console.log(`[Server] Reconnection attempt: ${nickname} -> ${roomId}`);

  const room = store.getRoom(roomId);
  
  if (!room) {
    console.log(`[Server] Room not found: ${roomId}`);
    socket.emit('reconnectResult', { success: false, reason: 'Room not found' });
    return;
  }

  if (room.status !== 'PLAYING' || !room.game) {
    console.log(`[Server] Game not active in room: ${roomId}`);
    socket.emit('reconnectResult', { success: false, reason: 'Game not active' });
    return;
  }
  // Проверяем, был ли игрок в этой комнате (по никнейму)
  const playerInGame = room.game.players.find(
    p => p.nickname === nickname && p.isAlive
  );

  if (!playerInGame) {
    console.log(`[Server] Player not found in game: ${nickname}`);
    socket.emit('reconnectResult', { success: false, reason: 'Player not found' });
    return;
  }

  // Обновляем сессию и добавляем в комнату
  store.upsertSession(socket.id, nickname);
  if (!room.playerIds.includes(socket.id)) {
    store.addPlayer(roomId, socket.id);
  }
  
  void socket.join(`room:${roomId}`);

  // Отправляем состояние игры
  const safeGameState = {
    ...room.game,
    pendingAttacks: Object.fromEntries(room.game.pendingAttacks || [])
  };

  socket.emit('reconnectResult', {
    success: true,
    gameState: safeGameState,
  });

  console.log(`[Server] ✅ Player ${nickname} reconnected to room ${roomId}`);
}

// ФУНКЦИЯ ОБРАБОТКИ ВЫБОРА КАРТЫ С РЫНКА
function handlePickMarketCard(
  io: Server, 
  socket: Socket, 
  store: RoomStore, 
  payload: PickMarketCardPayload
) {
  const session = store.getSession(socket.id);
  if (!session?.roomId) return;
  
  const room = store.getRoom(session.roomId);
  if (!room?.game) return;

  const game = room.game;

  // 1. Проверка: фаза рынка?
  // Примечание: TurnPhase.MARKET должен быть добавлен в enum TurnPhase в shared/types
  if ((game as any).turnPhase !== 'MARKET') {
    console.warn(`[Server] pickMarketCard ignored: not in MARKET phase (current: ${(game as any).turnPhase})`);
    return;
  }
  
  // 2. Проверка: мой ли черёд?
  const alivePlayers = game.players.filter(p => p.isAlive);
  const currentPickerIndex = (game as any).marketPickerIndex;
  
  if (currentPickerIndex === undefined || currentPickerIndex >= alivePlayers.length) {
    console.error('[Server] Invalid marketPickerIndex');
    return;
  }

  const currentPickerId = alivePlayers[currentPickerIndex].id;
  
  if (socket.id !== currentPickerId) {
    socket.emit(SOCKET_EVENTS.SOCKET_ERROR, { 
      code: 'INVALID_ACTION', 
      message: 'Сейчас не ваш выбор!' 
    });
    return;
  }

  // 3. Ищем карту на рынке
  const marketCards = (game as any).marketCards || [];
  const cardIndex = marketCards.findIndex((c: any) => c.id === payload.cardId);
  
  if (cardIndex === -1) {
    socket.emit(SOCKET_EVENTS.SOCKET_ERROR, { 
      code: 'INVALID_ACTION', 
      message: 'Карта больше недоступна на рынке' 
    });
    return;
  }

  // 4. Забираем карту
  const card = marketCards.splice(cardIndex, 1)[0];
  const player = game.players.find(p => p.id === socket.id);
  
  if (player) {
    player.hand.push(card);
    console.log(`[Engine] ${player.nickname} picked ${card.type} from Black Market`);
  }

  // 5. Следующий игрок
  (game as any).marketPickerIndex = (currentPickerIndex + 1) % alivePlayers.length;

  // 6. Проверяем, закончился ли рынок
  if (marketCards.length === 0) {
    endMarketPhase(game, io, store);
  } else {
    // Если карты есть, просто обновляем состояние
    io.to(`room:${room.id}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { gameState: game });
  }
}

// Вспомогательная функция завершения фазы рынка
function endMarketPhase(game: any, io: Server, store: RoomStore) {
  console.log('[Engine] Black Market closed');
  
  // Очищаем состояние рынка
  game.marketCards = [];
  game.marketPickerIndex = undefined;
  
  // Возвращаем ход инициатору в фазу EXECUTE
  const initiatorId = game.marketInitiatorId;
  const initiator = game.players.find((p: any) => p.id === initiatorId);
  
  if (initiator && initiator.isAlive) {
    game.currentTurnPlayerId = initiator.id;
    game.turnPhase = 'EXECUTE'; // Используем строку, т.к. enum может быть не импортирован здесь напрямую
  } else {
    // Если инициатор мертв, передаем ход дальше
    // Для простоты MVP можно просто передать следующему живому
    const alivePlayers = game.players.filter((p: any) => p.isAlive);
    if (alivePlayers.length > 0) {
       // Находим индекс текущего (мертвого или отсутствующего) и берем следующего
       // Или просто берем первого живого для надежности
       game.currentTurnPlayerId = alivePlayers[0].id;
       game.turnPhase = 'EXECUTE';
    }
  }
  
  game.marketInitiatorId = undefined;

  io.to(`room:${(store as any).getRoomByGame?.(game)?.id || 'unknown'}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { gameState: game });
}
