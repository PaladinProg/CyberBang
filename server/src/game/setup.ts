// server/src/game/setup.ts
import { v4 as uuidv4 } from 'uuid';
import {
  CardType,
  CharacterId,
  GameState,
  PlayerState,
  RoleType,
  ROLE_DISTRIBUTION,
  Suit,
  CardRank,
  CardInstance,
  RoomState,
  CHARACTER_HP,
  GamePhase,
} from '@cyberbang/shared/types';
import type { PlayerSession } from '../rooms/store.js';
import { startTurn } from './engine.js';

/**
 * Генерация сбалансированной колоды карт с обязательными мастями и рангами.
 * Важно: карты проверок (Бочка, Динамит, Тюрьма) зависят от масти и ранга!
 */
function generateDeck(): CardInstance[] {
  const deck: CardInstance[] = [];
  const suits: Suit[] = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES];
  let suitIndex = 0;

  let cardCounter = 0;

  const addCards = (
    type: CardType,
    count: number,
    forcedSuit?: Suit,
    forcedRankRange?: [number, number]
  ) => {
    for (let i = 0; i < count; i++) {
      const suit = forcedSuit ?? suits[cardCounter % suits.length];
      let rank: CardRank;

      if (forcedRankRange) {
        const [min, max] = forcedRankRange;
        rank = (min + (i % (max - min + 1))) as CardRank;
      } else {
        // Ранги от 2 до Туза (14)
        rank = (2 + (cardCounter % 13)) as CardRank;
      }

      deck.push({
        id: uuidv4(),
        type,
        suit: suits[suitIndex % 4],
        rank: (2 + (suitIndex % 13)) as any,
      });
      suitIndex++;

      cardCounter++;
    }
  };

  // --- Боевые разовые карты ---
  addCards(CardType.PING, 25);
  // Часть Miss! делаем червами (для проверок)
  addCards(CardType.MISS, 6, Suit.HEARTS);
  addCards(CardType.MISS, 6, Suit.CLUBS);
  addCards(CardType.STIMULANT, 6, Suit.HEARTS);
  addCards(CardType.SERVER_ROOM, 2, Suit.HEARTS);
  addCards(CardType.FLAK_TURRET, 2);
  addCards(CardType.DDOS, 3);
  addCards(CardType.DUEL, 3);
  addCards(CardType.VPN, 4);
  addCards(CardType.SOCIAL_ENGINEERING, 4);
  addCards(CardType.DATA_STREAM, 3);
  addCards(CardType.DEEP_BACKDOOR, 2);
  addCards(CardType.BLACK_MARKET, 2);

  // --- Оружие и экипировка ---
  addCards(CardType.SHORT_CIRCUIT, 2);
  addCards(CardType.REMOTE_SHELL, 2);
  addCards(CardType.LONG_LINK, 2);
  addCards(CardType.VOLCANIC_IMPLANT, 1);
  addCards(CardType.GHOST_PROTOCOL, 2);
  addCards(CardType.SNIPER_SCOPE, 2);

  // PROXY_SERVER (Бочка) — обязательно со свойствами
  addCards(CardType.PROXY_SERVER, 2, Suit.SPADES, [10, 11]);

  // --- Карты контроля ---
  // QUARANTINE (Тюрьма)
  addCards(CardType.QUARANTINE, 3, Suit.SPADES, [4, 10]);

  // LOGIC_BOMB (Динамит): по правилам это Пики, ранги от 2 до 9 (взрывоопасная)
  addCards(CardType.LOGIC_BOMB, 2, Suit.SPADES, [2, 9]);

  return shuffle(deck);
}

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function prepareGame(
  room: RoomState,
  sessions: Map<string, PlayerSession>
): GameState {
  const playerCount = room.playerIds.length;
  const roleConfig = ROLE_DISTRIBUTION[playerCount];

  if (!roleConfig) {
    throw new Error(`Недопустимое количество игроков: ${playerCount}`);
  }

  // 1. Раздача ролей
  const roles: RoleType[] = [];
  for (const [role, count] of Object.entries(roleConfig)) {
    for (let i = 0; i < (count || 0); i++) {
      roles.push(role as RoleType);
    }
  }
  const shuffledRoles = shuffle(roles);

  // 2. Раздача уникальных персонажей
  const allChars = Object.values(CharacterId);
  const characters = shuffle([...allChars]).slice(0, playerCount);

  // 3. Формирование игроков (у всех изначально 0 карт, как задумано)
  const players: PlayerState[] = room.playerIds.map((socketId, index) => {
    const characterId = characters[index];
    const role = shuffledRoles[index];
    const baseHp = CHARACTER_HP[characterId] || 4;
    const maxHp = role === RoleType.ADMIN ? baseHp + 1 : baseHp;

    const session = sessions.get(socketId);
    const nickname = session?.nickname || `Player_${index + 1}`;

    return {
      id: socketId,
      nickname,
      seatIndex: index,
      characterId,
      role,
      isRoleRevealed: role === RoleType.ADMIN, // Только Админ открыт
      currentHp: maxHp,
      maxHp,
      hand: [],
      equipment: [],
      controlCards: [],
      isAlive: true,
      isConnected: true,
      pingsPlayedThisTurn: 0,
      isDying: false,
    };
  });

  // 4. Инициализация игры
  const deck = generateDeck();
  const adminIndex = players.findIndex((p) => p.role === RoleType.ADMIN);

  const game: GameState = {
    roomId: room.id,
    phase: GamePhase.PLAYING,
    turnPhase: null,
    currentTurnPlayerId: players[adminIndex]?.id ?? players[0].id,
    players,
    deck,
    discardPile: [],
    turnNumber: 1,
    winnerRoles: null,
    pendingAttacks: new Map(),
    pendingSocialEngineering: new Map(),
  };

  // Админ сразу начинает первый ход и добирает свои 2 стартовые карты
  startTurn(game);

  return game;
}