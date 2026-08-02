/**
 * Общие типы Cyber-Bang.
 * В коде — только английские TECH_KEYS (enums). Русский UI — через @cyberbang/shared/localization.
 */

// ─── Enums: роли, карты, персонажи, эффекты ───────────────────────────────

/** Скрытые роли игроков (TECH_KEYS из GAME_RULES.md) */
export enum RoleType {
  ADMIN = 'ADMIN',
  DEPUTY = 'DEPUTY',
  HACKER = 'HACKER',
  CYBERPUNK = 'CYBERPUNK',
}

/** Идентификаторы карт колоды (TECH_KEYS) */
export enum CardType {
  // Разовые действия
  PING = 'PING',
  MISS = 'MISS',
  STIMULANT = 'STIMULANT',
  SERVER_ROOM = 'SERVER_ROOM',
  FLAK_TURRET = 'FLAK_TURRET',
  DDOS = 'DDOS',
  DUEL = 'DUEL',
  PANIC = 'PANIC',
  SOCIAL_ENGINEERING = 'SOCIAL_ENGINEERING',
  DATA_STREAM = 'DATA_STREAM',
  DEEP_BACKDOOR = 'DEEP_BACKDOOR',
  BLACK_MARKET = 'BLACK_MARKET',
  // Оружие / импланты
  PISTOL_EXE = 'PISTOL_EXE',
  SHORT_CIRCUIT = 'SHORT_CIRCUIT',
  REMOTE_SHELL = 'REMOTE_SHELL',
  LONG_LINK = 'LONG_LINK',
  VOLCANIC_IMPLANT = 'VOLCANIC_IMPLANT',
  // Постоянное снаряжение
  GHOST_PROTOCOL = 'GHOST_PROTOCOL',
  SNIPER_SCOPE = 'SNIPER_SCOPE',
  PROXY_SERVER = 'PROXY_SERVER',
  // Контроль
  FIREWALL = 'FIREWALL',
  LOGIC_BOMB = 'LOGIC_BOMB',
}

/** Идентификаторы персонажей (TECH_KEYS) */
export enum CharacterId {
  NET_RUNNER = 'NET_RUNNER',
  GLITCH_CODER = 'GLITCH_CODER',
  CORP_LIQUIDATOR = 'CORP_LIQUIDATOR',
  BURNER = 'BURNER',
  BLACK_HAT = 'BLACK_HAT',
  AUTO_LOADER = 'AUTO_LOADER',
  REAPER = 'REAPER',
  ROGUE_AI = 'ROGUE_AI',
  SPAM_BOT = 'SPAM_BOT',
  PATIENT_ZERO = 'PATIENT_ZERO',
  ZERO_COOL = 'ZERO_COOL',
  NULL_ENTITY = 'NULL_ENTITY',
  CACHE_HIT = 'CACHE_HIT',
  STREET_RAT = 'STREET_RAT',
}

/** Типы игровых эффектов карт (TECH_KEYS) */
export enum CardEffect {
  DAMAGE = 'DAMAGE',
  HEAL = 'HEAL',
  DRAW = 'DRAW',
  DISCARD = 'DISCARD',
  STEAL = 'STEAL',
  CHECK = 'CHECK',
  SKIP_TURN = 'SKIP_TURN',
  EXPLOSION = 'EXPLOSION',
}

/** Масти игральных карт (для проверок Proxy Server, Firewall, Logic Bomb) */
export enum Suit {
  HEARTS = 'HEARTS',
  DIAMONDS = 'DIAMONDS',
  CLUBS = 'CLUBS',
  SPADES = 'SPADES',
}

/** Визуальная категория карты по правилам */
export enum CardCategory {
  /** Разовая карта (Brown Border) */
  INSTANT = 'INSTANT',
  /** Постоянная карта (Blue Border) */
  PERMANENT = 'PERMANENT',
  /** Оружие / имплант */
  WEAPON = 'WEAPON',
  /** Карта контроля (Firewall, Logic Bomb) */
  CONTROL = 'CONTROL',
}

/** Глобальный статус партии */
export enum GamePhase {
  LOBBY = 'LOBBY',
  PLAYING = 'PLAYING',
  FINISHED = 'FINISHED',
}

/** Фазы хода: Upload → Execute → Purge */
export enum TurnPhase {
  UPLOAD = 'UPLOAD',
  EXECUTE = 'EXECUTE',
  PURGE = 'PURGE',
}

/** Статус комнаты в лобби (до и во время игры) */
export enum RoomStatus {
  WAITING = 'WAITING',
  PLAYING = 'PLAYING',
}

// ─── Константы из правил ───────────────────────────────────────────────────

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 7;

/** Распределение ролей по количеству игроков (раздел 2.1 GAME_RULES) */
export const ROLE_DISTRIBUTION: Readonly<
  Record<number, Readonly<Partial<Record<RoleType, number>>>>
> = {
  4: { [RoleType.ADMIN]: 1, [RoleType.CYBERPUNK]: 1, [RoleType.HACKER]: 2 },
  5: {
    [RoleType.ADMIN]: 1,
    [RoleType.DEPUTY]: 1,
    [RoleType.CYBERPUNK]: 1,
    [RoleType.HACKER]: 2,
  },
  6: {
    [RoleType.ADMIN]: 1,
    [RoleType.DEPUTY]: 1,
    [RoleType.CYBERPUNK]: 1,
    [RoleType.HACKER]: 3,
  },
  7: {
    [RoleType.ADMIN]: 1,
    [RoleType.DEPUTY]: 2,
    [RoleType.CYBERPUNK]: 1,
    [RoleType.HACKER]: 3,
  },
} as const;

/** MAX_RANGE оружия (раздел 6.3 GAME_RULES) */
export const WEAPON_MAX_RANGE: Readonly<Partial<Record<CardType, number>>> = {
  [CardType.PISTOL_EXE]: 1,
  [CardType.SHORT_CIRCUIT]: 2,
  [CardType.REMOTE_SHELL]: 3,
  [CardType.LONG_LINK]: 4,
  [CardType.VOLCANIC_IMPLANT]: 1,
} as const;

/** Стартовое HP персонажей (раздел 3.1 GAME_RULES) */
export const CHARACTER_HP: Readonly<Record<CharacterId, number>> = {
  [CharacterId.NET_RUNNER]: 4,
  [CharacterId.GLITCH_CODER]: 4,
  [CharacterId.CORP_LIQUIDATOR]: 4,
  [CharacterId.BURNER]: 4,
  [CharacterId.BLACK_HAT]: 3,
  [CharacterId.AUTO_LOADER]: 4,
  [CharacterId.REAPER]: 4,
  [CharacterId.ROGUE_AI]: 4,
  [CharacterId.SPAM_BOT]: 4,
  [CharacterId.PATIENT_ZERO]: 3,
  [CharacterId.ZERO_COOL]: 4,
  [CharacterId.NULL_ENTITY]: 4,
  [CharacterId.CACHE_HIT]: 4,
  [CharacterId.STREET_RAT]: 4,
} as const;

/** События игровой фазы (Спринт 2+) */
export const GAME_EVENTS = {
  START_GAME: 'startGame',
  GAME_STARTED: 'gameStarted',
  GAME_STATE_UPDATE: 'gameStateUpdate',
  REQUEST_STATE: 'requestState',
} as const;

/** Payload для запуска игры */
export interface StartGamePayload {
  roomId: string;
}

/** Payload при успешном старте игры */
export interface GameStartedPayload {
  gameState: GameState;
}

// ─── Карты ─────────────────────────────────────────────────────────────────

/** Ранг игральной карты: 2–10, валет (11), дама (12), король (13), туз (14) */
export type CardRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

/** Экземпляр карты в колоде, на руке или на столе */
export interface CardInstance {
  /** Уникальный ID экземпляра в партии */
  id: string;
  type: CardType;
  /** Масть и ранг — только для карт из колоды (не для PISTOL_EXE по умолчанию) */
  suit?: Suit;
  rank?: CardRank;
}

// ─── Игрок ─────────────────────────────────────────────────────────────────

/** Состояние одного игрока за столом */
export interface PlayerState {
  id: string;
  nickname: string;
  /** Позиция за столом (0 = первый после Admin по часовой стрелке) */
  seatIndex: number;
  characterId: CharacterId | null;
  /** Скрытая роль; null до раздачи */
  role: RoleType | null;
  /** Admin открыт сразу; остальные — после смерти или конца игры */
  isRoleRevealed: boolean;
  currentHp: number;
  maxHp: number;
  /** Карты на руке */
  hand: CardInstance[];
  /** Постоянные карты перед игроком (оружие, Ghost Protocol и т.д.) */
  equipment: CardInstance[];
  /** Карты контроля, сыгранные НА этого игрока (Firewall) */
  controlCards: CardInstance[];
  isAlive: boolean;
  isConnected: boolean;
  /** Сколько карт Ping! сыграно в текущем ходу (лимит 1, кроме исключений) */
  pingsPlayedThisTurn: number;
}

// ─── Игра и комната ────────────────────────────────────────────────────────

/** Полное состояние активной партии */
export interface GameState {
  roomId: string;
  phase: GamePhase;
  turnPhase: TurnPhase | null;
  /** ID игрока, чей сейчас ход */
  currentTurnPlayerId: string | null;
  players: PlayerState[];
  deck: CardInstance[];
  discardPile: CardInstance[];
  /** Номер текущего хода (Admin = 1) */
  turnNumber: number;
  /** Роли-победители; null пока игра не завершена */
  winnerRoles: RoleType[] | null;
  pendingAttacks?: Map<string, Array<{ amount: number; sourceId: string }>>;
}

/** Состояние комнаты в памяти сервера (лобби + опционально активная игра) */
export interface RoomState {
  id: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  status: RoomStatus;
  /** Упорядоченный список ID подключённых игроков */
  playerIds: string[];
  /** Заполняется после старта партии (Спринт 2+) */
  game: GameState | null;
  createdAt: number;
}

/** Публичное представление комнаты для списка в лобби (без скрытых данных игры) */
export interface RoomSummary {
  id: string;
  name: string;
  hostId: string;
  playerCount: number;
  maxPlayers: number;
  status: RoomStatus;
}

// ─── Socket-события (лобби, Спринт 1) ────────────────────────────────────

export interface CreateRoomPayload {
  roomName: string;
  nickname: string;
  maxPlayers?: number;
}

export interface JoinRoomPayload {
  roomId: string;
  nickname: string;
}

export interface LeaveRoomPayload {
  roomId: string;
}

export interface RoomUpdatePayload {
  rooms: RoomSummary[];
  /** ID комнаты текущего игрока (только в персональном emit после create/join/leave) */
  yourRoomId?: string | null;
}

export interface SocketErrorPayload {
  code: SocketErrorCode;
  message: string;
}

/** Коды ошибок лобби (EN — маппятся на RU в localization) */
export enum SocketErrorCode {
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  ROOM_FULL = 'ROOM_FULL',
  GAME_ALREADY_STARTED = 'GAME_ALREADY_STARTED',
  INVALID_NICKNAME = 'INVALID_NICKNAME',
  INVALID_ROOM_NAME = 'INVALID_ROOM_NAME',
  INVALID_MAX_PLAYERS = 'INVALID_MAX_PLAYERS',
  ALREADY_IN_ROOM = 'ALREADY_IN_ROOM',
  NOT_IN_ROOM = 'NOT_IN_ROOM',
  NOT_HOST = 'NOT_HOST',
  NOT_ENOUGH_PLAYERS = 'NOT_ENOUGH_PLAYERS',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INVALID_ACTION = 'INVALID_ACTION',
}

/** Имена Socket.IO-событий (единый контракт client ↔ server) */
export const SOCKET_EVENTS = {
  CREATE_ROOM: 'createRoom',
  JOIN_ROOM: 'joinRoom',
  LEAVE_ROOM: 'leaveRoom',
  ROOM_UPDATE: 'roomUpdate',
  SOCKET_ERROR: 'socketError',
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

// ─── Re-exports для удобства ───────────────────────────────────────────────

export type { CardInstance as Card };

export interface PlayCardPayload {
  cardId: string;
  targetId?: string;
}


