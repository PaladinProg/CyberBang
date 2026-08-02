// server/src/game/engine.ts
import { Server } from 'socket.io';
import {
  CardType, CharacterId, GameState, PlayerState, TurnPhase, GamePhase, RoleType,
  CHARACTER_HP, Suit, GAME_EVENTS
} from '@cyberbang/shared/types';

/**
 * Перемешивание массива (Fisher-Yates)
 */
function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Восстановление колоды из сброса, если основная пуста
 */
function refillDeck(game: GameState): void {
  if (game.deck.length === 0 && game.discardPile.length > 0) {
    game.deck = shuffle([...game.discardPile]);
    game.discardPile = [];
  }
}

/**
 * Начало хода текущего игрока
 */
export function startTurn(game: GameState): boolean {
  if (!game.currentTurnPlayerId) return false;

  const currentPlayer = game.players.find(p => p.id === game.currentTurnPlayerId);
  if (!currentPlayer || !currentPlayer.isAlive) return false; 

  // Проверка FIREWALL (Карантин) перед началом хода
  const jailCard = currentPlayer.controlCards.find(c => c.type === CardType.FIREWALL);
  if (jailCard) {
    refillDeck(game);
    const checkCard = game.deck.shift();
    if (checkCard) {
      game.discardPile.push(checkCard);
      // Черви = освобождение, иначе пропуск хода
      if (checkCard.suit !== Suit.HEARTS) {
        currentPlayer.controlCards = currentPlayer.controlCards.filter(c => c.id !== jailCard.id);
        return false; 
      } else {
        currentPlayer.controlCards = currentPlayer.controlCards.filter(c => c.id !== jailCard.id);
      }
    }
  }

  // 1. Фаза UPLOAD (Набор)
  game.turnPhase = TurnPhase.UPLOAD;
  
  refillDeck(game);
  for (let i = 0; i < 2; i++) {
    if (game.deck.length > 0) {
      currentPlayer.hand.push(game.deck.shift()!);
    }
  }
  
  // 2. Автоматический переход в EXECUTE
  game.turnPhase = TurnPhase.EXECUTE;
  currentPlayer.pingsPlayedThisTurn = 0;

  return true;
}

/**
 * Завершение хода текущего игрока
 */
export function endTurn(game: GameState): void {
  if (!game.currentTurnPlayerId) return;
  const currentPlayer = game.players.find(p => p.id === game.currentTurnPlayerId);
  
  if (currentPlayer && currentPlayer.isAlive) {
    // 3. Фаза PURGE (Сброс)
    while (currentPlayer.hand.length > currentPlayer.currentHp) {
      const discarded = currentPlayer.hand.pop();
      if (discarded) game.discardPile.push(discarded);
    }
  }

  passTurnToNextAlive(game);
}

function passTurnToNextAlive(game: GameState): void {
  const currentIndex = game.players.findIndex(p => p.id === game.currentTurnPlayerId);
  let nextIndex = (currentIndex + 1) % game.players.length;
  
  let attempts = 0;
  while ((!game.players[nextIndex].isAlive) && attempts < game.players.length) {
    nextIndex = (nextIndex + 1) % game.players.length;
    attempts++;
  }

  if (attempts >= game.players.length) {
    game.phase = GamePhase.FINISHED;
    return;
  }

  game.currentTurnPlayerId = game.players[nextIndex].id;
  game.turnNumber++;
  game.turnPhase = null; 
  
  startTurn(game);
}

/**
 * Валидация и применение действия игрока
 */
export function playCard(
  game: GameState, 
  playerId: string, 
  cardId: string, 
  targetId?: string,
  io?: Server // <-- Добавляем io для отправки событий
): { success: boolean; message?: string } {
  
  const player = game.players.find(p => p.id === playerId);
  if (!player || !player.isAlive) return { success: false, message: 'Игрок не активен' };
  
  const cardIndex = player.hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return { success: false, message: 'Карты нет на руке' };

  const card = player.hand[cardIndex];

  // --- Логика PING! ---
  if (card.type === CardType.PING) {
    // ... проверки лимита и фазы ...
    if (game.currentTurnPlayerId !== playerId) return { success: false, message: 'Не ваш ход' };
    if (game.turnPhase !== TurnPhase.EXECUTE) return { success: false, message: 'Сейчас не фаза розыгрыша' };
    if (player.pingsPlayedThisTurn >= 1) { /* ... проверка лимита ... */ }

    if (!targetId) return { success: false, message: 'Укажите цель для ПИНГа' };
    
    const target = game.players.find(p => p.id === targetId);
    if (!target || !target.isAlive) return { success: false, message: 'Цель неактивна' };
    if (target.id === playerId) return { success: false, message: 'Нельзя стрелять в себя' };

    // ▼▼▼ 1. СОЗДАЕМ ОТЛОЖЕННУЮ АТАКУ (УРОН НЕ НАНОСИТСЯ СРАЗУ!) ▼▼▼
    if (io) {
      io.to(target.id).emit('incomingAttack', { damage: 1, sourceId: playerId });
      
      if (!game.pendingAttacks) game.pendingAttacks = new Map();
      if (!game.pendingAttacks.has(target.id)) game.pendingAttacks.set(target.id, []);
      
      // Сохраняем данные атаки для будущего применения
      game.pendingAttacks.get(target.id)!.push({ amount: 1, sourceId: playerId });
      
      // Запускаем таймер на сервере (например, 8 секунд)
      // Если за это время не придет защита, урон применится автоматически
      setTimeout(() => {
        resolvePendingAttack(game, target.id, io);
      }, 11000); 
    }

    // Трата карты происходит сразу
    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);
    player.pingsPlayedThisTurn++;
    
    return { success: true };
  }

  // --- Логика STIMULANT (Пиво) ---
  if (card.type === CardType.STIMULANT) {
    // ▼▼▼ ОГРАНИЧЕНИЕ ПРИ 2 ИГРОКАХ ▼▼▼
    const aliveCount = game.players.filter(p => p.isAlive).length;
    if (aliveCount <= 2) {
      return { success: false, message: 'Стимулянт не работает при 2 игроках' };
    }

    if (player.currentHp >= getMaxHp(player)) {
      return { success: false, message: 'Здоровье уже полное' };
    }

    player.currentHp += 1;
    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);
    return { success: true };
  }

  // --- Логика MISS! (Файрволл) ---
  // Miss играется вне хода в ответ на атаку
  if (card.type === CardType.MISS) {
    // Проверяем, есть ли активная атака на этого игрока
    const pendingAttacks = game.pendingAttacks?.get(playerId);
    if (!pendingAttacks || pendingAttacks.length === 0) {
      return { success: false, message: 'Нет активной атаки для отмены' };
    }

    // Отменяем последнюю атаку
    pendingAttacks.pop();
    if (pendingAttacks.length === 0) {
      game.pendingAttacks.delete(playerId);
    }

    // Удаляем карту с руки
    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);
    
    // Отправляем событие об успешной защите всем в комнате
    if (io) {
      io.emit('defenseSuccess', { playerId, cardType: CardType.MISS });
    }
    
    return { success: true };
  }
  
  return { success: false, message: 'Неподдерживаемая карта для этого действия' };
}

/**
 * Применение урона с проверкой смерти
 */
export function applyDamage(
  game: GameState, 
  target: PlayerState, 
  amount: number, 
  sourceId: string | null,
  io?: Server
) {
  target.currentHp -= amount;
  
  if (target.currentHp <= 0) {
    handleDeath(game, target, io);
  }
}

function handleDeath(game: GameState, player: PlayerState, io?: Server) {
  player.isAlive = false;
  player.isRoleRevealed = true; 
  
  player.hand.forEach(c => game.discardPile.push(c));
  player.hand = [];
  player.equipment.forEach(c => game.discardPile.push(c));
  player.equipment = [];
  player.controlCards.forEach(c => game.discardPile.push(c));
  player.controlCards = [];

  // Очищаем pending attacks для умершего
  game.pendingAttacks?.delete(player.id);

  checkWinCondition(game);
  
  // Уведомляем всех о смерти
  if (io) {
    io.emit('playerDied', { playerId: player.id, role: player.role });
  }
}

function getMaxHp(player: PlayerState): number {
  const base = CHARACTER_HP[player.characterId!] || 4;
  return player.role === RoleType.ADMIN ? base + 1 : base;
}

function checkWinCondition(game: GameState) {
  const alivePlayers = game.players.filter(p => p.isAlive);
  const adminAlive = alivePlayers.some(p => p.role === RoleType.ADMIN);
  const hackersAlive = alivePlayers.some(p => p.role === RoleType.HACKER);
  const cyberpunkAlive = alivePlayers.some(p => p.role === RoleType.CYBERPUNK);

  if (!adminAlive) {
    if (alivePlayers.length === 1 && cyberpunkAlive) {
      game.winnerRoles = [RoleType.CYBERPUNK];
      game.phase = GamePhase.FINISHED;
    } else {
      game.winnerRoles = [RoleType.HACKER];
      game.phase = GamePhase.FINISHED;
    }
  } else if (!hackersAlive && !cyberpunkAlive) {
    game.winnerRoles = [RoleType.ADMIN, RoleType.DEPUTY];
    game.phase = GamePhase.FINISHED;
  }
}

function resolvePendingAttack(game: GameState, targetId: string, io?: Server) {
  const attacks = game.pendingAttacks?.get(targetId);
  if (!attacks || attacks.length === 0) return; // Защита уже сработала

  // Берем первую атаку из очереди и применяем
  const attack = attacks.shift();
  if (attack && io) {
    applyDamage(game, game.players.find(p => p.id === targetId)!, attack.amount, attack.sourceId, io);
    
    // Очищаем очередь, если она пуста
    if (attacks.length === 0) game.pendingAttacks.delete(targetId);
    
    // Рассылаем обновление состояния всем
    io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { gameState: game });
  }
}