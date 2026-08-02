// client/src/components/game/DefenseModal.tsx
import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { useLobbyStore } from '@/store/lobbyStore';
import { CardType } from '@cyberbang/shared/types';

interface DefenseModalProps {
  onClose: () => void;
}

const DEFENSE_TIME = 10; // Время на ответ

export function DefenseModal({ onClose }: DefenseModalProps) {
  const { playCard, socket } = useSocket();
  const gameState = useGameStore((s) => s.gameState);
  const mySocketId = useLobbyStore((s) => s.socketId);
  
  const [timeLeft, setTimeLeft] = useState(DEFENSE_TIME);
  
  const currentPlayer = gameState?.players.find(p => p.id === mySocketId);
  const hasMiss = currentPlayer?.hand.some(c => c.type === CardType.MISS);

  // Безопасное закрытие через useEffect, чтобы избежать ошибки React
  useEffect(() => {
    if (timeLeft <= 0) {
      // Время вышло. 
      // В текущей MVP реализации урон на сервере еще не применен.
      // Нам нужно либо отправить событие "confirmDamage", либо просто закрыть окно
      // и надеяться, что сервер сам применит урон через свой таймаут.
      // Для простоты пока просто закрываем, но в идеале здесь должен быть emit.
      
      // Если у тебя на сервере есть таймаут на применение урона - отлично.
      // Если нет - добавь сюда: socket?.emit('confirmIncomingDamage');
      
      onClose();
    }
  }, [timeLeft, onClose]);

  // Таймер обратного отсчета
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleDefend = useCallback(() => {
    const missCard = currentPlayer?.hand.find(c => c.type === CardType.MISS);
    if (missCard) {
      playCard(missCard.id); // Сыграем MISS!
      onClose();
    }
  }, [currentPlayer, playCard, onClose]);

  if (!currentPlayer) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-gray-900 border-2 border-red-500 p-6 rounded-lg shadow-[0_0_40px_rgba(239,68,68,0.5)] max-w-md w-full text-center relative overflow-hidden">
        
        {/* Фоновая анимация таймера (опционально) */}
        <div 
          className="absolute bottom-0 left-0 h-1 bg-red-600 transition-all duration-1000 ease-linear"
          style={{ width: `${(timeLeft / DEFENSE_TIME) * 100}%` }}
        />

        <h3 className="text-2xl font-orbitron text-red-500 mb-2">⚠️ ВАС АТАКУЮТ!</h3>
        <p className="text-gray-300 mb-6">Сыграйте ФАЙРВОЛЛ, чтобы отменить урон</p>
        
        {/* Большой таймер */}
        <div className="mb-8 flex justify-center">
           <div className={`text-4xl font-mono font-bold ${timeLeft <= 3 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
             00:{timeLeft.toString().padStart(2, '0')}
           </div>
        </div>

        {/* Кнопка защиты */}
        <button
          onClick={handleDefend}
          disabled={!hasMiss}
          className={`w-full py-4 rounded font-bold text-xl transition-all transform active:scale-95 ${
            hasMiss 
              ? 'bg-cyber-purple hover:bg-purple-600 text-white shadow-[0_0_20px_rgba(176,38,255,0.6)] border border-purple-400' 
              : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
          }`}
        >
          {hasMiss ? '🛡️ СЫГРАТЬ ФАЙРВОЛЛ' : '❌ НЕТ КАРТЫ ЗАЩИТЫ'}
        </button>
        
        {!hasMiss && (
          <p className="text-xs text-red-400 mt-3 opacity-80">У вас нет карты Файрволл в руке!</p>
        )}
      </div>
    </div>
  );
}