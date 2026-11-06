import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, X, Music, Volume2 } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTelegram } from '../../hooks/useTelegram';

export const TopMusicCloud: React.FC = () => {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playToken = usePlayerStore((state) => state.playToken);
  const isFullscreen = usePlayerStore((state) => state.isFullscreen);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const nextTrack = usePlayerStore((state) => state.nextTrack);
  const setFullscreen = usePlayerStore((state) => state.setFullscreen);

  const showTopCloud = useSettingsStore((state) => state.showTopCloud);
  const t = useSettingsStore((state) => state.t);
  const { haptic } = useTelegram();

  const [visible, setVisible] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTrackIdRef = useRef<string | null>(null);

  // Trigger drop-down cloud on track change or playback restart
  useEffect(() => {
    if (!currentTrack || !showTopCloud || isFullscreen) {
      setVisible(false);
      return;
    }

    // New track or restarted playback
    setVisible(true);
    setIsCompact(false);

    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
    }

    // Auto-compact after 6 seconds of playing
    autoHideTimerRef.current = setTimeout(() => {
      setIsCompact(true);
    }, 6000);

    prevTrackIdRef.current = currentTrack.id;

    return () => {
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    };
  }, [currentTrack?.id, playToken, showTopCloud, isFullscreen]);

  if (!showTopCloud || !currentTrack || isFullscreen || !visible) {
    return null;
  }

  const handleCloudClick = () => {
    haptic.impact('light');
    setFullscreen(true);
  };

  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.impact('light');
    togglePlay();
  };

  const handleNextTrack = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.impact('light');
    nextTrack();
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.selection();
    setVisible(false);
  };

  return (
    <div
      className={`fixed left-3 right-3 max-w-sm sm:max-w-md mx-auto z-40 transition-all duration-500 ease-out select-none ${
        isCompact ? 'top-1 sm:top-2 opacity-85 hover:opacity-100' : 'top-3 sm:top-4 opacity-100'
      }`}
    >
      <div
        onClick={handleCloudClick}
        className={`group relative flex items-center justify-between rounded-full bg-[#161616]/95 hover:bg-[#202020]/95 backdrop-blur-xl border border-white/15 shadow-2xl shadow-black/90 cursor-pointer transition-all duration-300 active:scale-[0.98] ${
          isCompact ? 'py-1.5 px-3' : 'py-2 px-3.5'
        }`}
      >
        {/* Left: Album cover with spinning / live equalizer indicator */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="relative flex-shrink-0">
            <img
              src={currentTrack.cover_url || '/placeholder.png'}
              alt={currentTrack.title}
              className={`rounded-full object-cover shadow-md ring-1.5 ring-[#1DB954]/50 transition-all duration-300 ${
                isCompact ? 'w-7 h-7' : 'w-9 h-9'
              } ${isPlaying ? 'animate-[spin_8s_linear_infinite]' : ''}`}
            />
            {/* Center vinyl hole */}
            <div className="absolute inset-0 m-auto w-2 h-2 rounded-full bg-black ring-1 ring-zinc-700 pointer-events-none" />
          </div>

          {/* Title & Artist info */}
          <div className="min-w-0 flex-1 pr-1">
            {!isCompact && (
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-pulse" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1DB954]">
                  {isPlaying ? 'Сейчас играет' : 'Пауза'}
                </span>
              </div>
            )}
            <div className="text-xs font-extrabold text-white truncate leading-tight">
              {currentTrack.title}
            </div>
            <div className="text-[11px] text-zinc-400 truncate leading-none mt-0.5">
              {currentTrack.artist_name}
            </div>
          </div>
        </div>

        {/* Center-Right: Animated 3-bar Sound Visualizer */}
        {isPlaying && (
          <div className="flex items-end gap-0.5 h-4 px-1.5 flex-shrink-0">
            <span className="w-0.5 bg-[#1DB954] rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-2.5" />
            <span className="w-0.5 bg-[#1DB954] rounded-full animate-[pulse_0.8s_ease-in-out_0.2s_infinite] h-4" />
            <span className="w-0.5 bg-[#1DB954] rounded-full animate-[pulse_0.5s_ease-in-out_0.4s_infinite] h-3" />
          </div>
        )}

        {/* Right Controls */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
          {/* Play / Pause */}
          <button
            onClick={handleTogglePlay}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-white flex items-center justify-center transition shadow"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={13} className="fill-white" />
            ) : (
              <Play size={13} className="fill-white translate-x-0.5" />
            )}
          </button>

          {/* Next Track */}
          <button
            onClick={handleNextTrack}
            className="w-7 h-7 rounded-full hover:bg-white/10 active:scale-90 text-zinc-400 hover:text-white flex items-center justify-center transition"
            aria-label="Next track"
          >
            <SkipForward size={14} />
          </button>

          {/* Dismiss cross */}
          {!isCompact && (
            <button
              onClick={handleDismiss}
              className="w-5 h-5 rounded-full hover:bg-white/10 active:scale-90 text-zinc-500 hover:text-zinc-300 flex items-center justify-center transition ml-0.5"
              aria-label="Dismiss cloud"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
