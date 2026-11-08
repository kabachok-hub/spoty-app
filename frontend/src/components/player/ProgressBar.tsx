import React, { useState, useMemo, useRef } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { useCustomizationStore } from '../../store/customizationStore';

// 🐛 Worm (Optional cute cartoon green worm head)
const WormHead: React.FC<{ isPlaying: boolean; isDragging: boolean }> = ({ isPlaying, isDragging }) => (
  <div
    className={`relative flex items-center justify-center transition-transform select-none ${
      isDragging ? 'scale-125' : isPlaying ? 'scale-110' : 'scale-100'
    }`}
  >
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none" className="drop-shadow-[0_2px_8px_rgba(34,197,94,0.7)]">
      {/* Antennae */}
      <path d="M11 12 C9 7, 7 5, 5 7" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <circle cx="5" cy="7" r="2.2" fill="#facc15" />
      <path d="M21 12 C23 7, 25 5, 27 7" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <circle cx="27" cy="7" r="2.2" fill="#facc15" />
      {/* Head body */}
      <circle cx="16" cy="18" r="11" fill="url(#wormGrad)" />
      {/* Rosy cheeks */}
      <circle cx="9" cy="20" r="2.5" fill="#f472b6" opacity="0.8" />
      <circle cx="23" cy="20" r="2.5" fill="#f472b6" opacity="0.8" />
      {/* Large eyes */}
      <circle cx="12" cy="16" r="3.2" fill="#ffffff" />
      <circle cx="13" cy="16" r="1.8" fill="#0f172a" />
      <circle cx="13.6" cy="15.2" r="0.7" fill="#ffffff" />
      <circle cx="20" cy="16" r="3.2" fill="#ffffff" />
      <circle cx="21" cy="16" r="1.8" fill="#0f172a" />
      <circle cx="21.6" cy="15.2" r="0.7" fill="#ffffff" />
      {/* Smile */}
      <path d="M13.5 22 Q16 25 18.5 22" stroke="#14532d" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <defs>
        <radialGradient id="wormGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="60%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
      </defs>
    </svg>
  </div>
);

// 📷 Custom Photo Avatar (User-uploaded face from phone/PC)
const CustomThumb: React.FC<{ url: string; isPlaying: boolean; isDragging: boolean }> = ({ url, isPlaying, isDragging }) => (
  <div
    className={`relative flex items-center justify-center transition-all select-none ${
      isDragging ? 'scale-125' : isPlaying ? 'scale-110' : 'scale-100'
    }`}
  >
    <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-[var(--accent-color,#1DB954)] shadow-[0_0_12px_var(--accent-glow,rgba(29,185,84,0.75))] bg-black ring-1 ring-white/20">
      {url ? (
        <img src={url} alt="Custom Avatar" className="w-full h-full object-cover select-none pointer-events-none" />
      ) : (
        <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-xs">📷</div>
      )}
    </div>
  </div>
);

// 🎨 Current Track Artist Avatar
const ArtistThumb: React.FC<{ coverUrl?: string; isPlaying: boolean; isDragging: boolean }> = ({ coverUrl, isPlaying, isDragging }) => (
  <div
    className={`relative w-6 h-6 rounded-full overflow-hidden border-2 border-white shadow-lg transition-transform select-none ${
      isDragging ? 'scale-125' : isPlaying ? 'scale-110 shadow-[0_0_10px_var(--accent-glow,rgba(29,185,84,0.6))]' : 'scale-100'
    }`}
  >
    {coverUrl ? (
      <img src={coverUrl} alt="Cover" className="w-full h-full object-cover select-none pointer-events-none" />
    ) : (
      <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-[10px] text-white">🎵</div>
    )}
  </div>
);

// 💿 Spinning Vinyl Record
const VinylThumb: React.FC<{ isPlaying: boolean; isDragging: boolean }> = ({ isPlaying, isDragging }) => (
  <div
    className={`relative w-6 h-6 rounded-full bg-zinc-950 border border-zinc-700 shadow-md flex items-center justify-center transition-transform select-none ${
      isDragging ? 'scale-125' : isPlaying ? 'scale-110 animate-[spin_3s_linear_infinite]' : 'scale-100'
    }`}
  >
    <div className="absolute inset-1 rounded-full border border-white/10" />
    <div className="absolute inset-1.5 rounded-full border border-white/10" />
    <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-color,#1DB954)] flex items-center justify-center shadow-inner">
      <div className="w-0.5 h-0.5 rounded-full bg-black" />
    </div>
  </div>
);

// 🔥 Fire Flame
const FireThumb: React.FC<{ isPlaying: boolean; isDragging: boolean }> = ({ isPlaying, isDragging }) => (
  <div
    className={`relative flex items-center justify-center transition-transform select-none ${
      isDragging ? 'scale-125' : isPlaying ? 'scale-110 animate-pulse' : 'scale-100'
    }`}
  >
    <span className="text-lg filter drop-shadow-[0_2px_6px_rgba(239,68,68,0.7)] select-none pointer-events-none">🔥</span>
  </div>
);

// ❤️ Pulsing Heart
const HeartThumb: React.FC<{ isPlaying: boolean; isDragging: boolean }> = ({ isPlaying, isDragging }) => (
  <div
    className={`relative flex items-center justify-center transition-transform select-none ${
      isDragging ? 'scale-125' : isPlaying ? 'scale-110 animate-bounce' : 'scale-100'
    }`}
  >
    <span className="text-lg filter drop-shadow-[0_2px_6px_rgba(244,63,94,0.7)] select-none pointer-events-none">❤️</span>
  </div>
);

// ⚪ Classic Minimalist Dot
const ClassicThumb: React.FC<{ isDragging: boolean }> = ({ isDragging }) => (
  <div
    className={`w-3.5 h-3.5 bg-white rounded-full shadow-md transition-transform ${
      isDragging ? 'scale-125 opacity-100' : 'opacity-0 group-hover:opacity-100'
    }`}
    style={{
      boxShadow: '0 0 10px rgba(0,0,0,0.5), 0 0 6px var(--accent-color, #1DB954)',
    }}
  />
);

interface ProgressBarProps {
  showTime?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ showTime = true, className = '' }) => {
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const seek = usePlayerStore((state) => state.seek);

  const sliderStyle = useCustomizationStore((state) => state.sliderStyle);
  const seekbarThumb = useCustomizationStore((state) => state.seekbarThumb);
  const customThumbUrl = useCustomizationStore((state) => state.customThumbUrl);

  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const dragTimeRef = useRef(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const currentSec = isDragging ? dragTime : currentTime;
  const progressPercent = duration > 0 ? (currentSec / duration) * 100 : 0;
  const clampedPercent = Math.min(100, Math.max(0, progressPercent));

  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec) || sec < 0) return '0:00';
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getTimeFromClientX = (clientX: number): number => {
    if (!trackRef.current || !duration || duration <= 0) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const ratio = clickX / rect.width;
    return Math.min(duration, Math.max(0, ratio * duration));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    const initialTime = getTimeFromClientX(e.clientX);
    dragTimeRef.current = initialTime;
    setDragTime(initialTime);

    const onPointerMove = (moveEvt: PointerEvent) => {
      const movedTime = getTimeFromClientX(moveEvt.clientX);
      dragTimeRef.current = movedTime;
      setDragTime(movedTime);
    };

    const onPointerUp = (upEvt: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      const finalTime = getTimeFromClientX(upEvt.clientX);
      setIsDragging(false);
      seek(finalTime);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  // Generate pseudo-random deterministic waveform bar heights
  const waveformBars = useMemo(() => {
    const bars: number[] = [];
    const count = 48;
    for (let i = 0; i < count; i++) {
      const h = Math.sin(i * 0.28) * 35 + Math.cos(i * 0.7) * 20 + 40;
      bars.push(Math.max(15, Math.min(90, Math.round(h))));
    }
    return bars;
  }, []);

  return (
    <div className={`w-full ${showTime ? 'flex flex-col gap-1.5' : 'flex flex-col'} select-none ${className}`}>
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        className={`relative group flex items-center ${showTime ? 'h-6' : 'h-3.5'} cursor-pointer touch-none select-none`}
      >
        {/* ── STYLE 1: WAVEFORM BARS (Dootify style) ── */}
        {sliderStyle === 'waveform' && (
          <div className="w-full flex items-center justify-between h-5 gap-[2px] overflow-hidden">
            {waveformBars.map((h, i) => {
              const barPercent = (i / waveformBars.length) * 100;
              const isFilled = barPercent <= clampedPercent;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-full transition-all duration-150"
                  style={{
                    height: `${isPlaying && isFilled ? Math.min(100, h + (i % 3 === 0 ? 8 : -4)) : h}%`,
                    backgroundColor: isFilled ? 'var(--accent-color, #1DB954)' : 'rgba(255, 255, 255, 0.18)',
                    boxShadow: isFilled ? '0 0 6px var(--accent-glow, rgba(29,185,84,0.4))' : 'none',
                  }}
                />
              );
            })}
          </div>
        )}

        {/* ── STYLE 2: WAVE / SINUSOID (Dootify smooth SVG wave) ── */}
        {sliderStyle === 'wave' && (
          <div className="w-full h-3.5 flex items-center relative overflow-hidden">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 10">
              {/* Background wave track */}
              <path
                d="M 0 5 Q 5 1.5, 10 5 T 20 5 T 30 5 T 40 5 T 50 5 T 60 5 T 70 5 T 80 5 T 90 5 T 100 5"
                fill="none"
                stroke="rgba(255, 255, 255, 0.22)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Filled wave track */}
              <path
                d="M 0 5 Q 5 1.5, 10 5 T 20 5 T 30 5 T 40 5 T 50 5 T 60 5 T 70 5 T 80 5 T 90 5 T 100 5"
                fill="none"
                stroke="var(--accent-color, #1DB954)"
                strokeWidth="2.8"
                strokeLinecap="round"
                pathLength="100"
                strokeDasharray="100"
                strokeDashoffset={100 - clampedPercent}
                style={{ filter: 'drop-shadow(0 0 6px var(--accent-glow, rgba(29,185,84,0.6)))' }}
              />
            </svg>
          </div>
        )}

        {/* ── STYLE 3: THIN (Ultra minimalist 2px) ── */}
        {sliderStyle === 'thin' && (
          <div className="w-full h-[2px] bg-white/15 rounded-full overflow-hidden">
            <div
              className="h-full transition-all"
              style={{
                width: `${clampedPercent}%`,
                backgroundColor: 'var(--accent-color, #1DB954)',
                boxShadow: '0 0 8px var(--accent-glow, rgba(29,185,84,0.6))',
              }}
            />
          </div>
        )}

        {/* ── STYLE 4: SMOOTH GRADIENT ── */}
        {sliderStyle === 'smooth' && (
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden p-[1px]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${clampedPercent}%`,
                background: 'linear-gradient(90deg, #10b981 0%, var(--accent-color, #1DB954) 50%, #38bdf8 100%)',
                boxShadow: '0 0 10px var(--accent-glow, rgba(29,185,84,0.5))',
              }}
            />
          </div>
        )}

        {/* ── STYLE 5: CLASSIC (Standard Spotify) ── */}
        {sliderStyle === 'classic' && (
          <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden group-hover:h-1.5 transition-all">
            <div
              className="h-full transition-colors"
              style={{
                width: `${clampedPercent}%`,
                backgroundColor: 'var(--accent-color, #1DB954)',
              }}
            />
          </div>
        )}

        {/* Real hidden range input over the visual track */}
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentSec}
          readOnly
          tabIndex={-1}
          className="absolute inset-0 w-full opacity-0 pointer-events-none"
        />

        {/* Custom Seekbar Thumb (Kai Angel, 9mice, Artist, Vinyl, Fire, Heart, Classic, etc.) */}
        {(sliderStyle !== 'waveform' || seekbarThumb !== 'classic') && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-20 flex items-center justify-center transition-[left] duration-75"
            style={{ left: `${clampedPercent}%` }}
          >
            {seekbarThumb === 'worm' && <WormHead isPlaying={isPlaying} isDragging={isDragging} />}
            {seekbarThumb === 'custom' && <CustomThumb url={customThumbUrl} isPlaying={isPlaying} isDragging={isDragging} />}
            {seekbarThumb === 'artist' && <ArtistThumb coverUrl={currentTrack?.cover_url} isPlaying={isPlaying} isDragging={isDragging} />}
            {seekbarThumb === 'vinyl' && <VinylThumb isPlaying={isPlaying} isDragging={isDragging} />}
            {seekbarThumb === 'fire' && <FireThumb isPlaying={isPlaying} isDragging={isDragging} />}
            {seekbarThumb === 'heart' && <HeartThumb isPlaying={isPlaying} isDragging={isDragging} />}
            {seekbarThumb === 'classic' && <ClassicThumb isDragging={isDragging} />}
          </div>
        )}
      </div>

      {showTime && (
        <div className="flex justify-between items-center text-[11px] font-medium text-zinc-400">
          <span>{formatTime(currentSec)}</span>
          <span>-{formatTime(Math.max(0, duration - currentSec))}</span>
        </div>
      )}
    </div>
  );
};
