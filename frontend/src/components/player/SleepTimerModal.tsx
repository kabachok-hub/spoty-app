import React from 'react';
import { Moon, X, Check } from 'lucide-react';
import { useSleepTimer } from '../../hooks/useSleepTimer';
import { useTelegram } from '../../hooks/useTelegram';

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESETS = [
  { label: '5 мин', minutes: 5 },
  { label: '15 мин', minutes: 15 },
  { label: '30 мин', minutes: 30 },
  { label: '45 мин', minutes: 45 },
  { label: '1 час', minutes: 60 },
  { label: '1.5 часа', minutes: 90 },
];

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({ isOpen, onClose }) => {
  const { timeLeft, isActive, setTimer, cancelTimer, formatTime } = useSleepTimer();
  const { haptic } = useTelegram();

  if (!isOpen) return null;

  const handlePreset = (minutes: number) => {
    haptic.impact('medium');
    setTimer(minutes);
  };

  const handleCancel = () => {
    haptic.impact('light');
    cancelTimer();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[61] bg-[#1a1a1a] rounded-t-3xl p-5 pb-8 shadow-2xl animate-slide-up">
        {/* Handle */}
        <div className="mx-auto w-10 h-1 bg-zinc-700 rounded-full mb-5" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <Moon size={22} className="text-[#1DB954]" />
            <h2 className="text-lg font-bold text-white">Таймер сна</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white transition rounded-full hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Active timer display */}
        {isActive && (
          <div className="mb-5 p-4 bg-[#1DB954]/10 border border-[#1DB954]/30 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-xs text-zinc-400 uppercase tracking-wider mb-0.5">Музыка остановится через</div>
              <div className="text-3xl font-bold text-[#1DB954] tabular-nums">{formatTime(timeLeft)}</div>
            </div>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white rounded-full text-sm font-semibold transition active:scale-95"
            >
              <X size={14} />
              Отменить
            </button>
          </div>
        )}

        {/* Presets */}
        <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 px-1">
          {isActive ? 'Изменить таймер' : 'Выбери время'}
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {PRESETS.map(({ label, minutes }) => {
            const isSelected = isActive && timeLeft > 0 && Math.abs(timeLeft - minutes * 60) < 5;
            return (
              <button
                key={minutes}
                onClick={() => handlePreset(minutes)}
                className={`relative flex items-center justify-center py-3.5 rounded-2xl text-sm font-bold transition active:scale-95 ${
                  isSelected
                    ? 'bg-[#1DB954] text-black shadow-lg shadow-[#1DB954]/30'
                    : 'bg-white/8 text-zinc-200 hover:bg-white/15 border border-white/8'
                }`}
              >
                {isSelected && (
                  <Check size={13} className="absolute top-2 right-2.5 opacity-70" />
                )}
                {label}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-zinc-600 text-center mt-4 px-4">
          Музыка автоматически остановится через выбранное время
        </p>
      </div>
    </>
  );
};
