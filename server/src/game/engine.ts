// server/src/game/engine.ts
import { Server } from 'socket.io';
import {
  CardType, CharacterId, GameState, PlayerState, TurnPhase, GamePhase, RoleType,
  CHARACTER_HP, Suit, GAME_EVENTS, WEAPON_MAX_RANGE
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
 * Восстановление колоды из сброса
 */
function refillDeck(game: GameState): void {
  if (game.deck.length === 0 && game.discardPile.length > 0) {
    game.deck = shuffle([...game.discardPile]);
    game.discardPile = [];
  }
}

/**
 * Начало хода текущего игрока
 * ВАЖНО: Принимает io для отправки событий проверки (визуализация)
 */
export function startTurn(game: GameState, io?: Server): boolean {
  if (!game.currentTurnPlayerId) return false;

  const currentPlayer = game.players.find(p => p.id === game.currentTurnPlayerId);
  if (!currentPlayer || !currentPlayer.isAlive) return false; 

  // ▼▼▼ 1. ПРОВЕРКА КАРТ КОНТРОЛЯ (Тюрьма и Динамит) ▼▼▼
  
  // А) Проверка QUARANTINE (Тюрьма)
  // Логика: Если выпали Черви -> свобода (ход идет). Иначе -> пропуск хода.
  // В обоих случаях карта уходит в сброс после проверки.
  const jailCard = currentPlayer.controlCards.find(c => c.type === CardType.QUARANTINE);
  if (jailCard) {
    refillDeck(game);
    const checkCard = game.deck.shift();
    
    if (checkCard) {
      game.discardPile.push(checkCard);
      
      // Отправляем обновление состояния для анимации на клиенте
      if (io) {
        io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { gameState: game });
      }

      if (checkCard.suit === Suit.HEARTS) {
        console.log(`[Engine] ${currentPlayer.nickname} passed Quarantine check! Free to go.`);
        // Черви: освобождаемся, карта уходит в сброс (фильтр ниже), ход ПРОДОЛЖАЕТСЯ
      } else {
        console.log(`[Engine] ${currentPlayer.nickname} failed Quarantine check. Turn skipped.`);
        // Не Черви: карта уходит в сброс (фильтр ниже), ход ПРОПУСКАЕМ
        // Удаляем карту и возвращаем false
        currentPlayer.controlCards = currentPlayer.controlCards.filter(c => c.id !== jailCard.id);
        return false; 
      }
    }
    // Если проверка прошла (или нечего было тянуть), удаляем карту Тюрьмы
    currentPlayer.controlCards = currentPlayer.controlCards.filter(c => c.id !== jailCard.id);
  }

  // Б) Проверка LOGIC_BOMB (Динамит)
  // Логика: Проверяем ПЕРЕД Тюрьмой (как в правилах: "первым проверяйте Динамит").
  // Если взрыв -> 3 урона. Если нет -> передаем следующему.
  const bombCard = currentPlayer.controlCards.find(c => c.type === CardType.LOGIC_BOMB);
  if (bombCard) {
    refillDeck(game);
    const checkCard = game.deck.shift();
    
    if (checkCard) {
      game.discardPile.push(checkCard);
      
      if (io) {
        io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { gameState: game });
      }

      // Взрыв на Пиках от 2 до 9
      const isSpade = checkCard.suit === Suit.SPADES;
      const rank = checkCard.rank || 0;
      const explodes = isSpade && rank >= 2 && rank <= 9;

      if (explodes) {
        console.log(`[Engine] LOGIC BOMB exploded on ${currentPlayer.nickname}! (${checkCard.rank} of ${checkCard.suit})`);
        
        // Наносим 3 урона. SourceId = null (ловушка)
        applyDamage(game, currentPlayer, 3, null, io); 
        
        // Бомба уходит в сброс после взрыва
        currentPlayer.controlCards = currentPlayer.controlCards.filter(c => c.id !== bombCard.id);
        
        // Если игрок умер, ход прерывается
        if (!currentPlayer.isAlive) return false;
        
      } else {
        console.log(`[Engine] Logic Bomb safe for ${currentPlayer.nickname}. Passing to next player.`);
        
        // НЕ ВЗОРВАЛАСЬ -> Передаем следующему живому игроку по часовой стрелке
        const currentIndex = game.players.findIndex(p => p.id === currentPlayer.id);
        let nextIndex = (currentIndex + 1) % game.players.length;
        let attempts = 0;
        
        // Ищем следующего живого игрока (не себя)
        while ((nextIndex === currentIndex || !game.players[nextIndex].isAlive) && attempts < game.players.length) {
          nextIndex = (nextIndex + 1) % game.players.length;
          attempts++;
        }

        if (attempts < game.players.length) {
          const nextPlayer = game.players[nextIndex];
          // Удаляем у текущего
          currentPlayer.controlCards = currentPlayer.controlCards.filter(c => c.id !== bombCard.id);
          // Добавляем следующему
          nextPlayer.controlCards.push(bombCard);
          console.log(`[Engine] Logic Bomb moved to ${nextPlayer.nickname}`);
        } else {
          // Если все остальные мертвы (редкий кейс), просто удаляем
          currentPlayer.controlCards = currentPlayer.controlCards.filter(c => c.id !== bombCard.id);
        }
      }
    }
  }
  // ▲▲▲ КОНЕЦ ПРОВЕРКИ КАРТ КОНТРОЛЯ ▲▲▲

  // ▼▼▼ 2. ФАЗА UPLOAD (Набор карт) ▼▼▼
  game.turnPhase = TurnPhase.UPLOAD;
  
  refillDeck(game);
  for (let i = 0; i < 2; i++) {
    if (game.deck.length > 0) {
      currentPlayer.hand.push(game.deck.shift()!);
    }
  }
  
  // ▼▼▼ 3. ПЕРЕХОД В EXECUTE ▼▼▼
  game.turnPhase = TurnPhase.EXECUTE;
  currentPlayer.pingsPlayedThisTurn = 0;

  return true;
}

/**
 * Завершение хода
 */
export function endTurn(game: GameState): void {
  if (!game.currentTurnPlayerId) return;
  const currentPlayer = game.players.find(p => p.id === game.currentTurnPlayerId);
  
  if (currentPlayer && currentPlayer.isAlive) {
    // Фаза PURGE (Сброс лишнего)
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
  
  // Передаем ход. io здесь может быть undefined, если вызов идет из рекурсии,
  // но для MVP это допустимо (проверки пройдут без визуализации, но логически верно).
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
  io?: Server
): { success: boolean; message?: string } {
  
  const player = game.players.find(p => p.id === playerId);
  if (!player || !player.isAlive) return { success: false, message: 'Игрок не активен' };
  
  const cardIndex = player.hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return { success: false, message: 'Карты нет на руке' };

  const card = player.hand[cardIndex];

  // --- Логика PING! ---
  if (card.type === CardType.PING) {
    let maxPings = 1;
    
    const hasVolcanic = player.equipment.some(e => e.type === CardType.VOLCANIC_IMPLANT);
    if (hasVolcanic) maxPings = 999;
    
    const isSpamBot = player.characterId === CharacterId.SPAM_BOT;
    if (isSpamBot) maxPings = Math.max(maxPings, 2);

    if (player.pingsPlayedThisTurn >= maxPings) {
      return { success: false, message: 'Лимит ПИНГов исчерпан' };
    }

    if (!targetId) return { success: false, message: 'Укажите цель для ПИНГа' };
    
    const target = game.players.find(p => p.id === targetId);
    if (!target || !target.isAlive) return { success: false, message: 'Цель неактивна' };
    if (target.id === playerId) return { success: false, message: 'Нельзя стрелять в себя' };

    // ПРОВЕРКА ДИСТАНЦИИ И ОРУЖИЯ
    const distance = calculateDistance(game.players, playerId, targetId);
    let effectiveDistance = distance;
    
    let maxRange = 1;
    const weapon = player.equipment.find(e => 
      [CardType.SHORT_CIRCUIT, CardType.REMOTE_SHELL, CardType.LONG_LINK, CardType.VOLCANIC_IMPLANT].includes(e.type)
    );
    
    if (weapon && WEAPON_MAX_RANGE[weapon.type]) {
      maxRange = WEAPON_MAX_RANGE[weapon.type]!;
    }

    const hasScope = player.equipment.some(e => e.type === CardType.SNIPER_SCOPE);
    if (hasScope && effectiveDistance > 1) effectiveDistance -= 1;

    const targetHasMustang = target.equipment.some(e => e.type === CardType.GHOST_PROTOCOL);
    if (targetHasMustang) effectiveDistance += 1;

    if (effectiveDistance > maxRange) {
      return { success: false, message: `Цель слишком далеко (дистанция ${effectiveDistance}, макс ${maxRange})` };
    }

    // ПРОВЕРКА BARREL (Прокси-сервер) ПЕРЕД АТАКОЙ
    const targetHasProxy = target.equipment.some(e => e.type === CardType.PROXY_SERVER);
    if (targetHasProxy && io) {
      refillDeck(game);
      const checkCard = game.deck.shift();
      
      if (checkCard) {
        game.discardPile.push(checkCard);
        
        if (checkCard.suit === Suit.HEARTS) {
          console.log(`[Engine] Proxy Server blocked attack instantly!`);
          
          io.emit('barrelDefenseSuccess', { 
            playerId: targetId, 
            cardSuit: Suit.HEARTS,
            attackerId: playerId 
          });
          
          io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { gameState: game });
          
          player.hand.splice(cardIndex, 1);
          game.discardPile.push(card);
          player.pingsPlayedThisTurn++;
          
          return { success: true, message: 'Атака заблокирована Прокси-сервером!' };
        }
      }
    }

    // СОЗДАЕМ ОТЛОЖЕННУЮ АТАКУ
    if (io) {
      io.to(target.id).emit('incomingAttack', { damage: 1, sourceId: playerId });
      
      if (!game.pendingAttacks) game.pendingAttacks = new Map();
      if (!game.pendingAttacks.has(target.id)) game.pendingAttacks.set(target.id, []);
      
      game.pendingAttacks.get(target.id)!.push({ 
        amount: 1, 
        sourceId: playerId,
        barrelChecked: true 
      });
      
      setTimeout(() => resolvePendingAttack(game, target.id, io), 11000); 
    }

    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);
    player.pingsPlayedThisTurn++;
    
    return { success: true };
  }

  // --- Логика FLAK_TURRET (Зенитная турель) ---
  if (card.type === CardType.FLAK_TURRET) {
    if (game.currentTurnPlayerId !== playerId || game.turnPhase !== TurnPhase.EXECUTE) {
      return { success: false, message: 'Массовые карты можно играть только в свой ход' };
    }

    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);
    console.log(`[Engine] ${player.nickname} activated FLAK_TURRET!`);

    game.players.forEach(target => {
      if (target.id !== playerId && target.isAlive) {
        if (!game.pendingAttacks) game.pendingAttacks = new Map();
        if (!game.pendingAttacks.has(target.id)) game.pendingAttacks.set(target.id, []);
        
        game.pendingAttacks.get(target.id)!.push({ 
          amount: 1, 
          sourceId: playerId,
          requiredDefense: CardType.MISS 
        });

        if (io) {
          io.to(target.id).emit('incomingAttack', { 
            damage: 1, 
            sourceId: playerId, 
            isMassive: true,
            cardType: CardType.FLAK_TURRET,
            requiredDefense: CardType.MISS 
          });
          setTimeout(() => resolvePendingAttack(game, target.id, io), 11000); 
        }
      }
    });
    return { success: true };
  }

  // --- Логика DDOS (DDoS-атака) ---
  if (card.type === CardType.DDOS) {
    if (game.currentTurnPlayerId !== playerId || game.turnPhase !== TurnPhase.EXECUTE) {
      return { success: false, message: 'Массовые карты можно играть только в свой ход' };
    }

    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);
    console.log(`[Engine] ${player.nickname} launched DDOS attack!`);

    game.players.forEach(target => {
      if (target.id !== playerId && target.isAlive) {
        if (!game.pendingAttacks) game.pendingAttacks = new Map();
        if (!game.pendingAttacks.has(target.id)) game.pendingAttacks.set(target.id, []);
        
        game.pendingAttacks.get(target.id)!.push({ 
          amount: 1, 
          sourceId: playerId,
          requiredDefense: CardType.PING 
        });

        if (io) {
          io.to(target.id).emit('incomingAttack', { 
            damage: 1, 
            sourceId: playerId, 
            isMassive: true,
            cardType: CardType.DDOS,
            requiredDefense: CardType.PING 
          });
          setTimeout(() => resolvePendingAttack(game, target.id, io), 11000); 
        }
      }
    });
    return { success: true };
  }

  // --- Логика DATA_STREAM (Поток данных) ---
  if (card.type === CardType.DATA_STREAM) {
    if (game.currentTurnPlayerId !== playerId || game.turnPhase !== TurnPhase.EXECUTE) {
      return { success: false, message: 'Карты действий можно играть только в свой ход' };
    }

    // Добираем 2 карты
    refillDeck(game);
    for (let i = 0; i < 2; i++) {
      if (game.deck.length > 0) {
        player.hand.push(game.deck.shift()!);
      }
    }

    console.log(`[Engine] ${player.nickname} played DATA_STREAM and drew 2 cards`);

    // Тратим карту
    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);

    if (io) {
      io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { gameState: game });
    }

    return { success: true };
  }

  // --- Логика DEEP_BACKDOOR (Глубокий бэкдор) ---
  if (card.type === CardType.DEEP_BACKDOOR) {
    if (game.currentTurnPlayerId !== playerId || game.turnPhase !== TurnPhase.EXECUTE) {
      return { success: false, message: 'Карты действий можно играть только в свой ход' };
    }

    // Добираем 3 карты
    refillDeck(game);
    for (let i = 0; i < 3; i++) {
      if (game.deck.length > 0) {
        player.hand.push(game.deck.shift()!);
      }
    }

    console.log(`[Engine] ${player.nickname} played DEEP_BACKDOOR and drew 3 cards`);

    // Тратим карту
    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);

    if (io) {
      io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { gameState: game });
    }

    return { success: true };
  }

  // --- Логика SOCIAL_ENGINEERING (Социальная инженерия) ---
  if (card.type === CardType.SOCIAL_ENGINEERING) {
    if (game.currentTurnPlayerId !== playerId || game.turnPhase !== TurnPhase.EXECUTE) {
      return { success: false, message: 'Социальную инженерию можно использовать только в свой ход' };
    }

    if (!targetId) return { success: false, message: 'Укажите цель для социальной инженерии' };
    
    const target = game.players.find(p => p.id === targetId);
    if (!target || !target.isAlive) return { success: false, message: 'Цель неактивна' };
    if (target.id === playerId) return { success: false, message: 'Нельзя использовать на себя' };

    // Проверяем, есть ли у цели карты для сброса
    const hasCards = target.hand.length > 0 || 
                     target.equipment.length > 0 || 
                     target.controlCards.length > 0;
    
    if (!hasCards) {
      return { success: false, message: 'У цели нет карт для сброса' };
    }

    // Создаём запрос на выбор карты
    if (!game.pendingSocialEngineering) game.pendingSocialEngineering = new Map();
    
    game.pendingSocialEngineering.set(targetId, {
      sourceId: playerId,
      cardId: card.id,
      timestamp: Date.now()
    });

    console.log(`[Engine] ${player.nickname} used SOCIAL_ENGINEERING on ${target.nickname}`);

    // Отправляем событие цели
    if (io) {
      io.to(targetId).emit('socialEngineeringRequest', {
        sourceId: playerId,
        timeout: 15000 // 15 секунд на выбор
      });
    }

    // Тратим карту SOCIAL_ENGINEERING
    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);

    if (io) {
      io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { gameState: game });
    }

    // Запускаем таймаут (если цель не выберет карту)
    setTimeout(() => {
      resolveSocialEngineering(game, targetId, io);
    }, 15000);

    return { success: true };
  }
  
  // --- Логика BLACK_MARKET (Чёрный Рынок) ---
  if (card.type === CardType.BLACK_MARKET) {
    if (game.currentTurnPlayerId !== playerId || game.turnPhase !== TurnPhase.EXECUTE) {
      return { success: false, message: 'Чёрный Рынок можно открыть только в свой ход' };
    }

    const alivePlayers = game.players.filter(p => p.isAlive);
    const cardsToReveal = Math.min(alivePlayers.length, game.deck.length);

    if (cardsToReveal === 0) {
      return { success: false, message: 'В колоде нет карт для рынка' };
    }

    // Снимаем карты с верха колоды
    const marketCards = [];
    for (let i = 0; i < cardsToReveal; i++) {
      marketCards.push(game.deck.shift()!);
    }

    // Находим индекс инициатора среди живых игроков, чтобы начать очередь с него
    const initiatorIndex = alivePlayers.findIndex(p => p.id === playerId);

    // Сохраняем состояние рынка
    game.marketCards = marketCards;
    game.marketPickerIndex = initiatorIndex; // Начинает тот, кто сыграл
    game.marketInitiatorId = playerId;
    
    // Переключаем фазу
    game.turnPhase = TurnPhase.MARKET;

    console.log(`[Engine] ${player.nickname} opened Black Market with ${cardsToReveal} cards`);

    if (io) {
      io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { gameState: game });
    }

    // Карта рынка уходит в сброс сразу при открытии
    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);

    return { success: true };
  }

  // --- Логика VPN (Кража карты) ---
if (card.type === CardType.VPN) {
  if (game.currentTurnPlayerId !== playerId || game.turnPhase !== TurnPhase.EXECUTE) {
    return { success: false, message: 'Эту карту можно играть только в свой ход' };
  }

  if (!targetId) return { success: false, message: 'Укажите цель для кражи' };
  
  const target = game.players.find(p => p.id === targetId);
  if (!target || !target.isAlive) return { success: false, message: 'Цель неактивна' };
  if (target.hand.length === 0) return { success: false, message: 'У цели нет карт для кражи' };

  // Крадем случайную карту
  const randomIndex = Math.floor(Math.random() * target.hand.length);
  const stolenCard = target.hand.splice(randomIndex, 1)[0];
  
  // Добавляем украденную карту в руку игрока
  player.hand.push(stolenCard);
  
  console.log(`[Engine] ${player.nickname} stole a card from ${target.nickname}`);

  // Тратим карту VPN
  player.hand.splice(cardIndex, 1);
  game.discardPile.push(card);

  if (io) {
    io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { gameState: game });
  }

  return { success: true };
}

  // --- Логика STIMULANT (Пиво) ---
  if (card.type === CardType.STIMULANT) {
    const aliveCount = game.players.filter(p => p.isAlive).length;
    if (aliveCount <= 2) {
      return { success: false, message: 'Стимулянт не работает при 2 игроках' };
    }

    const isCritical = player.isDying || player.currentHp <= 0;
    const isMyTurn = game.currentTurnPlayerId === playerId;
    
    if (!isMyTurn && !isCritical) {
      return { success: false, message: 'Стимулянт можно играть только в свой ход или при смертельном уроне' };
    }

    if (isCritical) {
      player.currentHp = 1;
      player.isDying = false;
    } else {
      if (player.currentHp >= getMaxHp(player)) {
        return { success: false, message: 'Здоровье уже полное' };
      }
      player.currentHp += 1;
    }

    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);
    return { success: true };
  }

  // --- Логика MISS! (Файрволл) ---
  if (card.type === CardType.MISS) {
    const pendingAttacks = game.pendingAttacks?.get(playerId);
    if (!pendingAttacks || pendingAttacks.length === 0) {
      return { success: false, message: 'Нет активной атаки для отмены' };
    }

    pendingAttacks.pop();
    if (pendingAttacks.length === 0) {
      game.pendingAttacks.delete(playerId);
    }

    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);
    
    if (io) {
      io.emit('defenseSuccess', { playerId, cardType: CardType.MISS });
    }
    
    return { success: true };
  }
  
  // --- Логика ПОСТОЯННЫХ КАРТ (Оружие и Модификаторы) ---
  const isPermanent = [
    CardType.SHORT_CIRCUIT, CardType.REMOTE_SHELL, CardType.LONG_LINK, CardType.VOLCANIC_IMPLANT,
    CardType.GHOST_PROTOCOL, CardType.SNIPER_SCOPE, CardType.PROXY_SERVER
  ].includes(card.type);

  if (isPermanent) {
    if (game.currentTurnPlayerId !== playerId || game.turnPhase !== TurnPhase.EXECUTE) {
      return { success: false, message: 'Постоянные карты можно играть только в свой ход' };
    }

    const isWeapon = [CardType.SHORT_CIRCUIT, CardType.REMOTE_SHELL, CardType.LONG_LINK, CardType.VOLCANIC_IMPLANT].includes(card.type);

    if (isWeapon) {
      const currentWeaponIndex = player.equipment.findIndex(e => 
        [CardType.SHORT_CIRCUIT, CardType.REMOTE_SHELL, CardType.LONG_LINK, CardType.VOLCANIC_IMPLANT].includes(e.type)
      );
      
      if (currentWeaponIndex !== -1) {
        const oldWeapon = player.equipment.splice(currentWeaponIndex, 1)[0];
        game.discardPile.push(oldWeapon);
        console.log(`[Engine] Weapon replaced: ${oldWeapon.type} -> ${card.type}`);
      }
    }

    if (card.type === CardType.GHOST_PROTOCOL) {
      if (player.equipment.some(e => e.type === CardType.GHOST_PROTOCOL)) {
        return { success: false, message: 'У вас уже активен Протокол "Призрак"' };
      }
    }

    if (card.type === CardType.SNIPER_SCOPE) {
      if (player.equipment.some(e => e.type === CardType.SNIPER_SCOPE)) {
        return { success: false, message: 'У вас уже активен Снайперский модуль' };
      }
    }

    player.hand.splice(cardIndex, 1);
    player.equipment.push(card);
    return { success: true };
  }

  // --- Логика КАРТ КОНТРОЛЯ (Quarantine, Logic Bomb) ---
  const isControl = [CardType.QUARANTINE, CardType.LOGIC_BOMB].includes(card.type);

  if (isControl) {
    if (game.currentTurnPlayerId !== playerId || game.turnPhase !== TurnPhase.EXECUTE) {
      return { success: false, message: 'Карты контроля можно играть только в свой ход' };
    }

    // Логика выбора цели:
    // Logic Bomb -> всегда на себя (текущий игрок)
    // Quarantine -> на любого другого живого игрока
    
    let target: PlayerState | undefined;

    if (card.type === CardType.LOGIC_BOMB) {
      target = player;
    } else {
      // Для Quarantine ищем соперника
      const aliveOpponents = game.players.filter(p => p.id !== playerId && p.isAlive);
      if (aliveOpponents.length === 0) {
         return { success: false, message: 'Нет доступных целей для карты контроля' };
      }
      // Берем первого попавшегося (для MVP)
      target = aliveOpponents[0]; 
    }

    if (target) {
        player.hand.splice(cardIndex, 1);
        target.controlCards.push(card);

        console.log(`[Engine] ${player.nickname} placed ${card.type} on ${target.nickname}`);

        if (io) {
            io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { gameState: game });
        }

        return { success: true };
    }
  }
  
  return { success: false, message: 'Неподдерживаемая карта для этого действия' };
}

/**
 * Применение урона
 */
export function applyDamage(
  game: GameState, 
  target: PlayerState, 
  amount: number, 
  sourceId: string | null,
  io?: Server
) {
  target.currentHp -= amount;
  
  if (target.currentHp <= 0 && io && !target.isDying) {
    target.isDying = true;
    
    io.to(target.id).emit('criticalDamage', { 
      currentHp: target.currentHp, 
      sourceId 
    });
    
    setTimeout(() => {
      if (target.isDying && target.currentHp <= 0) {
        handleDeath(game, target, io);
        io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { gameState: game });
      }
    }, 8000);
    
    return;
  }
  
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

  game.pendingAttacks?.delete(player.id);

  checkWinCondition(game);
  
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
  if (!attacks || attacks.length === 0) return;

  const attack = attacks.shift();
  if (!attack || !io) return;

  const target = game.players.find(p => p.id === targetId);
  if (!target || !target.isAlive) {
    if (attacks.length === 0) game.pendingAttacks.delete(targetId);
    return;
  }

  if (!attack.barrelChecked) {
    const hasProxy = target.equipment.some(e => e.type === CardType.PROXY_SERVER);
    
    if (hasProxy) {
      refillDeck(game);
      const checkCard = game.deck.shift();
      
      if (checkCard) {
        game.discardPile.push(checkCard);
        
        if (checkCard.suit === Suit.HEARTS) {
          console.log(`[Engine] Proxy Server saved ${target.nickname} via timeout!`);
          
          io.emit('barrelDefenseSuccess', { 
            playerId: targetId, 
            cardSuit: Suit.HEARTS,
            attackerId: attack.sourceId 
          });
          
          if (attacks.length === 0) game.pendingAttacks.delete(targetId);
          io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { gameState: game });
          return;
        }
      }
    }
  }

  applyDamage(game, target, attack.amount, attack.sourceId, io);
  
  if (attacks.length === 0) game.pendingAttacks.delete(targetId);
  
  io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { gameState: game });
}

/**
 * Расчет дистанции
 */
function calculateDistance(
  players: PlayerState[], 
  fromId: string, 
  toId: string
): number {
  if (fromId === toId) return 0;

  const alivePlayers = players
    .filter(p => p.isAlive)
    .sort((a, b) => a.seatIndex - b.seatIndex);

  const fromIndex = alivePlayers.findIndex(p => p.id === fromId);
  const toIndex = alivePlayers.findIndex(p => p.id === toId);

  if (fromIndex === -1 || toIndex === -1) return 999;

  const totalAlive = alivePlayers.length;
  
  let clockwise = (toIndex - fromIndex + totalAlive) % totalAlive;
  let counterClockwise = (fromIndex - toIndex + totalAlive) % totalAlive;

  return Math.min(clockwise, counterClockwise);
}

/**
 * Разрешение SOCIAL_ENGINEERING (автоматический выбор если таймаут)
 */
function resolveSocialEngineering(game: GameState, targetId: string, io?: Server) {
  const pending = game.pendingSocialEngineering?.get(targetId);
  if (!pending) return; // Уже разрешено

  const target = game.players.find(p => p.id === targetId);
  if (!target || !target.isAlive) {
    game.pendingSocialEngineering?.delete(targetId);
    return;
  }

  // Автоматически выбираем случайную карту
  const allCards = [
    ...target.hand.map(c => ({ card: c, location: 'hand' })),
    ...target.equipment.map(c => ({ card: c, location: 'equipment' })),
    ...target.controlCards.map(c => ({ card: c, location: 'control' }))
  ];

  if (allCards.length > 0) {
    const randomChoice = allCards[Math.floor(Math.random() * allCards.length)];
    discardCard(game, target, randomChoice.location, randomChoice.card.id);
    console.log(`[Engine] Auto-discarded ${randomChoice.card.type} from ${target.nickname} (timeout)`);
  }

  game.pendingSocialEngineering?.delete(targetId);

  if (io) {
    io.to(`room:${game.roomId}`).emit(GAME_EVENTS.GAME_STATE_UPDATE, { gameState: game });
  }
}

/**
 * Удаление карты из указанного места
 */
function discardCard(game: GameState, player: PlayerState, location: string, cardId: string) {
  let card: CardInstance | undefined;

  if (location === 'hand') {
    const idx = player.hand.findIndex(c => c.id === cardId);
    if (idx !== -1) {
      card = player.hand.splice(idx, 1)[0];
    }
  } else if (location === 'equipment') {
    const idx = player.equipment.findIndex(c => c.id === cardId);
    if (idx !== -1) {
      card = player.equipment.splice(idx, 1)[0];
    }
  } else if (location === 'control') {
    const idx = player.controlCards.findIndex(c => c.id === cardId);
    if (idx !== -1) {
      card = player.controlCards.splice(idx, 1)[0];
    }
  }

  if (card) {
    game.discardPile.push(card);
  }
}