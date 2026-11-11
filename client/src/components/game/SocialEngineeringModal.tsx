// client/src/components/game/SocialEngineeringModal.tsx
import React from 'react';
import { LOC } from '@cyberbang/shared/localization';
import { CardInstance, Suit } from '@cyberbang/shared/types';

// Вспомогательные функции (можно импортировать из utils, если есть)
function getSuitSymbol(suit?: Suit | string): string {
  if (!suit) return '';
  const s = String(suit).toUpperCase();
  if (s === 'HEARTS' || s === '♥') return '♥';
  if (s === 'DIAMONDS' || s === '♦') return '♦';
  if (s === 'CLUBS' || s === '♣') return '♣';
  if (s === 'SPADES' || s === '♠') return '♠';
  return '';
}

function getSuitColor(suit?: Suit | string): string {
  if (!suit) return '#000000';
  const s = String(suit).toUpperCase();
  if (s === 'HEARTS' || s === 'DIAMONDS' || s === '♥' || s === '♦') return '#ff0000';
  return '#000000';
}

interface SocialEngineeringModalProps {
  isOpen: boolean;
  hand: CardInstance[];
  equipment: CardInstance[];
  controlCards: CardInstance[];
  onDiscard: (cardId: string, location: 'hand' | 'equipment' | 'control') => void;
}

export function SocialEngineeringModal({
  isOpen,
  hand,
  equipment,
  controlCards,
  onDiscard,
}: SocialEngineeringModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="bg-gray-900 border-2 border-red-500 p-6 rounded-lg max-w-5xl w-full max-h-[85vh] overflow-y-auto shadow-[0_0_50px_rgba(239,68,68,0.3)] animate-in fade-in zoom-in duration-200">
        <h2 className="text-2xl font-orbitron text-red-500 mb-2 text-center animate-pulse">
          ⚠️ СОЦИАЛЬНАЯ ИНЖЕНЕРИЯ ⚠️
        </h2>
        <p className="text-gray-300 text-center mb-6 text-sm">
          Противник требует сбросить одну карту. Выберите любую:
        </p>

        {/* Рука */}
        {hand.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-wider border-b border-gray-700 pb-1">Рука:</h3>
            <div className="flex gap-2 flex-wrap justify-center">
              {hand.map(card => (
                <button
                  key={card.id}
                  onClick={() => onDiscard(card.id, 'hand')}
                  className="w-16 h-24 bg-white rounded border-2 border-gray-400 hover:border-red-500 hover:scale-105 transition-all p-1 group relative"
                >
                  <div className="text-[10px] font-bold text-black text-center leading-tight">
                    {LOC.CARD_NAMES[card.type]}
                  </div>
                  {card.suit && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs" style={{ color: getSuitColor(card.suit) }}>
                      {getSuitSymbol(card.suit)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Экипировка */}
        {equipment.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-bold text-orange-400 mb-3 uppercase tracking-wider border-b border-gray-700 pb-1">Экипировка:</h3>
            <div className="flex gap-2 flex-wrap justify-center">
              {equipment.map(card => (
                <button
                  key={card.id}
                  onClick={() => onDiscard(card.id, 'equipment')}
                  className="w-16 h-24 bg-orange-900/60 border-2 border-orange-500 rounded hover:border-red-500 hover:scale-105 transition-all p-1"
                >
                  <div className="text-[10px] font-bold text-orange-200 text-center leading-tight">
                    {LOC.CARD_NAMES[card.type]}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Карты контроля */}
        {controlCards.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-bold text-yellow-400 mb-3 uppercase tracking-wider border-b border-gray-700 pb-1">Карты контроля:</h3>
            <div className="flex gap-2 flex-wrap justify-center">
              {controlCards.map(card => (
                <button
                  key={card.id}
                  onClick={() => onDiscard(card.id, 'control')}
                  className="w-16 h-24 bg-yellow-900/60 border-2 border-yellow-500 rounded hover:border-red-500 hover:scale-105 transition-all p-1"
                >
                  <div className="text-[10px] font-bold text-yellow-200 text-center leading-tight">
                    {LOC.CARD_NAMES[card.type]}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="text-center text-xs text-gray-500 mt-4 italic">
          Если вы не выберете карту за 15 секунд, она будет сброшена случайно.
        </div>
      </div>
    </div>
  );
}