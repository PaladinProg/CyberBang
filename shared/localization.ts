/**
 * Словарь локализации Cyber-Bang (RU по умолчанию).
 *
 * Архитектура Bilingual (EN/RU):
 * - В коде, enums и серверной логике — только TECH_KEYS (RoleType, CardType, …).
 * - В React UI — ТОЛЬКО строки из этого файла: LOC.CARD_NAMES[CardType.PING].
 * - Никаких русских строк напрямую в JSX.
 */

import {
  CardEffect,
  CardType,
  CharacterId,
  GamePhase,
  RoleType,
  RoomStatus,
  SocketErrorCode,
  TurnPhase,
} from './types/index.js';

/** Локализованная строка с опциональным описанием для tooltip */
export interface LocalizedEntry {
  name: string;
  description?: string;
}

/** Корневой объект локализации — единственный источник русских строк UI */
export const LOC = {
  /** Названия ролей */
  ROLE_NAMES: {
    [RoleType.ADMIN]: 'Системный Администратор',
    [RoleType.DEPUTY]: 'Корпоративный Агент',
    [RoleType.HACKER]: 'Хакер',
    [RoleType.CYBERPUNK]: 'Киберпсих',
  } satisfies Record<RoleType, string>,

  /** Краткие названия карт (для кнопок, руки, лога) */
  CARD_NAMES: {
    [CardType.PING]: 'ПИНГ!',
    [CardType.MISS]: 'ФАЙРВОЛЛ',
    [CardType.STIMULANT]: 'СТИМУЛЯНТ',
    [CardType.SERVER_ROOM]: 'СЕРВЕРНАЯ',
    [CardType.FLAK_TURRET]: 'ЗЕНИТНАЯ ТУРЕЛЬ',
    [CardType.DDOS]: 'DDoS-АТАКА',
    [CardType.DUEL]: 'КИБЕР-ДУЭЛЬ',
    [CardType.VPN]: 'ВПН!',
    [CardType.SOCIAL_ENGINEERING]: 'СОЦ. ИНЖЕНЕРИЯ',
    [CardType.DATA_STREAM]: 'ПОТОК ДАННЫХ',
    [CardType.DEEP_BACKDOOR]: 'ГЛУБОКИЙ БЭКДОР',
    [CardType.BLACK_MARKET]: 'ЧЁРНЫЙ РЫНОК',
    [CardType.PISTOL_EXE]: 'Пистолет.exe',
    [CardType.SHORT_CIRCUIT]: 'Короткое замыкание',
    [CardType.REMOTE_SHELL]: 'Удаленный шелл',
    [CardType.LONG_LINK]: 'Дальняя связь',
    [CardType.VOLCANIC_IMPLANT]: "Имплант 'Вулкан'",
    [CardType.GHOST_PROTOCOL]: "ПРОТОКОЛ 'ПРИЗРАК'",
    [CardType.SNIPER_SCOPE]: 'СНАЙПЕРСКИЙ МОДУЛЬ',
    [CardType.PROXY_SERVER]: 'ПРОКСИ-СЕРВЕР',
    [CardType.QUARANTINE]: 'КАРАНТИН',
    [CardType.LOGIC_BOMB]: 'ЛОГИЧЕСКАЯ БОМБА',
  } satisfies Record<CardType, string>,

  /** Описания карт для tooltip / модальных окон */
  CARD_DESCRIPTIONS: {
    [CardType.PING]: 'Атака на дистанции',
    [CardType.MISS]: 'Отмена попадания',
    [CardType.STIMULANT]: '+1 HP',
    [CardType.SERVER_ROOM]: 'Все +1 HP',
    [CardType.FLAK_TURRET]: 'Все получают урон',
    [CardType.DDOS]: 'Сбрось ПИНГ или получи урон',
    [CardType.DUEL]: 'Поединок до первого сброса ПИНГа',
    [CardType.VPN]: 'Украсть карту на дист. 1',
    [CardType.SOCIAL_ENGINEERING]: 'Заставить сбросить любую карту',
    [CardType.DATA_STREAM]: '+2 карты',
    [CardType.DEEP_BACKDOOR]: '+3 карты',
    [CardType.BLACK_MARKET]: 'Распределение карт',
    [CardType.PISTOL_EXE]: 'Базовое, дист. 1',
    [CardType.SHORT_CIRCUIT]: 'Дист. 2',
    [CardType.REMOTE_SHELL]: 'Дист. 3',
    [CardType.LONG_LINK]: 'Дист. 4',
    [CardType.VOLCANIC_IMPLANT]: 'Бесконечные ПИНГи на дист. 1',
    [CardType.GHOST_PROTOCOL]: '+1 к дистанции до тебя',
    [CardType.SNIPER_SCOPE]: '-1 к дистанции от тебя',
    [CardType.PROXY_SERVER]: 'Проверка на Черви при попадании',
    [CardType.QUARANTINE]: 'Пропуск хода, если не Черви',
    [CardType.LOGIC_BOMB]: 'Взрыв на Пики 2-9',
  } satisfies Record<CardType, string>,

  /** Названия персонажей */
  CHARACTER_NAMES: {
    [CharacterId.NET_RUNNER]: 'Нетраннер',
    [CharacterId.GLITCH_CODER]: 'Дебаггер',
    [CharacterId.CORP_LIQUIDATOR]: 'Ликвидатор',
    [CharacterId.BURNER]: 'Сжигатель',
    [CharacterId.BLACK_HAT]: 'Чёрная шляпа',
    [CharacterId.AUTO_LOADER]: 'Автозагрузчик',
    [CharacterId.REAPER]: 'Рипер',
    [CharacterId.ROGUE_AI]: 'Отказавшийся ИИ',
    [CharacterId.SPAM_BOT]: 'Спам-бот',
    [CharacterId.PATIENT_ZERO]: 'Нулевой пациент',
    [CharacterId.ZERO_COOL]: 'Камчатка',
    [CharacterId.NULL_ENTITY]: 'Нулевая сущность',
    [CharacterId.CACHE_HIT]: 'Мусорщик',
    [CharacterId.STREET_RAT]: 'Уличный крыс',
  } satisfies Record<CharacterId, string>,

  /** Описания способностей персонажей */
  CHARACTER_DESCRIPTIONS: {
    [CharacterId.NET_RUNNER]: 'Берет карту с руки соседа или из колоды',
    [CharacterId.GLITCH_CODER]: '2 шанса при проверке',
    [CharacterId.CORP_LIQUIDATOR]: 'Забирает карты убитых',
    [CharacterId.BURNER]: '+1 карта при потере HP',
    [CharacterId.BLACK_HAT]: 'Крадет карту за полученный урон',
    [CharacterId.AUTO_LOADER]: '+1 карта при пустой руке',
    [CharacterId.REAPER]: '2 карты = +1 HP',
    [CharacterId.ROGUE_AI]: 'ПИНГ вместо ФАЙРВОЛЛА и наоборот',
    [CharacterId.SPAM_BOT]: 'Без лимита ПИНГов',
    [CharacterId.PATIENT_ZERO]: 'Встроенный Призрак',
    [CharacterId.ZERO_COOL]: 'Встроенный Снайпер',
    [CharacterId.NULL_ENTITY]: 'Встроенный Прокси',
    [CharacterId.CACHE_HIT]: 'Берет из сброса или колоды',
    [CharacterId.STREET_RAT]: '3 карты, 1 возвращает на верх колоды',
  } satisfies Record<CharacterId, string>,

  /** Названия типов эффектов (для логов / отладки UI) */
  EFFECT_NAMES: {
    [CardEffect.DAMAGE]: 'Урон',
    [CardEffect.HEAL]: 'Лечение',
    [CardEffect.DRAW]: 'Взять карты',
    [CardEffect.DISCARD]: 'Сброс',
    [CardEffect.STEAL]: 'Кража',
    [CardEffect.CHECK]: 'Проверка',
    [CardEffect.SKIP_TURN]: 'Пропуск хода',
    [CardEffect.EXPLOSION]: 'Взрыв',
  } satisfies Record<CardEffect, string>,

  /** Фазы хода */
  TURN_PHASE_NAMES: {
    [TurnPhase.UPLOAD]: 'Набор',
    [TurnPhase.EXECUTE]: 'Розыгрыш',
    [TurnPhase.PURGE]: 'Сброс',
    [TurnPhase.MARKET]: 'Рынок',
  } satisfies Record<TurnPhase, string>,

  /** Статусы партии */
  GAME_PHASE_NAMES: {
    [GamePhase.LOBBY]: 'Лобби',
    [GamePhase.PLAYING]: 'Игра',
    [GamePhase.FINISHED]: 'Завершена',
  } satisfies Record<GamePhase, string>,

  /** Статусы комнаты */
  ROOM_STATUS_NAMES: {
    [RoomStatus.WAITING]: 'Ожидание',
    [RoomStatus.PLAYING]: 'Идёт игра',
  } satisfies Record<RoomStatus, string>,

  /** Общие строки UI (лобби и навигация — Спринт 1+) */
  UI: {
    APP_TITLE: 'Cyber-Bang',
    LOBBY_TITLE: 'Лобби',
    CREATE_ROOM: 'Создать комнату',
    JOIN_ROOM: 'Войти',
    LEAVE_ROOM: 'Выйти',
    ROOM_NAME: 'Название комнаты',
    NICKNAME: 'Никнейм',
    PLAYERS: 'Игроки',
    NO_ROOMS: 'Комнат пока нет — создай первую!',
    CONNECTING: 'Подключение к серверу…',
    CONNECTED: 'Подключено',
    DISCONNECTED: 'Соединение потеряно',
    ERROR: 'Ошибка',
    IN_ROOM: 'Вы в комнате',
    MAX_PLAYERS: 'Макс. игроков',
    STATUS: 'Статус',
    REFRESH: 'Обновить',
  },

  /** Сообщения об ошибках лобби (ключ = SocketErrorCode) */
  ERRORS: {
    [SocketErrorCode.ROOM_NOT_FOUND]: 'Комната не найдена',
    [SocketErrorCode.ROOM_FULL]: 'Комната заполнена',
    [SocketErrorCode.GAME_ALREADY_STARTED]: 'Игра уже началась',
    [SocketErrorCode.INVALID_NICKNAME]: 'Никнейм: от 2 до 20 символов',
    [SocketErrorCode.INVALID_ROOM_NAME]: 'Название комнаты: от 2 до 32 символов',
    [SocketErrorCode.INVALID_MAX_PLAYERS]: 'Игроков должно быть от 4 до 7',
    [SocketErrorCode.ALREADY_IN_ROOM]: 'Вы уже в комнате',
    [SocketErrorCode.NOT_IN_ROOM]: 'Вы не в комнате',
    [SocketErrorCode.NOT_HOST]: 'Только хост может начать игру',
    [SocketErrorCode.NOT_ENOUGH_PLAYERS]: 'Минимум 4 игрока для старта',
    [SocketErrorCode.INTERNAL_ERROR]: 'Внутренняя ошибка сервера',
    [SocketErrorCode.INVALID_ACTION]: 'Недопустимое действие',
    [SocketErrorCode.RECONNECT_FAILED]: 'Не удалось переподключиться к игре',
  } satisfies Record<SocketErrorCode, string>,
} as const;

export type Localization = typeof LOC;

/** Хелпер: полная локализованная запись карты (имя + описание) */
export function getCardLocalized(cardType: CardType): LocalizedEntry {
  return {
    name: LOC.CARD_NAMES[cardType],
    description: LOC.CARD_DESCRIPTIONS[cardType],
  };
}

/** Хелпер: полная локализованная запись персонажа */
export function getCharacterLocalized(characterId: CharacterId): LocalizedEntry {
  return {
    name: LOC.CHARACTER_NAMES[characterId],
    description: LOC.CHARACTER_DESCRIPTIONS[characterId],
  };
}
