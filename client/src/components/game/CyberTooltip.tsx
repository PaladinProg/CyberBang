// client/src/components/game/CyberTooltip.tsx
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CardType, CharacterId } from '@cyberbang/shared/types';
import { LOC } from '@cyberbang/shared/localization';

interface CyberTooltipProps {
  children: React.ReactNode;
  cardType?: CardType;
  characterId?: CharacterId;
  delayMs?: number; // По умолчанию 2000мс (2 секунды)
  className?: string;
}

export const CyberTooltip: React.FC<CyberTooltipProps> = ({
  children,
  cardType,
  characterId,
  delayMs = 2000,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        // Рассчитываем точку над центром элемента
        setCoords({
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
        });
        setIsVisible(true);
      }
    }, delayMs);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const cardName = cardType ? LOC.CARD_NAMES[cardType] : null;
  const cardDesc = cardType ? LOC.CARD_DESCRIPTIONS[cardType] : null;

  const charName = characterId ? LOC.CHARACTER_NAMES[characterId] : null;
  const charDesc = characterId ? LOC.CHARACTER_DESCRIPTIONS[characterId] : null;

  if (!cardType && !characterId) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={triggerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {/* Рендеринг через createPortal в document.body — гарантирует защиту от обрезания в overflow */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isVisible && coords && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'fixed',
                  left: `${coords.x}px`,
                  top: `${coords.y}px`,
                  transform: 'translate(-50%, -100%)',
                  zIndex: 99999,
                }}
                className="w-56 p-2.5 rounded-lg bg-[#0c1018]/95 border border-cyan-500/60 shadow-2xl shadow-black/90 backdrop-blur-md pointer-events-none text-left"
              >
                {/* Описание карты */}
                {cardType && (
                  <div>
                    <div className="flex items-center justify-between pb-1 mb-1 border-b border-cyan-900/50">
                      <span className="font-mono text-xs font-bold text-cyan-400">
                        {cardName}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400 uppercase">
                        {cardType}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-200 leading-snug">
                      {cardDesc}
                    </p>
                  </div>
                )}

                {/* Описание персонажа */}
                {characterId && (
                  <div>
                    <div className="flex items-center justify-between pb-1 mb-1 border-b border-indigo-900/50">
                      <span className="font-mono text-xs font-bold text-indigo-400">
                        {charName}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400 uppercase">
                        Герой
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-200 leading-snug">
                      {charDesc}
                    </p>
                  </div>
                )}

                {/* Стрелочка тултипа */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0c1018] border-r border-b border-cyan-500/60 rotate-45 -mt-1" />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};