// server/src/rooms/handlers.ts
import type { Server, Socket } from 'socket.io';
import { prepareGame } from '../game/setup.js';
import {
  CreateRoomPayload,
  JoinRoomPayload,
  LeaveRoomPayload,
  RoomStatus,
  SOCKET_EVENTS,
  SocketErrorCode,
  GAME_EVENTS,
  StartGamePayload,
  PlayCardPayload,
  PickMarketCardPayload,
} from '@cyberbang/shared/types';
import {
  makeSocketError,
  normalizeMaxPlayers,
  RoomStore,
  validateNickname,
  validateRoomName,
} from './store.js';
import { startTurn, endTurn, playCard, endMarketPhase, getSafeGameState } from '../game/engine.js';

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

  if (!session || !room || room.hostId !== socket.id) {
    emitError(socket, SocketErrorCode.NOT_HOST);
    return;
  }

  if (room.playerIds.length < 4) {
    emitError(socket, SocketErrorCode.NOT_ENOUGH_PLAYERS);
    return;
  }

  try {
    const gameState = prepareGame(room, store.sessions);
    room.game = gameState;
    room.status = 'PLAYING' as any;

    gameState.players.forEach(p => {
      const sess = store.sessions.get(p.id);
      if (sess) p.nickname = sess.nickname;
    });

    io.to(`room:${room.id}`).emit(GAME_EVENTS.GAME_STARTED, { gameState });
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
  
  if (!session?.roomId) return;
  
  const room = store.getRoom(session.roomId);
  if (!room || !room.game) return;

  socket.emit(GAME_EVENTS.GAME_STARTED, { gameState: room.game });
  
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

  if (room.game.currentTurnPlayerId !== socket.id) return;

  endTurn(room.game, io);
  
  io.to(`room:${room.id}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { 
    gameState: getSafeGameState(room.game) 
  });
}

function handlePlayCard(io: Server, socket: Socket, store: RoomStore, payload: PlayCardPayload) {
  const session = store.getSession(socket.id);
  if (!session?.roomId) return;
  
  const room = store.getRoom(session.roomId);
  if (!room?.game) return;

  const result = playCard(room.game, socket.id, payload.cardId, payload.targetId, io);
  
  if (result.success) {
    io.to(`room:${room.id}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { 
      gameState: getSafeGameState(room.game) 
    });
  } else {
    socket.emit(SOCKET_EVENTS.SOCKET_ERROR, { 
      code: SocketErrorCode.INVALID_ACTION, 
      message: result.message 
    });
  }
}

function handleReconnectToRoom(
  io: Server,
  socket: Socket,
  store: RoomStore,
  payload: { roomId: string; nickname: string }
) {
  const { roomId, nickname } = payload;
  console.log(`[Server] Попытка переподключения: ${nickname} -> ${roomId}`);
  const room = store.getRoom(roomId);

  if (!room) {
    socket.emit('reconnectResult', { success: false, reason: 'Комната не найдена' });
    return;
  }

  if (room.status !== 'PLAYING' || !room.game) {
    socket.emit('reconnectResult', { success: false, reason: 'Игра не активна' });
    return;
  }

  const playerInGame = room.game.players.find(
    (p) => p.nickname === nickname && p.isAlive
  );

  if (!playerInGame) {
    socket.emit('reconnectResult', { success: false, reason: 'Игрок не найден в игре' });
    return;
  }

  const oldSocketId = playerInGame.id;
  const newSocketId = socket.id;

  playerInGame.id = newSocketId;
  playerInGame.isConnected = true;

  if (room.game.currentTurnPlayerId === oldSocketId) {
    room.game.currentTurnPlayerId = newSocketId;
  }

  if (room.game.pendingAttacks && room.game.pendingAttacks.has(oldSocketId)) {
    const attacks = room.game.pendingAttacks.get(oldSocketId)!;
    room.game.pendingAttacks.delete(oldSocketId);
    room.game.pendingAttacks.set(newSocketId, attacks);
  }

  store.upsertSession(newSocketId, nickname);
  room.playerIds = room.playerIds.map((id) => (id === oldSocketId ? newSocketId : id));
  if (room.hostId === oldSocketId) room.hostId = newSocketId;

  void socket.join(`room:${roomId}`);

  const safeGameState = getSafeGameState(room.game);

  socket.emit('reconnectResult', {
    success: true,
    gameState: safeGameState,
  });

  io.to(`room:${roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { gameState: safeGameState });

  console.log(`[Server] ✅ Игрок ${nickname} успешно переподключен (ID: ${oldSocketId} -> ${newSocketId})`);
}

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

  if (game.turnPhase !== 'MARKET') {
    console.warn(`[Server] pickMarketCard ignored: not in MARKET phase`);
    return;
  }
  
  const alivePlayers = game.players.filter(p => p.isAlive);
  const currentPickerIndex = game.marketPickerIndex;
  
  if (currentPickerIndex === undefined || currentPickerIndex >= alivePlayers.length) {
    console.error('[Server] Invalid marketPickerIndex');
    return;
  }

  const currentPickerId = alivePlayers[currentPickerIndex].id;
  
  if (socket.id !== currentPickerId) {
    socket.emit(SOCKET_EVENTS.SOCKET_ERROR, { 
      code: SocketErrorCode.INVALID_ACTION, 
      message: 'Сейчас не ваш выбор!' 
    });
    return;
  }

  const marketCards = game.marketCards || [];
  const cardIndex = marketCards.findIndex((c) => c.id === payload.cardId);
  
  if (cardIndex === -1) {
    socket.emit(SOCKET_EVENTS.SOCKET_ERROR, { 
      code: SocketErrorCode.INVALID_ACTION, 
      message: 'Карта больше недоступна на рынке' 
    });
    return;
  }

  const card = marketCards.splice(cardIndex, 1)[0];
  const player = game.players.find(p => p.id === socket.id);
  
  if (player) {
    player.hand.push(card);
    console.log(`[Engine] ${player.nickname} picked ${card.type} from Black Market`);
  }

  game.marketPickerIndex = (currentPickerIndex + 1) % alivePlayers.length;

  if (marketCards.length === 0) {
    endMarketPhase(game, io, room.id);
  } else {
    io.to(`room:${room.id}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { 
      gameState: getSafeGameState(game) 
    });
  }
}

function handleDiscardSocialEngineeringCard(
  io: Server,
  socket: Socket,
  store: RoomStore,
  payload: { cardId: string; location: string }
) {
  const session = store.getSession(socket.id);
  if (!session?.roomId) return;
  
  const room = store.getRoom(session.roomId);
  if (!room?.game) return;

  const game = room.game;
  const pending = game.pendingSocialEngineering?.get(socket.id);
  
  if (!pending) {
    socket.emit(SOCKET_EVENTS.SOCKET_ERROR, { 
      code: SocketErrorCode.INVALID_ACTION, 
      message: 'Нет активного запроса на сброс' 
    });
    return;
  }

  const player = game.players.find(p => p.id === socket.id);
  if (!player) return;

  let cardExists = false;
  if (payload.location === 'hand') {
    cardExists = player.hand.some(c => c.id === payload.cardId);
  } else if (payload.location === 'equipment') {
    cardExists = player.equipment.some(c => c.id === payload.cardId);
  } else if (payload.location === 'control') {
    cardExists = player.controlCards.some(c => c.id === payload.cardId);
  }

  if (!cardExists) {
    socket.emit(SOCKET_EVENTS.SOCKET_ERROR, { 
      code: SocketErrorCode.INVALID_ACTION, 
      message: 'Карта не найдена' 
    });
    return;
  }

  let discardedCard: any;
  if (payload.location === 'hand') {
    const idx = player.hand.findIndex(c => c.id === payload.cardId);
    if (idx !== -1) discardedCard = player.hand.splice(idx, 1)[0];
  } else if (payload.location === 'equipment') {
    const idx = player.equipment.findIndex(c => c.id === payload.cardId);
    if (idx !== -1) discardedCard = player.equipment.splice(idx, 1)[0];
  } else if (payload.location === 'control') {
    const idx = player.controlCards.findIndex(c => c.id === payload.cardId);
    if (idx !== -1) discardedCard = player.controlCards.splice(idx, 1)[0];
  }

  if (discardedCard) {
    game.discardPile.push(discardedCard);
    console.log(`[Engine] ${player.nickname} discarded ${discardedCard.type} via Social Engineering`);
  }

  game.pendingSocialEngineering?.delete(socket.id);

  io.to(`room:${room.id}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { 
    gameState: getSafeGameState(game) 
  });
}