// server/src/game/engine.ts
import { Server } from 'socket.io';
import {
  CardType,
  CharacterId,
  GameState,
  PlayerState,
  TurnPhase,
  GamePhase,
  RoleType,
  CHARACTER_HP,
  Suit,
  GAME_EVENTS,
  WEAPON_MAX_RANGE,
  CardInstance,
} from '@cyberbang/shared/types';

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Восстановление колоды из сброса */
export function refillDeck(game: GameState): void {
  if (game.deck.length === 0 && game.discardPile.length > 0) {
    game.deck = shuffle([...game.discardPile]);
    game.discardPile = [];
  }
}

/**
 * Начало хода текущего игрока
 */
export function startTurn(game: GameState, io?: Server): boolean {
  if (!game.currentTurnPlayerId) return false;
  const currentPlayer = game.players.find((p) => p.id === game.currentTurnPlayerId);
  if (!currentPlayer || !currentPlayer.isAlive) return false;

  // =========================================================================
  // 1. ПРОВЕРКА КАРТ КОНТРОЛЯ
  // =========================================================================

  // А) Сначала всегда проверяется LOGIC_BOMB (Динамит)
  const bombCard = currentPlayer.controlCards.find((c) => c.type === CardType.LOGIC_BOMB);
  if (bombCard) {
    refillDeck(game);
    const checkCard = game.deck.shift();

    if (checkCard) {
      game.discardPile.push(checkCard);

      if (io) {
        io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, {
          gameState: getSafeGameState(game),
        });
      }

      // Взрыв: Пики от 2 до 9
      const isSpade = checkCard.suit === Suit.SPADES;
      const rank = checkCard.rank || 0;
      const explodes = isSpade && rank >= 2 && rank <= 9;

      if (explodes) {
        console.log(`[Engine] Логическая бомба взорвалась на ${currentPlayer.nickname}!`);
        currentPlayer.controlCards = currentPlayer.controlCards.filter((c) => c.id !== bombCard.id);

        applyDamage(game, currentPlayer, 3, null, io);

        // Если игрок умер от взрыва — ход сразу переходит следующему, игра НЕ зависает!
        if (!currentPlayer.isAlive) {
          passTurnToNextAlive(game, io);
          return false;
        }
      } else {
        console.log(`[Engine] Логическая бомба не взорвалась. Передаём соседу.`);
        currentPlayer.controlCards = currentPlayer.controlCards.filter((c) => c.id !== bombCard.id);

        // Передаем следующему живому игроку
        const currentIndex = game.players.findIndex((p) => p.id === currentPlayer.id);
        let nextIndex = (currentIndex + 1) % game.players.length;
        let attempts = 0;

        while (
          (nextIndex === currentIndex || !game.players[nextIndex].isAlive) &&
          attempts < game.players.length
        ) {
          nextIndex = (nextIndex + 1) % game.players.length;
          attempts++;
        }

        if (attempts < game.players.length) {
          game.players[nextIndex].controlCards.push(bombCard);
        } else {
          game.discardPile.push(bombCard);
        }
      }
    }
  }

  // Б) Затем проверяется QUARANTINE (Тюрьма)
  const jailCard = currentPlayer.controlCards.find((c) => c.type === CardType.QUARANTINE);
  if (jailCard) {
    refillDeck(game);
    const checkCard = game.deck.shift();

    if (checkCard) {
      game.discardPile.push(checkCard);

      if (io) {
        io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, {
          gameState: getSafeGameState(game),
        });
      }

      currentPlayer.controlCards = currentPlayer.controlCards.filter((c) => c.id !== jailCard.id);

      if (checkCard.suit === Suit.HEARTS) {
        console.log(`[Engine] ${currentPlayer.nickname} вышел из Карантина (Черви)!`);
      } else {
        console.log(`[Engine] ${currentPlayer.nickname} пропускает ход в Карантине.`);
        passTurnToNextAlive(game, io);
        return false;
      }
    } else {
      currentPlayer.controlCards = currentPlayer.controlCards.filter((c) => c.id !== jailCard.id);
    }
  }

  // =========================================================================
  // 2. ФАЗА UPLOAD (Набор 2 карт)
  // =========================================================================
  game.turnPhase = TurnPhase.UPLOAD;
  refillDeck(game);
  for (let i = 0; i < 2; i++) {
    if (game.deck.length > 0) {
      currentPlayer.hand.push(game.deck.shift()!);
    }
  }

  // =========================================================================
  // 3. ПЕРЕХОД В EXECUTE (Розыгрыш)
  // =========================================================================
  game.turnPhase = TurnPhase.EXECUTE;
  currentPlayer.pingsPlayedThisTurn = 0;

  if (io) {
    io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, {
      gameState: getSafeGameState(game),
    });
  }

  return true;
}

/** Завершение хода */
export function endTurn(game: GameState, io?: Server): void {
  if (!game.currentTurnPlayerId) return;
  const currentPlayer = game.players.find((p) => p.id === game.currentTurnPlayerId);

  if (currentPlayer && currentPlayer.isAlive) {
    // PURGE: Сброс до лимита HP
    while (currentPlayer.hand.length > currentPlayer.currentHp) {
      const discarded = currentPlayer.hand.pop();
      if (discarded) game.discardPile.push(discarded);
    }
  }

  passTurnToNextAlive(game, io);
}

export function passTurnToNextAlive(game: GameState, io?: Server): void {
  const currentIndex = game.players.findIndex((p) => p.id === game.currentTurnPlayerId);
  let nextIndex = (currentIndex + 1) % game.players.length;

  let attempts = 0;
  while (!game.players[nextIndex].isAlive && attempts < game.players.length) {
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

  startTurn(game, io);
}

/**
 * Валидация и применение действия игрока
 */
export function playCard(
  game: GameState,
  playerId: string,
  cardId: string,
  targetId?: string,
  io?: Server
): { success: boolean; message?: string } {
  const player = game.players.find((p) => p.id === playerId);
  if (!player || !player.isAlive) return { success: false, message: 'Игрок не активен' };

  const cardIndex = player.hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return { success: false, message: 'Карты нет на руке' };
  const card = player.hand[cardIndex];

  // --- Логика PING! ---
  if (card.type === CardType.PING) {
    let maxPings = 1;
    const hasVolcanic = player.equipment.some((e) => e.type === CardType.VOLCANIC_IMPLANT);
    if (hasVolcanic) maxPings = 999;

    const isSpamBot = player.characterId === CharacterId.SPAM_BOT;
    if (isSpamBot) maxPings = Math.max(maxPings, 2);

    if (player.pingsPlayedThisTurn >= maxPings) {
      return { success: false, message: 'Лимит ПИНГов исчерпан' };
    }

    if (!targetId) return { success: false, message: 'Укажите цель для ПИНГа' };
    const target = game.players.find((p) => p.id === targetId);
    if (!target || !target.isAlive) return { success: false, message: 'Цель неактивна' };
    if (target.id === playerId) return { success: false, message: 'Нельзя стрелять в себя' };

    // Проверка дистанции
    const effectiveDistance = getEffectiveDistance(game.players, playerId, targetId);
    let maxRange = 1;
    const weapon = player.equipment.find((e) =>
      [
        CardType.SHORT_CIRCUIT,
        CardType.REMOTE_SHELL,
        CardType.LONG_LINK,
        CardType.VOLCANIC_IMPLANT,
      ].includes(e.type)
    );
    if (weapon && WEAPON_MAX_RANGE[weapon.type]) {
      maxRange = WEAPON_MAX_RANGE[weapon.type]!;
    }

    if (effectiveDistance > maxRange) {
      return {
        success: false,
        message: `Цель слишком далеко (дистанция ${effectiveDistance}, оружие бьет на ${maxRange})`,
      };
    }

    // Проверка PROXY_SERVER (Бочка)
    const targetHasProxy = target.equipment.some((e) => e.type === CardType.PROXY_SERVER);
    if (targetHasProxy && io) {
      refillDeck(game);
      const checkCard = game.deck.shift();
      if (checkCard) {
        game.discardPile.push(checkCard);
        if (checkCard.suit === Suit.HEARTS) {
          console.log(`[Engine] Прокси-сервер цели заблокировал атаку!`);
          io.emit('barrelDefenseSuccess', {
            playerId: targetId,
            cardSuit: Suit.HEARTS,
            attackerId: playerId,
          });

          player.hand.splice(cardIndex, 1);
          game.discardPile.push(card);
          player.pingsPlayedThisTurn++;

          if (io) {
            io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, {
              gameState: getSafeGameState(game),
            });
          }
          return { success: true, message: 'Атака заблокирована Прокси-сервером!' };
        }
      }
    }

    // Отложенная атака для возможности сыграть MISS (Файрволл)
    if (io) {
      io.to(target.id).emit('incomingAttack', {
        damage: 1,
        sourceId: playerId,
        requiredDefense: CardType.MISS,
      });

      if (!game.pendingAttacks) game.pendingAttacks = new Map();
      if (!game.pendingAttacks.has(target.id)) game.pendingAttacks.set(target.id, []);

      game.pendingAttacks.get(target.id)!.push({
        amount: 1,
        sourceId: playerId,
        barrelChecked: true,
        requiredDefense: CardType.MISS,
      });

      setTimeout(() => resolvePendingAttack(game, target.id, io), 11000);
    }

    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);
    player.pingsPlayedThisTurn++;
    return { success: true };
  }

  // --- SERVER_ROOM (Серверная комната — лечение всех) ---
  if (card.type === CardType.SERVER_ROOM) {
    if (game.currentTurnPlayerId !== playerId || game.turnPhase !== TurnPhase.EXECUTE) {
      return { success: false, message: 'Серверную комнату можно играть только в свой ход' };
    }

    game.players.forEach((p) => {
      if (p.isAlive && p.currentHp < p.maxHp) {
        p.currentHp += 1;
      }
    });

    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);

    if (io) {
      io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, {
        gameState: getSafeGameState(game),
      });
    }
    return { success: true };
  }

  // --- FLAK_TURRET (Зенитная турель — массовый выстрел) ---
  if (card.type === CardType.FLAK_TURRET) {
    if (game.currentTurnPlayerId !== playerId || game.turnPhase !== TurnPhase.EXECUTE) {
      return { success: false, message: 'Массовые карты можно играть только в свой ход' };
    }

    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);

    game.players.forEach((target) => {
      if (target.id !== playerId && target.isAlive) {
        if (!game.pendingAttacks) game.pendingAttacks = new Map();
        if (!game.pendingAttacks.has(target.id)) game.pendingAttacks.set(target.id, []);

        game.pendingAttacks.get(target.id)!.push({
          amount: 1,
          sourceId: playerId,
          requiredDefense: CardType.MISS,
        });

        if (io) {
          io.to(target.id).emit('incomingAttack', {
            damage: 1,
            sourceId: playerId,
            isMassive: true,
            cardType: CardType.FLAK_TURRET,
            requiredDefense: CardType.MISS,
          });
          setTimeout(() => resolvePendingAttack(game, target.id, io), 11000);
        }
      }
    });

    return { success: true };
  }

  // --- DDOS (DDoS-атака — требует сбросить PING) ---
  if (card.type === CardType.DDOS) {
    if (game.currentTurnPlayerId !== playerId || game.turnPhase !== TurnPhase.EXECUTE) {
      return { success: false, message: 'Массовые карты можно играть только в свой ход' };
    }

    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);

    game.players.forEach((target) => {
      if (target.id !== playerId && target.isAlive) {
        if (!game.pendingAttacks) game.pendingAttacks = new Map();
        if (!game.pendingAttacks.has(target.id)) game.pendingAttacks.set(target.id, []);

        game.pendingAttacks.get(target.id)!.push({
          amount: 1,
          sourceId: playerId,
          requiredDefense: CardType.PING,
        });

        if (io) {
          io.to(target.id).emit('incomingAttack', {
            damage: 1,
            sourceId: playerId,
            isMassive: true,
            cardType: CardType.DDOS,
            requiredDefense: CardType.PING,
          });
          setTimeout(() => resolvePendingAttack(game, target.id, io), 11000);
        }
      }
    });

    return { success: true };
  }

  // --- DATA_STREAM (2 карты) ---
  if (card.type === CardType.DATA_STREAM) {
    if (game.currentTurnPlayerId !== playerId || game.turnPhase !== TurnPhase.EXECUTE) {
      return { success: false, message: 'Карту можно играть только в свой ход' };
    }
    refillDeck(game);
    for (let i = 0; i < 2; i++) {
      if (game.deck.length > 0) player.hand.push(game.deck.shift()!);
    }
    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);
    return { success: true };
  }

  // --- DEEP_BACKDOOR (3 карты) ---
  if (card.type === CardType.DEEP_BACKDOOR) {
    if (game.currentTurnPlayerId !== playerId || game.turnPhase !== TurnPhase.EXECUTE) {
      return { success: false, message: 'Карту можно играть только в свой ход' };
    }
    refillDeck(game);
    for (let i = 0; i < 3; i++) {
      if (game.deck.length > 0) player.hand.push(game.deck.shift()!);
    }
    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);
    return { success: true };
  }

  // --- VPN (Паника — кража карты на дистанции 1) ---
  if (card.type === CardType.VPN) {
    if (game.currentTurnPlayerId !== playerId || game.turnPhase !== TurnPhase.EXECUTE) {
      return { success: false, message: 'Эту карту можно играть только в свой ход' };
    }
    if (!targetId) return { success: false, message: 'Укажите цель для VPN' };
    const target = game.players.find((p) => p.id === targetId);
    if (!target || !target.isAlive) return { success: false, message: 'Цель неактивна' };

    // Проверка дистанции: должна быть строго 1
    const dist = getEffectiveDistance(game.players, playerId, targetId);
    if (dist > 1) {
      return { success: false, message: `VPN работает только на дистанции 1 (текущая: ${dist})` };
    }

    if (target.hand.length === 0 && target.equipment.length === 0) {
      return { success: false, message: 'У цели нет карт для кражи' };
    }

    // Кража случайной карты из руки
    if (target.hand.length > 0) {
      const stolen = target.hand.splice(Math.floor(Math.random() * target.hand.length), 1)[0];
      player.hand.push(stolen);
    }

    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);
    return { success: true };
  }

  // --- SOCIAL_ENGINEERING (Заставить сбросить карту) ---
  if (card.type === CardType.SOCIAL_ENGINEERING) {
    if (game.currentTurnPlayerId !== playerId || game.turnPhase !== TurnPhase.EXECUTE) {
      return { success: false, message: 'Использовать можно только в свой ход' };
    }
    if (!targetId) return { success: false, message: 'Укажите цель' };
    const target = game.players.find((p) => p.id === targetId);
    if (!target || !target.isAlive) return { success: false, message: 'Цель неактивна' };

    if (target.hand.length > 0) {
      const discarded = target.hand.splice(Math.floor(Math.random() * target.hand.length), 1)[0];
      game.discardPile.push(discarded);
    }

    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);
    return { success: true };
  }

  // --- STIMULANT (Пиво) ---
  if (card.type === CardType.STIMULANT) {
    const aliveCount = game.players.filter((p) => p.isAlive).length;
    if (aliveCount <= 2) {
      return { success: false, message: 'Стимулянт не восстанавливает здоровье при 2 игроках' };
    }

    const isCritical = player.isDying || player.currentHp <= 0;
    const isMyTurn = game.currentTurnPlayerId === playerId;

    if (!isMyTurn && !isCritical) {
      return { success: false, message: 'Стимулянт можно играть только в свой ход или при смерти' };
    }

    if (isCritical) {
      player.currentHp = 1;
      player.isDying = false;
    } else {
      if (player.currentHp >= player.maxHp) {
        return { success: false, message: 'Здоровье уже максимальное' };
      }
      player.currentHp += 1;
    }

    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);
    return { success: true };
  }

  // --- MISS! (Файрволл — защита) ---
  if (card.type === CardType.MISS) {
    const pendingAttacks = game.pendingAttacks?.get(playerId);
    if (!pendingAttacks || pendingAttacks.length === 0) {
      return { success: false, message: 'Нет активной атаки для отмены' };
    }

    pendingAttacks.pop();
    if (pendingAttacks.length === 0) {
      game.pendingAttacks?.delete(playerId);
    }

    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);

    if (io) {
      io.emit('defenseSuccess', { playerId, cardType: CardType.MISS });
    }
    return { success: true };
  }

  // --- ПОСТОЯННЫЕ КАРТЫ (Оружие, Призрак, Прицел, Прокси) ---
  const isPermanent = [
    CardType.SHORT_CIRCUIT,
    CardType.REMOTE_SHELL,
    CardType.LONG_LINK,
    CardType.VOLCANIC_IMPLANT,
    CardType.GHOST_PROTOCOL,
    CardType.SNIPER_SCOPE,
    CardType.PROXY_SERVER,
  ].includes(card.type);

  if (isPermanent) {
    if (game.currentTurnPlayerId !== playerId || game.turnPhase !== TurnPhase.EXECUTE) {
      return { success: false, message: 'Постоянные карты можно играть только в свой ход' };
    }

    const isWeapon = [
      CardType.SHORT_CIRCUIT,
      CardType.REMOTE_SHELL,
      CardType.LONG_LINK,
      CardType.VOLCANIC_IMPLANT,
    ].includes(card.type);

    if (isWeapon) {
      const currentWeaponIndex = player.equipment.findIndex((e) =>
        [
          CardType.SHORT_CIRCUIT,
          CardType.REMOTE_SHELL,
          CardType.LONG_LINK,
          CardType.VOLCANIC_IMPLANT,
        ].includes(e.type)
      );
      if (currentWeaponIndex !== -1) {
        const oldWeapon = player.equipment.splice(currentWeaponIndex, 1)[0];
        game.discardPile.push(oldWeapon);
      }
    }

    if (card.type === CardType.GHOST_PROTOCOL && player.equipment.some((e) => e.type === CardType.GHOST_PROTOCOL)) {
      return { success: false, message: 'Протокол «Призрак» уже установлен' };
    }
    if (card.type === CardType.SNIPER_SCOPE && player.equipment.some((e) => e.type === CardType.SNIPER_SCOPE)) {
      return { success: false, message: 'Снайперский модуль уже установлен' };
    }
    if (card.type === CardType.PROXY_SERVER && player.equipment.some((e) => e.type === CardType.PROXY_SERVER)) {
      return { success: false, message: 'Прокси-сервер уже установлен' };
    }

    player.hand.splice(cardIndex, 1);
    player.equipment.push(card);
    return { success: true };
  }

  // --- КАРТЫ КОНТРОЛЯ (Quarantine, Logic Bomb) ---
  if (card.type === CardType.LOGIC_BOMB) {
    if (game.currentTurnPlayerId !== playerId || game.turnPhase !== TurnPhase.EXECUTE) {
      return { success: false, message: 'Карту контроля можно играть только в свой ход' };
    }
    player.hand.splice(cardIndex, 1);
    player.controlCards.push(card);
    return { success: true };
  }

  if (card.type === CardType.QUARANTINE) {
    if (!targetId) return { success: false, message: 'Выберите цель для Карантина' };
    target = game.players.find(p => p.id === targetId && p.isAlive);
    if (!target) return { success: false, message: 'Цель не найдена' };
    if (target.id === playerId) return { success: false, message: 'Нельзя посадить в карантин себя' };
    if (target.role === RoleType.ADMIN) return { success: false, message: 'Администратора нельзя изолировать в карантин' };
    if (target.controlCards.some(c => c.type === CardType.QUARANTINE)) {
      return { success: false, message: 'Игрок уже находится в карантине' };
    }
  
    player.hand.splice(cardIndex, 1);
    target.controlCards.push(card);
    return { success: true };
  }

  return { success: false, message: 'Неподдерживаемая карта для этого действия' };
}

/** Нанесение урона */
export function applyDamage(
  game: GameState,
  target: PlayerState,
  amount: number,
  sourceId: string | null,
  io?: Server
) {
  target.currentHp -= amount;

  // Если HP <= 0, даём шанс спастись Стимулянтом
  if (target.currentHp <= 0 && io && !target.isDying) {
    target.isDying = true;
    io.to(target.id).emit('criticalDamage', {
      currentHp: target.currentHp,
      sourceId,
    });

    setTimeout(() => {
      if (target.isDying && target.currentHp <= 0) {
        handleDeath(game, target, sourceId, io);
        if (io) {
          io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, {
            gameState: getSafeGameState(game),
          });
        }
      }
    }, 8000);

    return;
  }

  if (target.currentHp <= 0) {
    handleDeath(game, target, sourceId, io);
  }
}

/** Обработка смерти игрока, наград и штрафов */
function handleDeath(game: GameState, victim: PlayerState, killerId: string | null, io?: Server) {
  victim.isAlive = false;
  victim.isRoleRevealed = true;

  // Сброс всех карт жертвы
  victim.hand.forEach((c) => game.discardPile.push(c));
  victim.hand = [];
  victim.equipment.forEach((c) => game.discardPile.push(c));
  victim.equipment = [];
  victim.controlCards.forEach((c) => game.discardPile.push(c));
  victim.controlCards = [];
  game.pendingAttacks?.delete(victim.id);

  // Награды и штрафы
  if (killerId) {
    const killer = game.players.find((p) => p.id === killerId);
    if (killer && killer.isAlive) {
      // Награда: убил Хакера -> берет 3 карты из колоды
      if (victim.role === RoleType.HACKER) {
        console.log(`[Engine] ${killer.nickname} убил Хакера и получает 3 карты!`);
        refillDeck(game);
        for (let i = 0; i < 3; i++) {
          if (game.deck.length > 0) killer.hand.push(game.deck.shift()!);
        }
      }

      // Штраф: Админ убил Агента (Deputy) -> сбрасывает все карты
      if (killer.role === RoleType.ADMIN && victim.role === RoleType.DEPUTY) {
        console.log(`[Engine] Админ убил своего Агента! Штраф: сброс всех карт.`);
        killer.hand.forEach((c) => game.discardPile.push(c));
        killer.hand = [];
        killer.equipment.forEach((c) => game.discardPile.push(c));
        killer.equipment = [];
      }
    }
  }

  checkWinCondition(game);

  if (io) {
    io.emit('playerDied', { playerId: victim.id, role: victim.role });
  }
}

function checkWinCondition(game: GameState) {
  const alivePlayers = game.players.filter((p) => p.isAlive);
  const adminAlive = alivePlayers.some((p) => p.role === RoleType.ADMIN);
  const hackersAlive = alivePlayers.some((p) => p.role === RoleType.HACKER);
  const cyberpunkAlive = alivePlayers.some((p) => p.role === RoleType.CYBERPUNK);

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
  if (!attacks || attacks.length === 0) return;

  const attack = attacks.shift();
  if (!attack || !io) return;

  const target = game.players.find((p) => p.id === targetId);
  if (!target || !target.isAlive) {
    if (attacks.length === 0) game.pendingAttacks?.delete(targetId);
    return;
  }

  applyDamage(game, target, attack.amount, attack.sourceId, io);

  if (attacks.length === 0) game.pendingAttacks?.delete(targetId);

  io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, {
    gameState: getSafeGameState(game),
  });
}

/** Расчет дистанции с учетом всех модификаторов */
export function getEffectiveDistance(
  players: PlayerState[],
  fromId: string,
  toId: string
): number {
  if (fromId === toId) return 0;

  const alivePlayers = players
    .filter((p) => p.isAlive)
    .sort((a, b) => a.seatIndex - b.seatIndex);

  const fromIndex = alivePlayers.findIndex((p) => p.id === fromId);
  const toIndex = alivePlayers.findIndex((p) => p.id === toId);
  if (fromIndex === -1 || toIndex === -1) return 999;

  const totalAlive = alivePlayers.length;
  const clockwise = (toIndex - fromIndex + totalAlive) % totalAlive;
  const counterClockwise = (fromIndex - toIndex + totalAlive) % totalAlive;
  let dist = Math.min(clockwise, counterClockwise);

  const attacker = players.find((p) => p.id === fromId);
  const target = players.find((p) => p.id === toId);

  // Ghost Protocol (+1 к дистанции до цели)
  if (target?.equipment.some((e) => e.type === CardType.GHOST_PROTOCOL)) {
    dist += 1;
  }

  // Sniper Scope (-1 к дистанции от атакующего, минимум 1)
  if (attacker?.equipment.some((e) => e.type === CardType.SNIPER_SCOPE)) {
    dist = Math.max(1, dist - 1);
  }

  return dist;
}

/** Безопасная сериализация Map для сокетов */
export function getSafeGameState(game: GameState) {
  return {
    ...game,
    pendingAttacks: Object.fromEntries(game.pendingAttacks || []),
    pendingSocialEngineering: Object.fromEntries(game.pendingSocialEngineering || []),
  };
}