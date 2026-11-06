import { refreshRecording } from '../../hooks/refreshRecording';
import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Volume1,
  Volume2,
  VolumeX,
  ChevronDown,
  Maximize2,
  ListMusic,
  FileText,
  PanelRight,
  Download,
  RefreshCw,
} from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useUserStore } from '../../store/userStore';
import { DislikeButton } from './DislikeButton';
import { useTelegram } from '../../hooks/useTelegram';
import { useNavigationStore } from '../../store/navigationStore';
import { VolumeControl } from './VolumeControl';
import { api } from '../../api/client';
import { useCustomizationStore } from '../../store/customizationStore';
import { ProgressBar } from './ProgressBar';

export const MiniPlayer: React.FC = () => {
  const coverFilter = useCustomizationStore((state) => state.coverFilter);
  const openArtist = useNavigationStore((state) => state.openArtist);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const nextTrack = usePlayerStore((state) => state.nextTrack);
  const prevTrack = usePlayerStore((state) => state.prevTrack);
  const isShuffle = usePlayerStore((state) => state.isShuffle);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const repeatMode = usePlayerStore((state) => state.repeatMode);
  const cycleRepeatMode = usePlayerStore((state) => state.cycleRepeatMode);
  const setFullscreen = usePlayerStore((state) => state.setFullscreen);
  const isFullscreen = usePlayerStore((state) => state.isFullscreen);
  const setQueueOpen = usePlayerStore((state) => state.setQueueOpen);
  const isNowPlayingOpen = usePlayerStore((state) => state.isNowPlayingOpen);
  const setNowPlayingOpen = usePlayerStore((state) => state.setNowPlayingOpen);
  const toggleNowPlaying = usePlayerStore((state) => state.toggleNowPlaying);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const seek = usePlayerStore((state) => state.seek);
  const volume = usePlayerStore((state) => state.volume);
  const isMuted = usePlayerStore((state) => state.isMuted);

  const isLiked = useUserStore((state) =>
    currentTrack ? state.isLiked(currentTrack.id) : false
  );
  const toggleLike = useUserStore((state) => state.toggleLike);

  const { haptic } = useTelegram();
  const [showVolumePanel, setShowVolumePanel] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [dragProgressTime, setDragProgressTime] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshTrack = async () => {
    if (!currentTrack) return;
    haptic.impact('medium');
    setIsRefreshing(true);
    try {
      await refreshRecording(currentTrack);
      haptic.notification('success');
    } catch (err) {
      console.error('Refresh track failed:', err);
      haptic.notification('error');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!currentTrack || isFullscreen) return null;

  const currentVolume = isMuted ? 0 : volume;
  const activeTime = isDraggingProgress ? dragProgressTime : currentTime;
  const progressPercent = duration > 0 ? (activeTime / duration) * 100 : 0;

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleProgressPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    haptic.selection();
    setIsDraggingProgress(true);
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();

    const updateTime = (clientX: number) => {
      const pos = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const ratio = rect.width > 0 ? pos / rect.width : 0;
      const newTime = ratio * (duration || 0);
      setDragProgressTime(newTime);
      return newTime;
    };

    updateTime(e.clientX);

    const onPointerMove = (moveEvt: PointerEvent) => {
      updateTime(moveEvt.clientX);
    };

    const onPointerUp = (upEvt: PointerEvent) => {
      const finalTime = updateTime(upEvt.clientX);
      setIsDraggingProgress(false);
      seek(finalTime);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handlePlayToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.impact('light');
    if (!isPlaying && typeof window !== 'undefined' && window.innerWidth >= 768) {
      setNowPlayingOpen(true);
    }
    togglePlay();
  };

  const handleLikeToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.notification('success');
    if (currentTrack) {
      toggleLike(currentTrack);
    }
  };

  const handleOpenFullscreen = () => {
    if (showVolumePanel) return;
    haptic.impact('medium');
    setFullscreen(true);
  };

  const handleVolumeToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.selection();
    setShowVolumePanel((prev) => !prev);
  };

  const getVolumeIcon = () => {
    if (isMuted || currentVolume === 0) return <VolumeX size={19} className="text-red-400" />;
    if (currentVolume < 0.5) return <Volume1 size={19} className="text-zinc-300" />;
    return <Volume2 size={19} className={currentVolume > 1.0 ? 'text-amber-300' : 'text-zinc-300'} />;
  };

  return (
    <div
      className={`fixed z-40 select-none glass-surface border border-white/10 shadow-2xl overflow-hidden
        bottom-[calc(var(--mobile-nav-offset,84px)+12px)]
        left-2 right-2 rounded-2xl
        md:bottom-0 md:left-0 md:right-0 md:rounded-none md:border-x-0 md:border-b-0 md:border-t md:border-white/10 md:px-6 md:py-2 md:h-[84px]`}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. MOBILE VIEW (< md) — Exactly as before
         ───────────────────────────────────────────────────────────── */}
      <div className="md:hidden">
        <div
          onClick={handleOpenFullscreen}
          className="flex items-center justify-between gap-2.5 p-2 cursor-pointer transition-all active:scale-[0.99]"
        >
          {/* Track thumbnail & info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-[#181818] shadow">
              <img
                src={currentTrack.cover_url || '/placeholder.png'}
                alt={currentTrack.title}
                className={`w-full h-full object-cover ${coverFilter !== 'none' ? `filter-cover-${coverFilter}` : ''}`}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                {/* Animated waveform when playing */}
                {isPlaying && (
                  <div className="flex items-end gap-[2px] h-3.5 w-[14px] flex-shrink-0">
                    {[0.8, 0.55, 1.0, 0.65].map((dur, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-[#1DB954] rounded-[1px]"
                        style={{
                          height: '100%',
                          animation: `soundbar ${dur}s ease-in-out infinite`,
                          animationDelay: `${i * 0.1}s`,
                          transformOrigin: 'bottom',
                        }}
                      />
                    ))}
                  </div>
                )}
                <div className="text-sm font-semibold text-white truncate">
                  {currentTrack.title}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  haptic.selection();
                  openArtist(currentTrack.artist_id, currentTrack.artist_name);
                }}
                className="text-xs text-zinc-400 hover:text-[#1DB954] hover:underline truncate text-left transition cursor-pointer max-w-full block"
              >
                {currentTrack.artist_name}
              </button>
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Like Heart */}
            <button
              onClick={handleLikeToggle}
              className="p-1.5 text-zinc-400 hover:text-white transition"
              aria-label="Like"
            >
              <Heart
                size={19}
                className={isLiked ? 'text-[#1DB954] fill-[#1DB954]' : ''}
              />
            </button>

            <button onClick={(e) => { e.stopPropagation(); nextTrack(); }}
              className="w-11 h-11 rounded-full flex items-center justify-center text-white hover:bg-white/10"
              aria-label="Следующий трек"><SkipForward size={22} /></button>
            {/* Play / Pause Toggle */}
            <button
              onClick={handlePlayToggle}
              className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition shadow-lg"
              aria-label="Play/Pause"
            >
              {isPlaying ? (
                <Pause size={18} className="fill-black" />
              ) : (
                <Play size={18} className="fill-black translate-x-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* Expandable volume panel on mobile */}
        {showVolumePanel && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="border-t border-white/10 px-4 pt-3 pb-4 animate-slide-up"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Громкость
              </span>
              <button
                onClick={handleVolumeToggle}
                className="p-1 text-zinc-500 hover:text-zinc-300 transition rounded-full hover:bg-white/10"
                aria-label="Закрыть"
              >
                <ChevronDown size={15} />
              </button>
            </div>
            <VolumeControl
              showPercentage={false}
              showStepButtons={true}
              showPresets={false}
            />
          </div>
        )}

        {/* Slim progress bar strip */}
        <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-white/10">
          <div
            className="h-full bg-white transition-all duration-200"
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. DESKTOP / PC VIEW (>= md) — Spotify Desktop Bottom Bar
         ───────────────────────────────────────────────────────────── */}
      <div className="hidden md:flex items-center justify-between h-full gap-4 max-w-7xl mx-auto">
        {/* Left: Track Info */}
        <div className="flex items-center gap-3.5 w-1/4 min-w-[200px] max-w-[320px]">
          <div
            onClick={handleOpenFullscreen}
            className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-[#242424] shadow cursor-pointer group"
          >
            <img
              src={currentTrack.cover_url || '/placeholder.png'}
              alt={currentTrack.title}
              className={`w-full h-full object-cover transition group-hover:scale-105 ${
                coverFilter !== 'none' ? `filter-cover-${coverFilter}` : ''
              }`}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
              <Maximize2 size={18} className="text-white" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div
              onClick={handleOpenFullscreen}
              className="text-sm font-bold text-white hover:underline cursor-pointer truncate"
              title={currentTrack.title}
            >
              {currentTrack.title}
            </div>
            <button
              onClick={() => openArtist(currentTrack.artist_id, currentTrack.artist_name)}
              className="text-xs text-zinc-400 hover:text-[#1DB954] hover:underline truncate text-left transition cursor-pointer block max-w-full"
            >
              {currentTrack.artist_name}
            </button>
          </div>

          <button
            onClick={handleLikeToggle}
            className="p-2 text-zinc-400 hover:text-white transition rounded-full hover:bg-white/5 flex-shrink-0"
            aria-label="Like"
          >
            <Heart
              size={18}
              className={isLiked ? 'text-[#1DB954] fill-[#1DB954]' : ''}
            />
          </button>
          <DislikeButton track={currentTrack} />
        </div>

        {/* Center: Controls & Timeline Slider */}
        <div className="flex-1 max-w-2xl flex flex-col items-center justify-center px-4 py-1">
          {/* Controls buttons row */}
          <div className="flex items-center gap-4 mb-1 h-8">
            <button
              onClick={() => toggleShuffle()}
              className={`p-1 transition rounded-full ${isShuffle ? 'text-[#1DB954]' : 'text-zinc-400 hover:text-white'}`}
              title="Перемешать"
            >
              <Shuffle size={15} />
            </button>

            <button
              onClick={() => prevTrack()}
              className="p-1 text-zinc-300 hover:text-white transition active:scale-95"
              title="Предыдущий трек"
            >
              <SkipBack size={18} className="fill-current" />
            </button>

            <button
              onClick={handlePlayToggle}
              className="w-8 h-8 rounded-full bg-white hover:scale-105 active:scale-95 text-black flex items-center justify-center transition shadow-md flex-shrink-0"
              aria-label="Play/Pause"
            >
              {isPlaying ? (
                <Pause size={16} className="fill-black" />
              ) : (
                <Play size={16} className="fill-black translate-x-0.5" />
              )}
            </button>

            <button
              onClick={() => nextTrack()}
              className="p-1 text-zinc-300 hover:text-white transition active:scale-95"
              title="Следующий трек"
            >
              <SkipForward size={18} className="fill-current" />
            </button>

            <button
              onClick={() => cycleRepeatMode()}
              className={`p-1 transition rounded-full ${repeatMode !== 'off' ? 'text-[#1DB954]' : 'text-zinc-400 hover:text-white'}`}
              title="Повтор"
            >
              {repeatMode === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
            </button>
          </div>

          {/* Dynamic Seekbar Slider using selected sliderStyle with inline times */}
          <div className="w-full flex items-center gap-2">
            <span className="text-[11px] font-medium text-zinc-400 w-8 text-right tabular-nums select-none flex-shrink-0">
              {formatTime(activeTime)}
            </span>
            <div className="flex-1 min-w-0">
              <ProgressBar showTime={false} className="w-full" />
            </div>
            <span className="text-[11px] font-medium text-zinc-400 w-8 text-left tabular-nums select-none flex-shrink-0">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right: Volume & Extra Actions */}
        <div className="flex items-center justify-end gap-3 w-1/4 min-w-[200px] max-w-[320px]">
          {/* Toggle Now Playing Right Sidebar (карточка справа) */}
          <button
            onClick={() => {
              haptic.selection();
              toggleNowPlaying();
            }}
            className={`p-2 transition rounded-full hover:bg-white/10 ${
              isNowPlayingOpen ? 'text-[#1DB954] bg-[#1DB954]/15' : 'text-zinc-400 hover:text-white'
            }`}
            title="Карточка трека справа (сведения и текст)"
          >
            <PanelRight size={18} />
          </button>

          {/* Queue Drawer */}
          <button
            onClick={() => setQueueOpen(true)}
            className="p-2 text-zinc-400 hover:text-white transition rounded-full hover:bg-white/5"
            title="Очередь"
          >
            <ListMusic size={18} />
          </button>

          {/* Download MP3 */}
          <button
            onClick={() => {
              haptic.notification('success');
              api.downloadTrack(currentTrack);
            }}
            className="p-2 text-zinc-400 hover:text-white transition rounded-full hover:bg-white/10"
            title="Скачать трек (MP3)"
          >
            <Download size={18} />
          </button>

          {/* Refresh Track (Не тот трек) */}
          <button
            onClick={handleRefreshTrack}
            disabled={isRefreshing}
            className={`p-2 transition rounded-full hover:bg-white/10 ${
              isRefreshing ? 'text-amber-400' : 'text-zinc-400 hover:text-amber-400'
            }`}
            title="Не тот трек? Нажмите для обновления аудио"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
          </button>

          {/* Inline Desktop Volume Slider */}
          <div className="w-36">
            <VolumeControl showPercentage={false} showStepButtons={false} showPresets={false} />
          </div>

          {/* Fullscreen Player toggle */}
          <button
            onClick={handleOpenFullscreen}
            className="p-2 text-zinc-400 hover:text-white transition rounded-full hover:bg-white/5"
            title="Развернуть"
          >
            <Maximize2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
