// server/src/game/setup.ts
import { v4 as uuidv4 } from 'uuid';
import {
  CardType, CharacterId, GameState, PlayerState,
  RoleType, ROLE_DISTRIBUTION, Suit, CardInstance, RoomState, CHARACTER_HP, GamePhase, TurnPhase
} from '@cyberbang/shared/types';
import type { PlayerSession } from '../rooms/store.js'; 
import { startTurn } from './engine.js';

function generateDeck(): CardInstance[] {
  const deck: CardInstance[] = [];
  // Упрощенная генерация для теста. В продакшене нужно точное кол-во карт по правилам
  const suits: Suit[] = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES];
  
  // Добавляем базовые карты (примерно)
  const addCards = (type: CardType, count: number, needSuit = false) => {
    for (let i = 0; i < count; i++) {
      deck.push({
        id: uuidv4(),
        type,
        suit: needSuit ? suits[i % 4] : undefined,
        rank: needSuit ? (2 + (i % 13)) as any : undefined,
      });
    }
  };

  //Боевые действия
  addCards(CardType.PING, 25);
  addCards(CardType.MISS, 10); //TODO подбалансить кол-во карт
  addCards(CardType.STIMULANT, 5);
  addCards(CardType.SERVER_ROOM, 2);
  addCards(CardType.FLAK_TURRET, 1);
  addCards(CardType.DDOS, 2);
  addCards(CardType.DUEL, 2);
  addCards(CardType.VPN, 4);
  addCards(CardType.SOCIAL_ENGINEERING, 3);
  addCards(CardType.DATA_STREAM, 2);
  addCards(CardType.DEEP_BACKDOOR, 1);
  addCards(CardType.BLACK_MARKET, 1);
  
  // Оружие и экипировка
  addCards(CardType.SHORT_CIRCUIT, 2);
  addCards(CardType.REMOTE_SHELL, 2);
  addCards(CardType.LONG_LINK, 1);
  addCards(CardType.VOLCANIC_IMPLANT, 1);
  addCards(CardType.GHOST_PROTOCOL, 2);
  addCards(CardType.SNIPER_SCOPE, 2);
  addCards(CardType.PROXY_SERVER, 2);
  addCards(CardType.QUARANTINE, 2);
  addCards(CardType.LOGIC_BOMB, 2);

  return shuffle(deck);
}

function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function prepareGame(
  room: RoomState, 
  sessions: Map<string, PlayerSession>
): GameState {
  const playerCount = room.playerIds.length;
  const roleConfig = ROLE_DISTRIBUTION[playerCount];
  
  if (!roleConfig) throw new Error(`Invalid player count: ${playerCount}`);

  // 1. Раздача ролей
  const roles: RoleType[] = [];
  for (const [role, count] of Object.entries(roleConfig)) {
    for (let i = 0; i < (count || 0); i++) roles.push(role as RoleType);
  }
  shuffle(roles);

  // 2. Раздача персонажей
  const allChars = Object.values(CharacterId);
  const characters = shuffle([...allChars]).slice(0, playerCount);

  // 3. Создание игроков
  const players: PlayerState[] = room.playerIds.map((socketId, index) => {
    const characterId = characters[index];
    const role = roles[index];
    const baseHp = CHARACTER_HP[characterId];
    const maxHp = role === RoleType.ADMIN ? baseHp + 1 : baseHp;

    // Получаем никнейм безопасно из переданной карты сессий
    const session = sessions.get(socketId);
    const nickname = session?.nickname || 'Unknown';

    return {
      id: socketId,
      nickname,
      seatIndex: index,
      characterId,
      role,
      isRoleRevealed: role === RoleType.ADMIN,
      currentHp: maxHp,
      maxHp,
      hand: [],
      equipment: [],
      controlCards: [],
      isAlive: true,
      isConnected: true,
      pingsPlayedThisTurn: 0,
    };
  });

  

  // 4. Раздача карт
  const deck = generateDeck();

  const adminIndex = players.findIndex(p => p.role === RoleType.ADMIN);

  const game: GameState = {
    roomId: room.id,
    phase: GamePhase.PLAYING,
    turnPhase: null, // Будет установлен в startTurn
    currentTurnPlayerId: players[adminIndex]?.id ?? null,
    players,
    deck, // <-- ВАЖНО: передаем сгенерированную колоду!
    discardPile: [],
    turnNumber: 1,
    winnerRoles: null,
  };

  // Это автоматически выдаст шерифу 2 карты и переведет в фазу EXECUTE
  startTurn(game); 

  return game;
  /*return {
    roomId: room.id,
    phase: GamePhase.PLAYING,
    turnPhase: null,
    currentTurnPlayerId: players[adminIndex]?.id ?? null,
    players,
    deck,
    discardPile: [],
    turnNumber: 1,
    winnerRoles: null,
  };*/
}