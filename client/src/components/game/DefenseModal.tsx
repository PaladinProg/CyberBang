// client/src/components/game/DefenseModal.tsx

import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { useLobbyStore } from '@/store/lobbyStore';
import { CardType, LOC } from '@cyberbang/shared/types';

interface DefenseModalProps {
  onClose: () => void;
  requiredCardType?: CardType; // <--- НОВЫЙ ПРОПС
}

const DEFENSE_TIME = 10;

export function DefenseModal({ onClose, requiredCardType }: DefenseModalProps) {
  const { playCard } = useSocket();
  const gameState = useGameStore((s) => s.gameState);
  const mySocketId = useLobbyStore((s) => s.socketId);
  
  const [timeLeft, setTimeLeft] = useState(DEFENSE_TIME);
  
  const currentPlayer = gameState?.players.find(p => p.id === mySocketId);
  
  // Определяем, какая карта нужна для защиты
  const defenseCardType = requiredCardType || CardType.MISS;
  const hasDefenseCard = currentPlayer?.hand.some(c => c.type === defenseCardType);

  // Таймер обратного отсчета
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onClose]);

  const handleDefend = useCallback(() => {
    const card = currentPlayer?.hand.find(c => c.type === defenseCardType);
    if (card) {
      playCard(card.id); // Сыграем требуемую карту
      onClose();
    }
  }, [currentPlayer, defenseCardType, playCard, onClose]);

  if (!currentPlayer) return null;

  // Динамические тексты в зависимости от требуемой карты
  const isPingRequired = defenseCardType === CardType.PING;
  const title = isPingRequired ? '⚠️ DDoS-АТАКА!' : '⚠️ ВАС АТАКУЮТ!';
  const description = isPingRequired 
    ? 'Сыграйте ПИНГ, чтобы отбить атаку' 
    : 'Сыграйте ФАЙРВОЛЛ, чтобы отменить урон';
  const buttonText = isPingRequired ? '🔫 СЫГРАТЬ ПИНГ' : '🛡️ СЫГРАТЬ ФАЙРВОЛЛ';
  const noCardText = isPingRequired ? 'У вас нет ПИНГа!' : 'У вас нет Файрволла!';

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-gray-900 border-2 border-red-500 p-6 rounded-lg shadow-[0_0_40px_rgba(239,68,68,0.5)] max-w-md w-full text-center relative overflow-hidden">
        
        {/* Полоса таймера */}
        <div 
          className="absolute bottom-0 left-0 h-1 bg-red-600 transition-all duration-1000 ease-linear"
          style={{ width: `${(timeLeft / DEFENSE_TIME) * 100}%` }}
        />

        <h3 className={`text-2xl font-orbitron mb-2 ${isPingRequired ? 'text-orange-500' : 'text-red-500'}`}>
          {title}
        </h3>
        <p className="text-gray-300 mb-6">{description}</p>
        
        {/* Большой таймер */}
        <div className="mb-8 flex justify-center">
           <div className={`text-5xl font-mono font-bold ${timeLeft <= 3 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
             00:{timeLeft.toString().padStart(2, '0')}
           </div>
        </div>

        {/* Кнопка защиты */}
        <button
          onClick={handleDefend}
          disabled={!hasDefenseCard}
          className={`w-full py-4 rounded-lg font-bold text-xl transition-all transform active:scale-95 ${
            hasDefenseCard 
              ? isPingRequired 
                ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_20px_rgba(234,88,12,0.6)] border border-orange-400'
                : 'bg-cyber-purple hover:bg-purple-600 text-white shadow-[0_0_20px_rgba(176,38,255,0.6)] border border-purple-400'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
          }`}
        >
          {hasDefenseCard ? buttonText : `❌ ${noCardText}`}
        </button>
        
        {!hasDefenseCard && (
          <p className="text-xs text-red-400 mt-4 opacity-80">{noCardText}</p>
        )}
      </div>
    </div>
  );
}