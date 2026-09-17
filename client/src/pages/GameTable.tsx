// client/src/pages/GameTable.tsx
import { useGameStore } from '@/store/useGameStore';
import { useLobbyStore } from '@/store/lobbyStore';
import { useSocket } from '@/hooks/useSocket';
import { LOC } from '@cyberbang/shared/localization';
import { GamePhase, TurnPhase, CardType, WEAPON_MAX_RANGE, Suit, CardRank } from '@cyberbang/shared/types';
import { motion, AnimatePresence } from 'framer-motion';
import { DefenseModal } from '@/components/game/DefenseModal';
import { CriticalDamageModal } from '@/components/game/CriticalDamageModal';
import { useState, useEffect } from 'react';

// --- Вспомогательные функции для отображения карт ---

function getRankSymbol(rank?: CardRank): string {
  if (!rank) return '';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  if (rank === 14) return 'A';
  return rank.toString();
}

function getSuitSymbol(suit?: Suit): string {
  switch (suit) {
    case Suit.HEARTS: return '♥';
    case Suit.DIAMONDS: return '♦';
    case Suit.CLUBS: return '♣';
    case Suit.SPADES: return '♠';
    default: return '';
  }
}

// ЖЕСТКИЙ ФИКС ЦВЕТОВ: Используем конкретные hex-коды
function getSuitColor(suit?: Suit): string {
  if (suit === Suit.HEARTS || suit === Suit.DIAMONDS) return '#ff0000'; // Ярко-красный
  return '#000000'; // Абсолютно черный
}

export function GameTable() {
  const gameState = useGameStore((s) => s.gameState);
  const mySocketId = useLobbyStore((s) => s.socketId);
  const { endTurn, playCard, socket } = useSocket(); 
  
  const [defenseConfig, setDefenseConfig] = useState<{ 
    show: boolean; 
    requiredCardType?: CardType 
  }>({ show: false });
  
  const [showCriticalModal, setShowCriticalModal] = useState(false);

  if (!gameState || gameState.phase !== GamePhase.PLAYING) return null;

  const currentPlayer = gameState.players.find(p => p.id === mySocketId);
  const activePlayer = gameState.players.find(p => p.id === gameState.currentTurnPlayerId);
  
  const isMyTurn = currentPlayer?.id === gameState.currentTurnPlayerId;
  const phaseName = gameState.turnPhase ? LOC.TURN_PHASE_NAMES[gameState.turnPhase] : '';
  const canPlayCards = isMyTurn && gameState.turnPhase === TurnPhase.EXECUTE;

   // ▼▼▼ ПОДПИСКА НА СОБЫТИЯ ▼▼▼
   useEffect(() => {
    if (!socket) return;

    const handleIncomingAttack = (data: { requiredDefense?: CardType }) => {
      setDefenseConfig({ show: true, requiredCardType: data.requiredDefense });
    };

    const handleBarrelDefense = () => {};
    const handleCriticalDamage = () => setShowCriticalModal(true);

    socket.on('criticalDamage', handleCriticalDamage);
    socket.on('incomingAttack', handleIncomingAttack);
    socket.on('barrelDefenseSuccess', handleBarrelDefense);

    return () => {
      socket.off('incomingAttack', handleIncomingAttack);
      socket.off('barrelDefenseSuccess', handleBarrelDefense);
      socket.off('criticalDamage', handleCriticalDamage);
    };
  }, [socket]);


  // ▼▼▼ РАСЧЕТ ПОЗИЦИЙ ▼▼▼
  const getPlayerPosition = (index: number, total: number) => {
    const angleStep = (2 * Math.PI) / total;
    const startAngle = Math.PI / 2; 
    const mySeatIndex = gameState.players.findIndex(p => p.id === mySocketId);
    const relativeIndex = (index - mySeatIndex + total) % total;
    const angle = startAngle + (relativeIndex * angleStep);
    const radiusX = 42; 
    const radiusY = 38; 
    return { 
      x: 50 + radiusX * Math.cos(angle), 
      y: 50 + radiusY * Math.sin(angle) 
    };
  };

  // КАРТЫ НАПРАВЛЕННЫЕ НА ИГРОКА
  const isTargetedCard = (cardType: CardType): boolean => {
    return [
      CardType.PING,
      CardType.DDOS,
      CardType.DUEL,
      CardType.SOCIAL_ENGINEERING,
      CardType.VPN,
    ].includes(cardType);
  };

  // DRAG START: Сохраняем данные
  const handleDragStart = (e: React.DragEvent, cardId: string, cardType: CardType) => {
    const payload = `${cardId}::${cardType}`;
    e.dataTransfer.setData('text/plain', payload);
    e.dataTransfer.effectAllowed = 'move';
    console.log('[DragStart]', payload);
  };

  // Парсер данных
  const parseDragData = (data: string) => {
    if (!data) return null;
    const parts = data.split('::');
    if (parts.length === 2) {
      return { cardId: parts[0], cardType: parts[1] as CardType };
    }
    return null;
  };

  // DROP НА ИГРОКА: Всегда предотвращаем дефолт, если есть данные
  const handleDropOnPlayer = (e: React.DragEvent, targetId: string) => {
    e.preventDefault(); // <-- ВАЖНО: Всегда вызываем это
    e.stopPropagation();
    
    const rawData = e.dataTransfer.getData('text/plain');
    console.log('[DropOnPlayer Raw]', rawData);
    
    const data = parseDragData(rawData);
    console.log('[DropOnPlayer Parsed]', data);
    
    if (data) {
      if (isTargetedCard(data.cardType)) {
        console.log('[PlayCard Targeted]', data.cardId, '->', targetId);
        playCard(data.cardId, targetId);
      } else {
        console.warn('[DropOnPlayer] Карта не направленная:', data.cardType);
      }
    } else {
      console.error('[DropOnPlayer] Не удалось распарсить данные');
    }
  };

  // DROP НА СТОЛ: Всегда предотвращаем дефолт, если есть данные
  const handleDropOnTable = (e: React.DragEvent) => {
    e.preventDefault(); // <-- ВАЖНО: Всегда вызываем это
    e.stopPropagation();
    
    const rawData = e.dataTransfer.getData('text/plain');
    console.log('[DropOnTable Raw]', rawData);
    
    const data = parseDragData(rawData);
    console.log('[DropOnTable Parsed]', data);
    
    if (data) {
      if (!isTargetedCard(data.cardType)) {
        console.log('[PlayCard Table]', data.cardId);
        playCard(data.cardId);
      } else {
        console.warn('[DropOnTable] Карта требует цели:', data.cardType);
      }
    } else {
      console.error('[DropOnTable] Не удалось распарсить данные');
    }
  };

  const lastDiscardedCard = gameState.discardPile.length > 0 
    ? gameState.discardPile[gameState.discardPile.length - 1] 
    : null;
  
  const isCheckCard = lastDiscardedCard && lastDiscardedCard.suit && lastDiscardedCard.rank;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col overflow-hidden relative">
      
      {/* ШАПКА */}
      <header className="absolute top-0 left-0 w-full p-4 z-20 flex justify-between items-center pointer-events-none">
        <h1 className="text-2xl font-orbitron text-cyber-purple pointer-events-auto">{LOC.UI.APP_TITLE}</h1>
        <div className="flex gap-4 items-center pointer-events-auto">
           <span className="text-sm text-gray-400">Ход:</span>
           <span className={`font-bold ${isMyTurn ? 'text-green-400' : 'text-orange-400'}`}>
             {activePlayer?.nickname || '...'}
           </span>
           {isMyTurn && (
             <span className="px-2 py-1 bg-cyber-purple/20 rounded text-xs border border-cyber-purple">
               {phaseName}
             </span>
           )}
        </div>
      </header>

      {/* ИГРОВОЕ ПОЛЕ */}
      <main className="flex-1 relative flex items-center justify-center w-full max-w-6xl mx-auto aspect-video mt-16"
        style={{ transform: 'scale(0.9)', transformOrigin: 'center center' }}>
        
        <div className="absolute inset-0 w-full h-full pointer-events-none">
          {gameState.players.map((player, index) => {
            const pos = getPlayerPosition(index, gameState.players.length);
            const isMe = player.id === mySocketId;
            const isActive = player.id === gameState.currentTurnPlayerId;
            const isValidTarget = canPlayCards && player.isAlive && !isMe;

            return (
              <div
                key={player.id}
                onDragOver={(e) => {
                  if (canPlayCards && player.isAlive && !isMe) {
                    e.preventDefault(); // <-- ЭТО ОБЯЗАТЕЛЬНО ДЛЯ РАБОТЫ DROP
                    e.dataTransfer.dropEffect = 'move';
                  }
                }}
                onDrop={(e) => handleDropOnPlayer(e, player.id)}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500 pointer-events-auto
                  ${isActive ? 'z-30 scale-110' : 'z-10'}
                  ${(canPlayCards && player.isAlive && !isMe) ? 'cursor-crosshair hover:scale-115 hover:border-cyber-purple/50' : ''}
                `}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                <div className={`relative p-3 rounded-lg border backdrop-blur-md min-w-[140px] select-none shadow-lg
                  ${!player.isAlive ? 'opacity-50 grayscale border-red-900/50' : ''}
                  ${isMe ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'border-gray-700'}
                  ${isActive ? 'border-cyber-purple shadow-[0_0_20px_rgba(176,38,255,0.5)]' : ''}
                `}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-bold text-sm truncate ${isMe ? 'text-green-400' : 'text-white'}`}>
                      {player.nickname} {isMe && '(Вы)'}
                    </span>
                    <span className="text-[9px] px-1 py-0.5 rounded bg-blue-900/40 text-blue-200 uppercase border border-blue-700/50">
                      {LOC.CHARACTER_NAMES[player.characterId!]} 
                    </span>
                  </div>

                  {(player.isRoleRevealed || isMe) && player.role && (
                    <div className="mb-2">
                      <span className={`text-[9px] px-1 py-0.5 rounded uppercase tracking-wider ${
                        isMe ? 'bg-gray-800 text-gray-300' : 'bg-yellow-900/40 text-yellow-200 border border-yellow-700/50'
                      }`}>
                        {LOC.ROLE_NAMES[player.role]}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-500">HP:</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: player.maxHp }).map((_, i) => (
                        <div key={i} className={`w-1.5 h-2.5 rounded-sm ${i < player.currentHp ? 'bg-red-500' : 'bg-gray-800'}`} />
                      ))}
                    </div>
                    <span className="ml-auto text-[10px] font-mono text-gray-400">{player.currentHp}/{player.maxHp}</span>
                  </div>

                  {isActive && player.isAlive && (
                    <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-cyber-purple rounded-full animate-pulse shadow-[0_0_8px_rgba(176,38,255,0.8)]" />
                  )}
                  
                  {!player.isAlive && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded backdrop-blur-[1px]">
                      <span className="text-red-600 font-black text-lg tracking-widest rotate-[-12deg] border-2 border-red-600 px-2 py-0.5 rounded">МЕРТВ</span>
                    </div>
                  )}

                  {/* ▼▼▼ ЭКИПИРОВКА (Оружие, Модификаторы) ▼▼▼ */}
                  {player.equipment && player.equipment.length > 0 && (
                    <div className="flex gap-1 mt-2 justify-center min-w-[140px]">
                      {player.equipment.map((eqCard) => {
                        let bgClass = 'bg-gray-800 border-gray-600 text-gray-300';
                        let icon = '';
                        let rangeLabel = '';

                        if ([CardType.SHORT_CIRCUIT, CardType.REMOTE_SHELL, CardType.LONG_LINK, CardType.VOLCANIC_IMPLANT].includes(eqCard.type)) {
                          bgClass = 'bg-orange-900/60 border-orange-500 text-orange-200 shadow-[0_0_8px_rgba(249,115,22,0.4)]';
                          rangeLabel = WEAPON_MAX_RANGE[eqCard.type]?.toString() || '';
                          icon = eqCard.type === CardType.REMOTE_SHELL ? '🔫' : eqCard.type === CardType.LONG_LINK ? '' : eqCard.type === CardType.VOLCANIC_IMPLANT ? '' : '🔫';
                        } else if (eqCard.type === CardType.GHOST_PROTOCOL) {
                          bgClass = 'bg-blue-900/60 border-blue-500 text-blue-200 shadow-[0_0_8px_rgba(59,130,246,0.4)]';
                        } else if (eqCard.type === CardType.SNIPER_SCOPE) {
                          bgClass = 'bg-purple-900/60 border-purple-500 text-purple-200 shadow-[0_0_8px_rgba(168,85,247,0.4)]';
                          icon = '🎯';
                        } else if (eqCard.type === CardType.PROXY_SERVER) {
                          bgClass = 'bg-gray-700/60 border-gray-400 text-gray-200 shadow-[0_0_8px_rgba(156,163,175,0.4)]';
                          icon = '️';
                        }

                        return (
                          <motion.div
                            key={eqCard.id}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className={`relative w-8 h-10 rounded border flex flex-col items-center justify-center text-[7px] font-bold leading-tight ${bgClass}`}
                            title={LOC.CARD_NAMES[eqCard.type]}
                          >
                            <span className="text-base">{icon}</span>
                            {rangeLabel && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-black border border-orange-500 rounded-full flex items-center justify-center text-[6px] text-white">
                                {rangeLabel}
                              </span>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                  {/* ▲▲▲ КОНЕЦ БЛОКА ЭКИПИРОВКИ ▲▲▲ */}

                  {/* ▼▼▼ КАРТЫ КОНТРОЛЯ (Логическая Бомба, Тюрьма) - ОТДЕЛЬНЫЙ БЛОК! ▼▼▼ */}
                  {player.controlCards && player.controlCards.length > 0 && (
                    <div className="flex gap-1 mt-2 justify-center min-w-[140px]">
                      {player.controlCards.map((controlCard) => {
                        // Определяем стиль для карт контроля
                        let bgClass = 'bg-red-900/60 border-red-500 text-red-200 shadow-[0_0_8px_rgba(239,68,68,0.4)]';
                        let icon = '';
                        
                        if (controlCard.type === CardType.LOGIC_BOMB) {
                          icon = '💣'; // Иконка бомбы
                        } else if (controlCard.type === CardType.QUARANTINE) {
                          bgClass = 'bg-yellow-900/60 border-yellow-500 text-yellow-200 shadow-[0_0_8px_rgba(234,179,8,0.4)]';
                          icon = '️'; // Иконка тюрьмы/цепей
                        }

                        return (
                          <motion.div
                            key={controlCard.id}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className={`relative w-8 h-10 rounded border flex flex-col items-center justify-center text-[7px] font-bold leading-tight ${bgClass}`}
                            title={LOC.CARD_NAMES[controlCard.type]}
                          >
                            <span className="text-base">{icon}</span>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                  {/* ▲▲▲ КОНЕЦ БЛОКА КАРТ КОНТРОЛЯ ▲▲▲ */}

                </div> {/* Закрывающий div карточки игрока */}
              </div>
            );
          })}
        </div>

        {/* СТОЛ - ИСПРАВЛЕННАЯ ЗОНА ДЛЯ ОБЩИХ КАРТ */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-0">
           <div className="relative w-[60%] h-[60%] flex items-center justify-center">
              
              {/* Зона Колоды */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none">
                 <div className="w-20 h-28 bg-gray-800 border-2 border-gray-600 rounded-lg shadow-xl flex items-center justify-center relative overflow-hidden">
                    <span className="text-xs font-mono text-gray-400 z-10">{gameState.deck.length}</span>
                 </div>
                 <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Колода</span>
              </div>

              {/* Зона Проверки (Центр) */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 h-32 justify-end pb-4 pointer-events-none">
                 <AnimatePresence mode="wait">
                    {isCheckCard && (
                       <motion.div 
                          key={lastDiscardedCard!.id}
                          initial={{ y: -50, opacity: 0, rotateY: 90 }}
                          animate={{ y: 0, opacity: 1, rotateY: 0 }}
                          exit={{ y: 50, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 200, damping: 20 }}
                          className="w-16 h-24 bg-white rounded border border-gray-300 shadow-2xl flex flex-col items-center justify-center relative"
                       >
                          <div className="text-2xl font-bold" style={{ color: getSuitColor(lastDiscardedCard!.suit) }}>
                             {getRankSymbol(lastDiscardedCard!.rank)}
                          </div>
                          <div className="text-3xl" style={{ color: getSuitColor(lastDiscardedCard!.suit) }}>
                             {getSuitSymbol(lastDiscardedCard!.suit)}
                          </div>
                       </motion.div>
                    )}
                 </AnimatePresence>
                 
                 {isCheckCard && lastDiscardedCard!.suit === Suit.SPADES && lastDiscardedCard!.rank! >= 2 && lastDiscardedCard!.rank! <= 9 && (
                    <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="text-red-500 font-black text-sm tracking-widest drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]">ВЗРЫВ!</motion.span>
                 )}
                 {isCheckCard && lastDiscardedCard!.suit === Suit.HEARTS && (
                    <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="text-green-500 font-black text-sm tracking-widest drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]">СВОБОДА!</motion.span>
                 )}
              </div>

              {/* Зона Сброса */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none">
                 <div className="w-20 h-28 bg-gray-900/50 border-2 border-dashed border-gray-700 rounded-lg flex items-center justify-center relative">
                    {gameState.discardPile.length > 0 ? (
                       <>
                          <div className="absolute inset-0 bg-gray-800 rounded-lg opacity-50"></div>
                          <span className="text-xs font-mono text-gray-400 z-10">{gameState.discardPile.length}</span>
                       </>
                    ) : (
                       <span className="text-[10px] text-gray-600 font-mono">СБРОС</span>
                    )}
                 </div>
                 <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Сброс</span>
              </div>

              {/* ▼▼▼ АКТИВНАЯ ЗОНА ДЛЯ ДРОПА ОБЩИХ КАРТ (невидимая, но кликабельная) ▼▼▼ */}
              <div 
                onDragOver={(e) => {
                  if (canPlayCards) {
                    e.preventDefault(); // <-- ОБЯЗАТЕЛЬНО для работы drop
                    e.dataTransfer.dropEffect = 'move';
                  }
                }}
                onDrop={handleDropOnTable}
                className="absolute inset-0 z-10 cursor-pointer" // <-- Занимает всю область стола
                title="Перетащите сюда общие карты и экипировку"
              />

           </div>
        </div>
      </main>

      {/* РУКА ИГРОКА - УВЕЛИЧЕНА ВЫСОТА ДЛЯ ВМЕСТИМОСТИ */}
      <footer className="h-56 border-t border-cyber-purple/20 pt-4 flex flex-col relative z-20 bg-gradient-to-t from-[#0a0a0f] to-transparent">
         <div className="flex justify-between items-center mb-2 px-8">
            <h3 className="text-sm text-gray-400 font-orbitron">ВАША РУКА ({currentPlayer?.hand.length} карт)</h3>
            {canPlayCards && (
               <button onClick={() => endTurn()} className="px-4 py-1 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold rounded border border-orange-400 transition-colors shadow-[0_0_10px_rgba(234,88,12,0.5)]">
                 ЗАВЕРШИТЬ ХОД
               </button>
            )}
         </div>
         
         <div className="flex gap-3 overflow-x-auto pb-4 px-8 items-end justify-center h-full">
            {currentPlayer?.hand.map((card, idx) => (
              <motion.div
                key={card.id}
                draggable={canPlayCards}
                onDragStart={(e) => handleDragStart(e, card.id, card.type)}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: canPlayCards ? [0, -5, 0] : 0, opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                // ЖЕСТКИЙ ФИКС: Inline style для фона и границ
                style={{
                  backgroundColor: canPlayCards ? '#ffffff' : '#e5e7eb',
                  borderColor: canPlayCards ? '#9ca3af' : '#374151',
                }}
                className={`
                  relative w-24 h-36 rounded-lg border-2 flex flex-col items-center justify-between p-2 shrink-0 select-none transition-all duration-200 origin-bottom
                  ${canPlayCards 
                    ? 'cursor-grab active:cursor-grabbing hover:-translate-y-8 hover:shadow-[0_0_20px_rgba(176,38,255,0.6)] hover:border-cyber-purple z-10' 
                    : 'opacity-60 cursor-not-allowed grayscale'}
                `}
              >
                {/* Верхний угол: Ранг и Масть - КРУПНЫЙ ШРИФТ */}
                <div className="self-start text-lg font-black leading-none w-full text-left pl-1">
                   <span style={{ color: '#000000' }}>{getRankSymbol(card.rank)}</span>
                   <span className="ml-0.5" style={{ color: getSuitColor(card.suit) }}>{getSuitSymbol(card.suit)}</span>
                </div>

                {/* Центр: Название карты - ЧЕРНЫЙ ТЕКСТ */}
                <div className="flex-1 flex items-center justify-center w-full px-1">
                   <span className="text-xs text-center font-bold leading-tight pointer-events-none" style={{ color: '#000000' }}>
                     {LOC.CARD_NAMES[card.type]}
                   </span>
                </div>

                {/* Нижний угол: Перевернутые Ранг и Масть - КРУПНЫЙ ШРИФТ */}
                <div className="self-end text-lg font-black leading-none w-full text-right pr-1 rotate-180">
                   <span style={{ color: '#000000' }}>{getRankSymbol(card.rank)}</span>
                   <span className="ml-0.5" style={{ color: getSuitColor(card.suit) }}>{getSuitSymbol(card.suit)}</span>
                </div>
                
                {canPlayCards && (
                  <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyber-purple/50" />
                )}
              </motion.div>
            ))}
            
            {(!currentPlayer?.hand || currentPlayer.hand.length === 0) && (
              <p className="text-gray-600 italic self-center w-full text-center">Рука пуста</p>
            )}
         </div>
      </footer>

      {defenseConfig.show && (
        <DefenseModal onClose={() => setDefenseConfig({ show: false })} requiredCardType={defenseConfig.requiredCardType} />
      )}
      {showCriticalModal && (
        <CriticalDamageModal onClose={() => setShowCriticalModal(false)} />
      )}
    </div>
  );
}