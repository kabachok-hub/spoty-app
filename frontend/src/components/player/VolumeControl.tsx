import React, { useEffect, useRef, useState } from 'react';
import { Volume1, Volume2, VolumeX, Minus, Plus } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useTelegram } from '../../hooks/useTelegram';

interface VolumeControlProps {
  className?: string;
  showPercentage?: boolean;
  showStepButtons?: boolean;
  showPresets?: boolean;
}

const MAX_VOLUME = 1.5;

export const VolumeControl: React.FC<VolumeControlProps> = ({
  className = '',
  showPercentage = true,
  showStepButtons = true,
  showPresets = false,
}) => {
  const volume = usePlayerStore((state) => state.volume);
  const isMuted = usePlayerStore((state) => state.isMuted);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const toggleMute = usePlayerStore((state) => state.toggleMute);
  const { haptic } = useTelegram();
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; left: number; width: number } | null>(null);
  const frame = useRef<number | null>(null);
  const pending = useRef<number | null>(null);
  const flush = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (pending.current !== null) setVolume(pending.current);
    pending.current = null;
  };
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  const currentVolume = isMuted ? 0 : volume;
  const volumePercent = Math.round(currentVolume * 100);
  const fillPercent = Math.min(100, Math.max(0, (currentVolume / MAX_VOLUME) * 100));

  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.selection();
    toggleMute();
  };

  const handleStepDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.impact('light');
    let newVol: number;
    if (currentVolume <= 0.05) {
      newVol = Math.max(0, Math.round((currentVolume - 0.01) * 100) / 100);
    } else if (currentVolume <= 0.2) {
      newVol = Math.max(0, Math.round((currentVolume - 0.02) * 100) / 100);
    } else {
      newVol = Math.max(0, Math.round((currentVolume - 0.1) * 10) / 10);
    }
    setVolume(newVol);
  };

  const handleStepUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.impact('light');
    let newVol: number;
    if (currentVolume < 0.05) {
      newVol = Math.min(MAX_VOLUME, Math.round((currentVolume + 0.01) * 100) / 100);
    } else if (currentVolume < 0.2) {
      newVol = Math.min(MAX_VOLUME, Math.round((currentVolume + 0.02) * 100) / 100);
    } else {
      newVol = Math.min(MAX_VOLUME, Math.round((currentVolume + 0.1) * 10) / 10);
    }
    setVolume(newVol);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || !e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    target.focus({ preventScroll: true });
    target.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, left: rect.left, width: rect.width };
    setDragging(true);
    haptic.selection();
    updatePointer(e.clientX);
  };

  const updatePointer = (clientX: number) => {
    if (!drag.current) return;
    pending.current = Math.max(0, Math.min(1, (clientX - drag.current.left) / drag.current.width)) * MAX_VOLUME;
    if (frame.current === null) frame.current = requestAnimationFrame(flush);
  };
  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== drag.current?.id) return;
    if (event.type === 'pointerup') updatePointer(event.clientX);
    flush();
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const getVolumeIcon = () => {
    if (isMuted || currentVolume === 0) {
      return <VolumeX size={19} className="text-red-400" />;
    }
    if (currentVolume < 0.4) {
      return <Volume1 size={19} className="text-[#1DB954]" />;
    }
    return <Volume2 size={19} className={currentVolume > 1.0 ? 'text-amber-300' : 'text-[#1DB954]'} />;
  };

  return (
    <div className={`flex flex-col gap-2 select-none ${className}`}>
      <div className="flex items-center gap-2.5">
        {/* Mute toggle button */}
        <button
          onClick={handleMuteToggle}
          className="p-1.5 text-zinc-400 hover:text-white transition flex-shrink-0 active:scale-90"
          title={isMuted ? 'Включить звук' : 'Выключить звук'}
          aria-label="Mute/Unmute"
        >
          {getVolumeIcon()}
        </button>

        {/* Step Down Button */}
        {showStepButtons && (
          <button
            onClick={handleStepDown}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-zinc-300 hover:text-white transition flex-shrink-0"
            title="Тише"
            aria-label="Decrease volume"
          >
            <Minus size={14} strokeWidth={2.5} />
          </button>
        )}

        {/* Custom Touch & Drag Spotify Green Slider */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={event => { if (event.pointerId === drag.current?.id) updatePointer(event.clientX); }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          role="slider" tabIndex={0} aria-label="Громкость" aria-valuemin={0} aria-valuemax={150} aria-valuenow={volumePercent} aria-valuetext={`${volumePercent}%`}
          onKeyDown={event => {
            const values: Record<string, number> = { ArrowLeft: currentVolume-.01, ArrowDown: currentVolume-.01, ArrowRight: currentVolume+.01, ArrowUp: currentVolume+.01, PageDown: currentVolume-.1, PageUp: currentVolume+.1, Home: 0, End: MAX_VOLUME };
            if (event.key in values) { event.preventDefault(); event.stopPropagation(); setVolume(Math.max(0,Math.min(MAX_VOLUME,Math.round(values[event.key]*100)/100))); }
          }}
          className="relative min-w-0 flex-1 h-8 flex items-center cursor-pointer touch-none group outline-none focus-visible:ring-2 focus-visible:ring-[#1DB954]/60 rounded-full"
        >
          <span data-testid="volume-tooltip" aria-hidden="true"
            className={`absolute bottom-full mb-1 -translate-x-1/2 rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-semibold tabular-nums text-white shadow-lg pointer-events-none ${dragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`}
            style={{ left: `${fillPercent}%` }}>
            {volumePercent}%
          </span>
          {/* Track background */}
          <div className="w-full h-1.5 bg-zinc-700/80 rounded-full overflow-hidden relative">
            {/* 100% threshold marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/30 z-10"
              style={{ left: '66.67%' }}
              title="100% (Базовая громкость)"
            />

            {/* Dynamic Progress Fill */}
            <div
              className={`h-full ${
                isMuted
                  ? 'bg-zinc-500'
                  : currentVolume > 1.0
                  ? 'bg-gradient-to-r from-[#1DB954] via-emerald-400 to-amber-300'
                  : 'bg-[#1DB954]'
              }`}
              style={{ width: `${fillPercent}%` }}
            />
          </div>

          {/* Visible Circular Thumb Handle */}
          <div
            className={`absolute w-3.5 h-3.5 bg-white border-2 rounded-full shadow-md pointer-events-none -translate-x-1/2 ${
              currentVolume > 1.0 ? 'border-amber-300' : 'border-[#1DB954]'
            }`}
            style={{ left: `${fillPercent}%` }}
          />
        </div>

        {/* Step Up Button */}
        {showStepButtons && (
          <button
            onClick={handleStepUp}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-zinc-300 hover:text-white transition flex-shrink-0"
            title="Громче"
            aria-label="Increase volume"
          >
            <Plus size={14} strokeWidth={2.5} />
          </button>
        )}

        {/* Percentage readout */}
        {showPercentage && (
          <span
            className={`text-xs font-bold w-12 text-right flex-shrink-0 tabular-nums ${
              currentVolume > 1.0 ? 'text-amber-300' : 'text-zinc-300'
            }`}
          >
            {volumePercent}%
          </span>
        )}
      </div>

      {/* Quick Preset Chips */}
      {showPresets && (
        <div className="flex items-center justify-center gap-1.5 pt-0.5 flex-wrap">
          {[
            { label: 'Тихо 5%', val: 0.05 },
            { label: '25%', val: 0.25 },
            { label: '50%', val: 0.50 },
            { label: '100%', val: 1.00 },
            { label: '150% 🚀', val: 1.50 },
          ].map((preset) => (
            <button
              key={preset.val}
              onClick={(e) => {
                e.stopPropagation();
                haptic.selection();
                setVolume(preset.val);
              }}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition ${
                Math.abs(currentVolume - preset.val) < 0.04
                  ? preset.val > 1.0
                    ? 'bg-amber-300 text-black font-bold'
                    : 'bg-[#1DB954] text-black font-bold'
                  : 'bg-white/10 text-zinc-300 hover:bg-white/20 active:scale-95'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
