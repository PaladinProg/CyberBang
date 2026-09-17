import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { useLobbyStore } from '@/store/lobbyStore';
import { CardType } from '@cyberbang/shared/types';

interface CriticalDamageModalProps {
  onClose: () => void;
}

const CRITICAL_TIME = 8; // Время на спасение (сек)

export function CriticalDamageModal({ onClose }: CriticalDamageModalProps) {
  const { playCard } = useSocket();
  const gameState = useGameStore((s) => s.gameState);
  const mySocketId = useLobbyStore((s) => s.socketId);
  
  const [timeLeft, setTimeLeft] = useState(CRITICAL_TIME);
  
  const currentPlayer = gameState?.players.find(p => p.id === mySocketId);
  const hasStimulant = currentPlayer?.hand.some(c => c.type === CardType.STIMULANT);

  // Таймер обратного отсчета
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose(); // Время вышло — сервер сам убьет игрока
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onClose]);

  const handleSave = useCallback(() => {
    const stimulantCard = currentPlayer?.hand.find(c => c.type === CardType.STIMULANT);
    if (stimulantCard) {
      // Сыграем Стимулянт без цели (сервер сам поймет, что это спасение)
      playCard(stimulantCard.id); 
      onClose();
    }
  }, [currentPlayer, playCard, onClose]);

  if (!currentPlayer) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] animate-in fade-in duration-200">
      <div className="bg-gray-900 border-2 border-red-600 p-8 rounded-xl shadow-[0_0_50px_rgba(220,38,38,0.6)] max-w-md w-full text-center relative overflow-hidden">
        
        {/* Анимированная полоса таймера снизу */}
        <div 
          className="absolute bottom-0 left-0 h-1.5 bg-red-600 transition-all duration-1000 ease-linear"
          style={{ width: `${(timeLeft / CRITICAL_TIME) * 100}%` }}
        />

        <h3 className="text-3xl font-orbitron text-red-500 mb-2 tracking-wider">⚠️ КРИТИЧЕСКИЙ УРОН!</h3>
        <p className="text-gray-300 mb-6 text-lg">Вы при смерти. Сыграйте СТИМУЛЯНТ, чтобы остаться в игре.</p>
        
        {/* Большой таймер */}
        <div className="mb-8 flex justify-center">
           <div className={`text-5xl font-mono font-bold ${timeLeft <= 3 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
             00:{timeLeft.toString().padStart(2, '0')}
           </div>
        </div>

        {/* Кнопка спасения */}
        <button
          onClick={handleSave}
          disabled={!hasStimulant}
          className={`w-full py-4 rounded-lg font-bold text-xl transition-all transform active:scale-95 ${
            hasStimulant 
              ? 'bg-green-600 hover:bg-green-500 text-white shadow-[0_0_20px_rgba(22,163,74,0.6)] border border-green-400' 
              : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
          }`}
        >
          {hasStimulant ? '💉 ИСПОЛЬЗОВАТЬ СТИМУЛЯНТ' : '❌ НЕТ СТИМУЛЯНТА'}
        </button>
        
        {!hasStimulant && (
          <p className="text-xs text-red-400 mt-4 opacity-80">У вас нет карты Стимулянт в руке! Вы погибнете...</p>
        )}
      </div>
    </div>
  );
}