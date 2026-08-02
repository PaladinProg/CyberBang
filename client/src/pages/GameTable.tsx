import { useGameStore } from '@/store/useGameStore';
import { useLobbyStore } from '@/store/lobbyStore';
import { useSocket } from '@/hooks/useSocket';
import { LOC } from '@cyberbang/shared/localization';
import { GamePhase, TurnPhase, CardType } from '@cyberbang/shared/types';
import { motion } from 'framer-motion';
import { DefenseModal } from '@/components/game/DefenseModal';
import { useState, useEffect } from 'react'

export function GameTable() {
  const gameState = useGameStore((s) => s.gameState);
  const mySocketId = useLobbyStore((s) => s.socketId);
  const { endTurn, playCard, socket } = useSocket(); 
  
  const [showDefenseModal, setShowDefenseModal] = useState(false);

  if (!gameState || gameState.phase !== GamePhase.PLAYING) return null;

  const currentPlayer = gameState.players.find(p => p.id === mySocketId);
  const activePlayer = gameState.players.find(p => p.id === gameState.currentTurnPlayerId);
  
  const isMyTurn = currentPlayer?.id === gameState.currentTurnPlayerId;
  const phaseName = gameState.turnPhase ? LOC.TURN_PHASE_NAMES[gameState.turnPhase] : '';
  const canPlayCards = isMyTurn && gameState.turnPhase === TurnPhase.EXECUTE;

   // ▼▼▼ ПОДПИСКА НА СОБЫТИЕ АТАКИ ▼▼▼
   useEffect(() => {
    if (!socket) return;

    const handleIncomingAttack = () => {
      console.log('[Client] Incoming attack detected!');
      setShowDefenseModal(true);
    };

    socket.on('incomingAttack', handleIncomingAttack);

    return () => {
      socket.off('incomingAttack', handleIncomingAttack);
    };
  }, [socket]);


  // ▼▼▼ РАСЧЕТ ПОЗИЦИЙ ИГРОКОВ ПО ЭЛЛИПСУ ▼▼▼
  const getPlayerPosition = (index: number, total: number) => {
    const angleStep = (2 * Math.PI) / total;
    // Начинаем с низа экрана (90 градусов или PI/2)
    const startAngle = Math.PI / 2; 
    
    // Находим индекс текущего игрока, чтобы он всегда был внизу
    const mySeatIndex = gameState.players.findIndex(p => p.id === mySocketId);
    const relativeIndex = (index - mySeatIndex + total) % total;
    
    const angle = startAngle + (relativeIndex * angleStep);
    
    // Радиусы эллипса в процентах от контейнера
    const radiusX = 42; 
    const radiusY = 38; 
    
    const x = 50 + radiusX * Math.cos(angle);
    const y = 50 + radiusY * Math.sin(angle);
    
    return { x, y };
  };

  // ▼▼▼ ОБРАБОТЧИКИ DRAG AND DROP ▼▼▼
  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.setData('text/plain', cardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropOnPlayer = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('text/plain');
    if (cardId && canPlayCards) {
      playCard(cardId, targetId);
    }
  };

  const handleDropOnTable = (e: React.DragEvent) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('text/plain');
    if (cardId && canPlayCards) {
      // Для карт без цели (Пиво, Оружие) targetId не нужен
      playCard(cardId); 
    }
  };

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

      {/* ИГРОВОЕ ПОЛЕ С ИГРОКАМИ ВОКРУГ */}
      <main className="flex-1 relative flex items-center justify-center w-full max-w-6xl mx-auto aspect-video mt-16">
        
        {/* Контейнер для игроков (абсолютный, поверх стола) */}
        <div className="absolute inset-0 w-full h-full">
          {gameState.players.map((player, index) => {
            const pos = getPlayerPosition(index, gameState.players.length);
            const isMe = player.id === mySocketId;
            const isActive = player.id === gameState.currentTurnPlayerId;
            
            // Определяем, можно ли бросить карту на этого игрока
            const isValidTarget = canPlayCards && player.isAlive && !isMe;

            return (
              <div
                key={player.id}
                onDragOver={(e) => isValidTarget && e.preventDefault()}
                onDrop={(e) => handleDropOnPlayer(e, player.id)}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500
                  ${isActive ? 'z-30 scale-110' : 'z-10'}
                  ${isValidTarget ? 'cursor-crosshair hover:scale-115' : ''}
                `}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                {/* Карточка игрока */}
                <div className={`relative p-3 rounded-lg border backdrop-blur-md min-w-[140px] select-none ...`}>
  
                  {/* ▼▼▼ ПЕРСОНАЖ (ВИДЕН ВСЕМ) ▼▼▼ */}
                  <div className="flex items-center gap-2 mb-1">
                    {/* Можно добавить иконку персонажа, пока просто текст */}
                    <span className={`font-bold text-sm truncate ${isMe ? 'text-green-400' : 'text-white'}`}>
                      {player.nickname} {isMe && '(Вы)'}
                    </span>
                    {/* Отображаем имя персонажа из локализации */}
                    <span className="text-[9px] px-1 py-0.5 rounded bg-blue-900/40 text-blue-200 uppercase border border-blue-700/50">
                      {LOC.CHARACTER_NAMES[player.characterId!]} 
                    </span>
                  </div>

                  {/* ▼▼▼ РОЛЬ (ВИДНА ТОЛЬКО СЕБЕ ИЛИ АДМИНУ) ▼▼▼ */}
                  {(player.isRoleRevealed || isMe) && player.role && (
                    <div className="mb-2">
                      <span className={`text-[9px] px-1 py-0.5 rounded uppercase tracking-wider ${
                        isMe ? 'bg-gray-800 text-gray-300' : 'bg-yellow-900/40 text-yellow-200 border border-yellow-700/50'
                      }`}>
                        {LOC.ROLE_NAMES[player.role]}
                      </span>
                    </div>
                  )}

                  
                  {/* HP Bar */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-500">HP:</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: player.maxHp }).map((_, i) => (
                        <div key={i} className={`w-1.5 h-2.5 rounded-sm ${i < player.currentHp ? 'bg-red-500' : 'bg-gray-800'}`} />
                      ))}
                    </div>
                    <span className="ml-auto text-[10px] font-mono text-gray-400">{player.currentHp}/{player.maxHp}</span>
                  </div>

                  {/* Индикатор хода (точка) */}
                  {isActive && player.isAlive && (
                    <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-cyber-purple rounded-full animate-pulse shadow-[0_0_8px_rgba(176,38,255,0.8)]" />
                  )}
                  
                  {/* Статус смерти */}
                  {!player.isAlive && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded backdrop-blur-[1px]">
                      <span className="text-red-600 font-black text-lg tracking-widest rotate-[-12deg] border-2 border-red-600 px-2 py-0.5 rounded">МЕРТВ</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Сам стол (визуальный овал) - зона для сброса карт без цели */}
        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropOnTable}
          className="w-[85%] h-[75%] border-2 border-dashed border-gray-700/50 rounded-[100%] flex items-center justify-center relative bg-black/20 backdrop-blur-sm transition-colors duration-300 hover:bg-black/40 hover:border-cyber-purple/50 cursor-pointer"
        >
           <p className="text-gray-600 font-mono tracking-widest opacity-50 pointer-events-none">ИГРОВОЕ ПОЛЕ</p>
           
           {/* Отладка */}
           <div className="absolute top-4 left-8 bg-black/80 p-2 rounded text-xs font-mono space-y-1 border border-gray-800 pointer-events-none">
             <p>Room: {gameState.roomId.slice(0,8)}...</p>
             <p>Turn: {gameState.turnNumber} | Phase: {gameState.turnPhase}</p>
             <p>Deck: {gameState.deck.length} | Discard: {gameState.discardPile.length}</p>
           </div>
        </div>
      </main>

      {/* РУКА ИГРОКА (снизу) */}
      <footer className="h-48 border-t border-cyber-purple/20 pt-4 flex flex-col relative z-20 bg-gradient-to-t from-[#0a0a0f] to-transparent">
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
                onDragStart={(e) => handleDragStart(e, card.id)}
                initial={{ y: 50, opacity: 0 }}
                animate={{ 
                  y: canPlayCards ? [0, -5, 0] : 0,
                  opacity: 1 
                }}
                transition={{ delay: idx * 0.05 }}
                className={`
                  w-24 h-36 rounded-lg border flex items-center justify-center shrink-0 select-none transition-all duration-200 origin-bottom
                  ${canPlayCards 
                    ? 'cursor-grab active:cursor-grabbing bg-gray-800 border-gray-500 hover:-translate-y-8 hover:shadow-[0_0_20px_rgba(176,38,255,0.6)] hover:border-cyber-purple z-10' 
                    : 'bg-gray-900 border-gray-800 opacity-60 cursor-not-allowed grayscale'}
                `}
              >
                <span className="text-xs text-center p-1 font-bold leading-tight pointer-events-none text-white">
                  {LOC.CARD_NAMES[card.type]}
                </span>
                
                {/* Маркер возможности перетаскивания */}
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

      {/* ▼▼▼ МОДАЛЬНОЕ ОКНО ЗАЩИТЫ ▼▼▼ */}
      {showDefenseModal && (
        <DefenseModal onClose={() => setShowDefenseModal(false)} />
      )}
    </div>
  );
}