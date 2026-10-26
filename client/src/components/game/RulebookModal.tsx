import React, { useState } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  BookOpen, 
  Shield, 
  Crosshair, 
  Zap, 
  Users, 
  AlertTriangle, 
  Award, 
  Layers, 
  Flame, 
  Bomb, 
  Lock, 
  Eye, 
  RefreshCw 
} from 'lucide-react';

interface RulebookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'GOAL' | 'FLOW' | 'ROLES' | 'CARDS' | 'CONTROLS';

export const RulebookModal: React.FC<RulebookModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('GOAL');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div 
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="relative w-full max-w-4xl max-h-[90vh] bg-[#0c1018] border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-950/50 flex flex-col overflow-hidden text-slate-100 font-sans"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-cyan-900/50 bg-[#111723] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                  КИБЕР-СПРАВОЧНИК <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">CyberBang Rulebook</span>
                </h2>
                <p className="text-xs text-slate-400">Правила кибернетической перестрелки, роли и механики карт</p>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors border border-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="px-6 py-2.5 bg-[#090d14] border-b border-slate-800 flex space-x-2 overflow-x-auto shrink-0">
            {[
              { id: 'GOAL', label: 'Цель & Роли', icon: Award },
              { id: 'FLOW', label: 'Фазы хода', icon: RefreshCw },
              { id: 'CARDS', label: 'Типы карт', icon: Zap },
              { id: 'CONTROLS', label: 'Карантин & Бомба', icon: Bomb },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    isActive 
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
            
            {/* ТАБ 1: ЦЕЛЬ И РОЛИ */}
            {activeTab === 'GOAL' && (
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-xs sm:text-sm text-cyan-200 leading-relaxed">
                  <span className="font-bold text-cyan-300">Суть игры:</span> CyberBang — психологическая карточная игра со скрытыми ролями. Только роль 
                  <span className="text-yellow-400 font-bold"> Системного Администратора (Шерифа)</span> известна всем с самого начала. Остальные держат свои роли в секрете до гибели!
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Администратор */}
                  <div className="p-4 rounded-xl bg-yellow-950/20 border border-yellow-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-yellow-400 flex items-center gap-2">
                        <Shield className="w-4 h-4" /> Администратор (Шериф)
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-yellow-950 text-yellow-300 border border-yellow-800">
                        Открытая роль (+1 HP)
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Всегда ходит первым. Имеет на 1 HP больше своего персонажа.
                    </p>
                    <div className="text-xs text-yellow-200/90 font-medium">
                      🎯 <span className="underline">Цель:</span> Ликвидировать всех Хакеров и Киберпсиха, защитив серверную сеть.
                    </div>
                  </div>

                  {/* Заместитель */}
                  <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-blue-400 flex items-center gap-2">
                        <Users className="w-4 h-4" /> Заместитель (Помощник)
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                        Тайная роль
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Верный союзник Шерифа. Побеждает, если Шериф выживает и побеждает.
                    </p>
                    <div className="text-xs text-blue-200/90 font-medium">
                      🎯 <span className="underline">Цель:</span> Защищать Администратора любой ценой и уничтожать угрозы.
                    </div>
                  </div>

                  {/* Хакеры */}
                  <div className="p-4 rounded-xl bg-red-950/20 border border-red-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-red-400 flex items-center gap-2">
                        <Crosshair className="w-4 h-4" /> Хакеры (Бандиты)
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800">
                        Тайная роль
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Не знают ролей друг друга, но имеют общую задачу. За убийство бандита даётся награда +3 карты!
                    </p>
                    <div className="text-xs text-red-200/90 font-medium">
                      🎯 <span className="underline">Цель:</span> Убить Системного Администратора.
                    </div>
                  </div>

                  {/* Киберпсих */}
                  <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-purple-400 flex items-center gap-2">
                        <Flame className="w-4 h-4" /> Киберпсих (Ренегат)
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                        Одиночка
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Самая сложная роль. Должен остаться последним выжившим один на один с Админом, и убить его в финальной дуэли.
                    </p>
                    <div className="text-xs text-purple-200/90 font-medium">
                      🎯 <span className="underline">Цель:</span> Остаться единственным выжившим игроком в живых.
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* ТАБ 2: ФАЗЫ ХОДА */}
            {activeTab === 'FLOW' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 font-mono font-bold flex items-center justify-center text-xs">
                      1
                    </div>
                    <h4 className="font-bold text-white">UPLOAD (Добор)</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      В начале хода активный игрок берёт <span className="text-cyan-300 font-semibold">2 карты</span> из колоды. Если перед игроком лежит Карантин или Логическая бомба, сначала срабатывают проверки удачи.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-cyan-500/30 space-y-2">
                    <div className="w-7 h-7 rounded-full bg-cyan-500/30 text-cyan-300 font-mono font-bold flex items-center justify-center text-xs">
                      2
                    </div>
                    <h4 className="font-bold text-white">EXECUTE (Розыгрыш)</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Разыгрывайте любое количество карт. Ограничение: <span className="text-amber-300 font-semibold">только 1 ПИНГ! (выстрел)</span> за ход (если нет импланта "Вулкан"). Перетаскивайте карты на соперников или на стол.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 font-mono font-bold flex items-center justify-center text-xs">
                      3
                    </div>
                    <h4 className="font-bold text-white">PURGE (Сброс)</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      К концу хода в руке не может оставаться больше карт, чем <span className="text-emerald-300 font-semibold">текущее HP</span>. Излишки сбрасываются нажатием на кнопку завершения хода.
                    </p>
                  </div>

                </div>

                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-xs space-y-2 text-slate-300">
                  <span className="font-bold text-cyan-400">Правило Дистанции:</span>
                  <p>
                    Базовая дистанция между соседними живыми игроками равна 1. Увеличение дальности оружия (до 4) позволяет доставать игроков через 2-3 позиции. 
                    <span className="text-indigo-300"> Протокол "Призрак"</span> увеличивает расстояние до вас на +1, а <span className="text-purple-300">Снайперский модуль</span> сокращает дистанцию от вас до всех на -1.
                  </p>
                </div>
              </div>
            )}

            {/* ТАБ 3: ТИПЫ КАРТ */}
            {activeTab === 'CARDS' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-mono font-bold text-cyan-400 block mb-1">ПИНГ! (Выстрел)</span>
                    <p className="text-slate-400">Наносит 1 урон игроку на допустимой дистанции. Лимит: 1 выстрел в ход.</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-mono font-bold text-emerald-400 block mb-1">ФАЙРВОЛЛ (Мимо)</span>
                    <p className="text-slate-400">Отменяет входящее попадание от ПИНГа или Зенитной турели. Играется из модального окна защиты за 10 сек.</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-mono font-bold text-amber-400 block mb-1">СТИМУЛЯТОР (Пиво)</span>
                    <p className="text-slate-400">Восстанавливает 1 HP (вплоть до максимального). Не действует, когда в живых осталось всего 2 игрока.</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-mono font-bold text-indigo-400 block mb-1">Оружие (Пистолет, Шеллы, Вулкан)</span>
                    <p className="text-slate-400">Экипируется на стол (перетаскиванием). Даёт радиус атаки 2, 3, 4 или неограниченные выстрелы ("Вулкан").</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-mono font-bold text-purple-400 block mb-1">ЗЕНИТКА & DDoS</span>
                    <p className="text-slate-400">Массовые атаки: Зенитка стреляет во всех сразу, DDoS заставляет всех сбросить ПИНГ или получить урон.</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-mono font-bold text-pink-400 block mb-1">ВПН & СОЦ. ИНЖЕНЕРИЯ</span>
                    <p className="text-slate-400">ВПН забирает карту соперника на дистанции 1, а Соц. инженерия заставляет сбросить карту на любой дистанции.</p>
                  </div>

                </div>
              </div>
            )}

            {/* ТАБ 4: КОНТРОЛЬ */}
            {activeTab === 'CONTROLS' && (
              <div className="space-y-4">
                
                {/* Карантин */}
                <div className="p-4 rounded-xl bg-slate-900 border border-amber-800/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-amber-400 flex items-center gap-2">
                      <Lock className="w-4 h-4" /> КАРАНТИН (Тюрьма)
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                      Карта контроля
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Вешается перетаскиванием на любого соперника (<span className="text-white font-semibold">Администратора сажать в Карантин запрещено</span>).
                  </p>
                  <div className="p-3 rounded bg-amber-950/30 border border-amber-800/50 text-xs text-amber-200">
                    🔍 <span className="font-bold">Проверка в начале хода:</span> Из колоды тянется карта. Если масть <span className="text-red-400 font-bold">ЧЕРВИ (♥)</span> — игрок свободен и ходит! Любая другая масть — игрок сбрасывает Карантин и полностью пропускает свой ход.
                  </div>
                </div>

                {/* Логическая бомба */}
                <div className="p-4 rounded-xl bg-slate-900 border border-red-800/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-red-400 flex items-center gap-2">
                      <Bomb className="w-4 h-4" /> ЛОГИЧЕСКАЯ БОМБА (Динамит)
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800">
                      Смертельная угроза
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Выкладывается перед собой на стол. Начинает действовать со следующего круга.
                  </p>
                  <div className="p-3 rounded bg-red-950/30 border border-red-800/50 text-xs text-red-200">
                    💥 <span className="font-bold">Проверка в начале хода:</span> Тянется карта из колоды. Если выпала масть <span className="text-cyan-300 font-bold">ПИКИ (♠)</span> с рангом от <span className="font-bold">2 до 9</span> — происходит взрыв, игрок моментально теряет <span className="font-bold text-red-400">3 HP</span>! Если взрыва нет — бомба передаётся следующему живому игроку по часовой стрелке.
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-[#0a0e16] border-t border-slate-800 flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors"
            >
              Понятно, в бой!
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};