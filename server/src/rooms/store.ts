import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  RoomState,
  RoomStatus,
  RoomSummary,
  SocketErrorCode,
} from '@cyberbang/shared/types';

/** Сессия подключённого игрока (socket.id → данные) */
export interface PlayerSession {
  socketId: string;
  nickname: string;
  roomId: string | null;
}

/** Хранилище комнат и сессий — только RAM, без БД */
export class RoomStore {
  readonly rooms = new Map<string, RoomState>();
  readonly sessions = new Map<string, PlayerSession>();

  /** Публичный список комнат для лобби */
  getSummaries(): RoomSummary[] {
    return [...this.rooms.values()]
      .map((room) => ({
        id: room.id,
        name: room.name,
        hostId: room.hostId,
        playerCount: room.playerIds.length,
        maxPlayers: room.maxPlayers,
        status: room.status,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  getSession(socketId: string): PlayerSession | undefined {
    return this.sessions.get(socketId);
  }

  upsertSession(socketId: string, nickname: string): PlayerSession {
    const existing = this.sessions.get(socketId);
    if (existing) {
      existing.nickname = nickname;
      return existing;
    }
    const session: PlayerSession = { socketId, nickname, roomId: null };
    this.sessions.set(socketId, session);
    return session;
  }

  getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId);
  }

  /** Создание комнаты; хост автоматически добавляется в playerIds */
  createRoom(
    roomId: string,
    name: string,
    hostSocketId: string,
    maxPlayers: number,
  ): RoomState {
    const room: RoomState = {
      id: roomId,
      name,
      hostId: hostSocketId,
      maxPlayers,
      status: RoomStatus.WAITING,
      playerIds: [hostSocketId],
      game: null,
      createdAt: Date.now(),
    };
    this.rooms.set(roomId, room);

    const session = this.sessions.get(hostSocketId);
    if (session) {
      session.roomId = roomId;
    }

    return room;
  }

  /** Добавить игрока в комнату */
  addPlayer(roomId: string, socketId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    if (room.playerIds.includes(socketId)) return true;

    room.playerIds.push(socketId);
    const session = this.sessions.get(socketId);
    if (session) {
      session.roomId = roomId;
    }
    return true;
  }

  /** Удалить игрока из комнаты; пустая комната удаляется из Map */
  removePlayer(roomId: string, socketId: string): RoomState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.playerIds = room.playerIds.filter((id) => id !== socketId);

    const session = this.sessions.get(socketId);
    if (session) {
      session.roomId = null;
    }

    if (room.playerIds.length === 0) {
      this.rooms.delete(roomId);
      return null;
    }

    // Передача хоста первому оставшемуся игроку
    if (room.hostId === socketId) {
      room.hostId = room.playerIds[0] ?? room.hostId;
    }

    return room;
  }

  /** Отключение сокета — выход из комнаты, если был в ней */
  handleDisconnect(socketId: string): string | null {
    const session = this.sessions.get(socketId);
    this.sessions.delete(socketId);

    if (!session?.roomId) return null;

    const roomId = session.roomId;
    this.removePlayer(roomId, socketId);
    return roomId;
  }
}

/** Валидация никнейма */
export function validateNickname(nickname: string): boolean {
  const trimmed = nickname.trim();
  return trimmed.length >= 2 && trimmed.length <= 20;
}

/** Валидация названия комнаты */
export function validateRoomName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 32;
}

/** Нормализация maxPlayers в диапазон 4–7 */
export function normalizeMaxPlayers(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) {
    return MAX_PLAYERS;
  }
  return Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.floor(value)));
}

/** Построить payload ошибки для клиента */
export function makeSocketError(code: SocketErrorCode): {
  code: SocketErrorCode;
  message: string;
} {
  return { code, message: code };
}
