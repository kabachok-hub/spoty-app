import { trackShareUrl } from '../../platform/publicSite';
import { refreshRecording } from '../../hooks/refreshRecording';
import { isNativeClient, nativeCall } from '../../platform/nativeBridge';
import React, { useEffect, useState, useCallback } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  ListMusic,
  Share2,
  Sparkles,
  ExternalLink,
  FileText,
  Moon,
  Copy,
  MoreVertical,
  RefreshCw,
  Download,
} from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useUserStore } from '../../store/userStore';
import { DislikeButton } from './DislikeButton';
import { ProgressBar } from './ProgressBar';
import { VolumeControl } from './VolumeControl';
import { LyricsPanel } from './LyricsPanel';
import { SleepTimerModal } from './SleepTimerModal';
import { Toast } from '../ui/Toast';
import { useTelegram } from '../../hooks/useTelegram';
import { useSleepTimer } from '../../hooks/useSleepTimer';
import { useNavigationStore } from '../../store/navigationStore';
import { api, apiClient } from '../../api/client';
import { Track } from '../../api/types';
import { useCustomizationStore } from '../../store/customizationStore';

type PlayerTab = 'player' | 'lyrics' | 'similar';

export const FullscreenPlayer: React.FC = () => {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const nextTrack = usePlayerStore((state) => state.nextTrack);
  const prevTrack = usePlayerStore((state) => state.prevTrack);
  const isShuffle = usePlayerStore((state) => state.isShuffle);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const repeatMode = usePlayerStore((state) => state.repeatMode);
  const cycleRepeatMode = usePlayerStore((state) => state.cycleRepeatMode);
  const isFullscreen = usePlayerStore((state) => state.isFullscreen);
  const setFullscreen = usePlayerStore((state) => state.setFullscreen);
  const isQueueOpen = usePlayerStore((state) => state.isQueueOpen);
  const setQueueOpen = usePlayerStore((state) => state.setQueueOpen);
  const openArtist = useNavigationStore((state) => state.openArtist);

  const isLiked = useUserStore((state) =>
    currentTrack ? state.isLiked(currentTrack.id) : false
  );
  const toggleLike = useUserStore((state) => state.toggleLike);

  const playerStyle = useCustomizationStore((state) => state.playerStyle);
  const titleAlign = useCustomizationStore((state) => state.titleAlign);
  const showArtistAvatar = useCustomizationStore((state) => state.showArtistAvatar);
  const coverFilter = useCustomizationStore((state) => state.coverFilter);
  const bgType = useCustomizationStore((state) => state.bgType);

  const { haptic, setupBackButton } = useTelegram();
  const { isActive: isTimerActive, timeLeft, formatTime } = useSleepTimer();

  const [activeTab, setActiveTab] = useState<PlayerTab>('player');
  const [sleepTimerOpen, setSleepTimerOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [similarTracks, setSimilarTracks] = useState<Track[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
  }, []);

  const hideToast = useCallback(() => setToastVisible(false), []);

  const handleRefreshTrack = async () => {
    if (!currentTrack) return;
    haptic.impact('medium');
    setIsRefreshing(true);
    showToast('Обновляем аудиодорожку...');
    try {
      await refreshRecording(currentTrack);
      showToast('Трек успешно обновлен!');
      haptic.notification('success');
    } catch (err) {
      console.error('Refresh track failed:', err);
      showToast('Ошибка при обновлении трека');
      haptic.notification('error');
    } finally {
      setIsRefreshing(false);
      setShowMoreMenu(false);
    }
  };

  const handleArtistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.selection();
    openArtist(currentTrack?.artist_id, currentTrack?.artist_name);
    setFullscreen(false);
  };

  // Telegram native BackButton
  useEffect(() => {
    if (isFullscreen) {
      const cleanup = setupBackButton(true, () => {
        setFullscreen(false);
      });
      return cleanup;
    }
  }, [isFullscreen, setupBackButton, setFullscreen]);

  // Prevent background scrolling and touch bleed when fullscreen player is open
  useEffect(() => {
    if (isFullscreen) {
      const prevOverflow = document.body.style.overflow;
      const prevTouchAction = document.body.style.touchAction;
      const prevOverscroll = document.body.style.overscrollBehavior;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.body.style.overscrollBehavior = 'none';

      return () => {
        document.body.style.overflow = prevOverflow;
        document.body.style.touchAction = prevTouchAction;
        document.body.style.overscrollBehavior = prevOverscroll;
      };
    }
  }, [isFullscreen]);

  // Reset tab when track changes
  useEffect(() => {
    setActiveTab('player');
    setSimilarTracks([]);
  }, [currentTrack?.id]);

  // Fetch similar tracks when switching to similar tab
  useEffect(() => {
    if (activeTab !== 'similar' || !currentTrack) return;
    if (similarTracks.length > 0) return; // already loaded
    setLoadingSimilar(true);
    apiClient.get(`/tracks/${currentTrack.id}/similar`, {
      params: { artist_name: currentTrack.artist_name, title: currentTrack.title, limit: 20 }
    }).then(res => {
      const tracks: Track[] = (res.data || []).map((t: any) => ({
        id: String(t.id),
        title: t.title,
        artist_name: t.artist_name,
        artist_id: String(t.artist_id || ''),
        cover_url: t.cover_url || '',
        duration: t.duration || 0,
        preview: t.preview || '',
      }));
      setSimilarTracks(tracks);
    }).catch(() => {
      // fallback: search by artist
      api.search(currentTrack.artist_name, 'track', 20).then(res => {
        setSimilarTracks((res.tracks || []).filter(t => t.id !== currentTrack.id).slice(0, 15));
      }).catch(() => {});
    }).finally(() => setLoadingSimilar(false));
  }, [activeTab, currentTrack?.id]);

  if (!isFullscreen || !currentTrack) return null;

  const handleClose = () => {
    haptic.impact('light');
    setFullscreen(false);
  };

  const handlePlayToggle = () => {
    haptic.impact('medium');
    togglePlay();
  };

  const handleNext = () => { haptic.impact('light'); nextTrack(); };
  const handlePrev = () => { haptic.impact('light'); prevTrack(); };
  const handleShuffle = () => { haptic.selection(); toggleShuffle(); };
  const handleRepeat = () => { haptic.selection(); cycleRepeatMode(); };
  const handleLike = () => { haptic.notification('success'); toggleLike(currentTrack); };

  const handleShare = () => {
    haptic.impact('medium');
    const tg = (window as any).Telegram?.WebApp;
    const trackUrl = trackShareUrl(currentTrack.id);
    const shareText = `🎵 ${currentTrack.title} — ${currentTrack.artist_name}`;

    if (tg?.openTelegramLink) {
      // Share via Telegram inline
      try {
        const encoded = encodeURIComponent(`${shareText}\n${trackUrl}`);
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(trackUrl)}&text=${encodeURIComponent(shareText)}`);
        return;
      } catch (e) {}
    }

    if (navigator.share) {
      navigator.share({
        title: `${currentTrack.title} — ${currentTrack.artist_name}`,
        text: `${shareText}`,
        url: trackUrl,
      }).catch(() => {});
      return;
    }

    // Fallback: clipboard
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(`${shareText}\n${trackUrl}`).then(() => {
        showToast('Ссылка скопирована!');
      }).catch(() => {});
    }
  };

  const handleOpenBrowser = () => {
    haptic.impact('medium');
    if (isNativeClient()) {
      void nativeCall('openExternal', { url: trackShareUrl(currentTrack.id) });
      return;
    }
    const token = localStorage.getItem('spotify_auth_token') || useUserStore.getState().user?.auth_token;
    const tokenParam = token ? `&auth_token=${encodeURIComponent(token)}` : '';
    const url = `${window.location.origin}/?trackId=${encodeURIComponent(currentTrack.id)}${tokenParam}`;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-50 flex flex-col text-white p-5 pb-6 select-none animate-slide-up safe-bottom safe-top overflow-y-auto overscroll-contain touch-pan-y no-scrollbar ${
          bgType !== 'none'
            ? 'bg-black/80 backdrop-blur-2xl'
            : 'bg-[#121212]'
        }`}
      >

        {/* ── Top Header ── */}
        <div className="flex items-center justify-between flex-shrink-0">
          <button
            onClick={handleClose}
            className="p-2 -ml-2 text-zinc-300 hover:text-white transition"
            aria-label="Close player"
          >
            <ChevronDown size={28} />
          </button>

          <div className="flex flex-col items-center text-center">
            <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">
              Playing from
            </span>
            <span className="text-xs font-semibold text-zinc-200 truncate max-w-[200px]">
              {currentTrack.album_title || currentTrack.artist_name}
            </span>
          </div>

          <div className="flex items-center gap-0.5 -mr-2">
            {/* Sleep Timer button */}
            <button
              onClick={() => { haptic.impact('light'); setSleepTimerOpen(true); }}
              className={`p-2 transition rounded-full ${
                isTimerActive
                  ? 'text-[#1DB954]'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Таймер сна"
              aria-label="Sleep Timer"
            >
              {isTimerActive ? (
                <span className="text-[11px] font-bold text-[#1DB954] tabular-nums">{formatTime(timeLeft)}</span>
              ) : (
                <Moon size={19} />
              )}
            </button>

            {/* Open in browser */}
            <button
              onClick={handleOpenBrowser}
              className="p-2 text-zinc-400 hover:text-[#1DB954] transition"
              title="Фоновый режим в браузере"
              aria-label="Open in browser"
            >
              <ExternalLink size={19} />
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="p-2 text-zinc-400 hover:text-white transition"
              aria-label="Share"
            >
              <Share2 size={19} />
            </button>

            {/* 3 DOTS MENU */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  haptic.impact('light');
                  setShowMoreMenu((prev) => !prev);
                }}
                className={`p-2 transition rounded-full ${
                  showMoreMenu ? 'text-[#1DB954] bg-white/10' : 'text-zinc-300 hover:text-white'
                }`}
                title="Меню трека"
                aria-label="More options"
              >
                <MoreVertical size={20} />
              </button>

              {showMoreMenu && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-10 z-50 w-56 bg-[#282828] border border-white/15 rounded-2xl shadow-2xl py-1.5 text-sm text-zinc-200 animate-fade-in backdrop-blur-xl"
                >
                  <button
                    onClick={handleRefreshTrack}
                    disabled={isRefreshing}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/10 text-left font-medium text-amber-400 active:bg-white/15"
                  >
                    <RefreshCw size={17} className={isRefreshing ? 'animate-spin' : ''} />
                    <span>{isRefreshing ? 'Обновляем трек...' : 'Не тот трек (обновить)'}</span>
                  </button>

                  <div className="h-px bg-white/10 my-1" />

                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      api.downloadTrack(currentTrack);
                      showToast('Скачивание началось');
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/10 text-left text-zinc-200 active:bg-white/15"
                  >
                    <Download size={17} className="text-[#1DB954]" />
                    <span>Скачать MP3</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      handleShare();
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/10 text-left text-zinc-200 active:bg-white/15"
                  >
                    <Share2 size={17} className="text-blue-400" />
                    <span>Поделиться</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Album Artwork ── */}
        {activeTab!=='lyrics' && <div className="my-3 flex items-center justify-center flex-shrink-0">
          {playerStyle === 'vinyl' ? (
            /* VINYL RECORD MODE (Dootify Vinyl Style) */
            <div className="relative aspect-square w-full max-w-[260px] sm:max-w-[310px] max-h-[34vh] flex items-center justify-center">
              {/* Spinning Vinyl Disc */}
              <div
                className={`w-full h-full rounded-full vinyl-disc relative flex items-center justify-center shadow-2xl animate-spin-slow ${
                  isPlaying ? 'animation-running' : 'animation-paused'
                }`}
              >
                {/* Vinyl specular reflection shine */}
                <div className="absolute inset-0 rounded-full vinyl-shine pointer-events-none" />

                {/* Center Circular Album Art Label */}
                <div className="w-[48%] h-[48%] rounded-full overflow-hidden relative shadow-inner border-2 border-black/40">
                  <img
                    src={currentTrack.cover_url || '/placeholder.png'}
                    alt={currentTrack.title}
                    className={`w-full h-full object-cover ${
                      coverFilter !== 'none' ? `filter-cover-${coverFilter}` : ''
                    }`}
                  />
                  {/* Center Spindle Hole */}
                  <div className="absolute inset-0 m-auto w-4 h-4 rounded-full bg-zinc-950 border-2 border-white/60 shadow-lg" />
                </div>
              </div>
            </div>
          ) : (
            /* CLASSIC & LARGE MODES */
            <div
              className={`relative aspect-square w-full ${
                playerStyle === 'large'
                  ? 'max-w-[280px] sm:max-w-[340px] max-h-[36vh]'
                  : 'max-w-[240px] sm:max-w-[300px] max-h-[32vh]'
              } rounded-2xl overflow-hidden shadow-2xl shadow-black/80 bg-[#1e1e1e] transition-all`}
            >
              <img
                src={currentTrack.cover_url || '/placeholder.png'}
                alt={currentTrack.title}
                className={`w-full h-full object-cover ${
                  coverFilter !== 'none' ? `filter-cover-${coverFilter}` : ''
                }`}
              />
            </div>
          )}
        </div>}

        {/* ── Lyrics / Player / Similar Tab Bar ── */}
        <div className="flex gap-1 bg-white/6 rounded-xl p-1 mb-3 flex-shrink-0">
          <button
            onClick={() => { haptic.selection(); setActiveTab('player'); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'player'
                ? 'bg-white/15 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Sparkles size={14} />
            Плеер
          </button>
          <button
            onClick={() => { haptic.selection(); setActiveTab('lyrics'); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'lyrics'
                ? 'bg-white/15 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <FileText size={14} />
            Текст
          </button>
          <button
            onClick={() => { haptic.selection(); setActiveTab('similar'); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'similar'
                ? 'bg-white/15 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <ListMusic size={14} />
            Похожие
          </button>
        </div>

        {/* ── Track Meta & Controls (Player Tab) ── */}
        {activeTab === 'player' && (
          <div className="space-y-3 flex-1">
            {/* Title & Like */}
            <div className={`grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-3 ${
              titleAlign === 'center' ? 'text-center' : titleAlign === 'right' ? 'text-right' : 'text-left'
            }`}>
              <DislikeButton track={currentTrack} iconSize={22} />
              <div className="min-w-0">
                <h1 className="text-xl font-extrabold text-white leading-tight line-clamp-2 break-words">
                  {currentTrack.title}
                </h1>
                <div className={`flex items-center gap-1.5 mt-0.5 ${
                  titleAlign === 'center' ? 'justify-center' : titleAlign === 'right' ? 'justify-end' : 'justify-start'
                }`}>
                  {showArtistAvatar && (
                    <img
                      src={currentTrack.cover_url || '/placeholder.png'}
                      alt=""
                      className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                    />
                  )}
                  <button
                    onClick={handleArtistClick}
                    className="text-base text-zinc-400 hover:text-[var(--accent-color,#1DB954)] hover:underline truncate transition cursor-pointer active:scale-95"
                  >
                    {currentTrack.artist_name}
                  </button>
                </div>
              </div>

              <button
                onClick={handleLike}
                className="w-11 h-11 flex items-center justify-center rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition"
                aria-label="Like track"
              >
                <Heart
                  size={22}
                  style={{
                    color: isLiked ? 'var(--accent-color, #1DB954)' : undefined,
                    fill: isLiked ? 'var(--accent-color, #1DB954)' : 'none',
                  }}
                />
              </button>
            </div>

            {/* Timeline */}
            <ProgressBar />

            {/* Playback Controls */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleShuffle}
                className={`p-2 transition relative ${isShuffle ? 'text-[#1DB954]' : 'text-zinc-400 hover:text-white'}`}
                aria-label="Shuffle"
              >
                <Shuffle size={22} />
                {isShuffle && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1DB954] rounded-full" />
                )}
              </button>

              <button
                onClick={handlePrev}
                className="p-2 text-zinc-200 hover:text-white transition active:scale-95"
                aria-label="Previous"
              >
                <SkipBack size={30} className="fill-current" />
              </button>

              <button
                onClick={handlePlayToggle}
                className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition"
                aria-label="Play/Pause"
              >
                {isPlaying ? (
                  <Pause size={30} className="fill-black" />
                ) : (
                  <Play size={30} className="fill-black translate-x-0.5" />
                )}
              </button>

              <button
                onClick={handleNext}
                className="p-2 text-zinc-200 hover:text-white transition active:scale-95"
                aria-label="Next"
              >
                <SkipForward size={30} className="fill-current" />
              </button>

              <button
                onClick={handleRepeat}
                className={`p-2 transition relative ${repeatMode !== 'off' ? 'text-[#1DB954]' : 'text-zinc-400 hover:text-white'}`}
                aria-label="Repeat"
              >
                {repeatMode === 'one' ? <Repeat1 size={22} /> : <Repeat size={22} />}
                {repeatMode !== 'off' && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1DB954] rounded-full" />
                )}
              </button>
            </div>

            {/* Volume */}
            <div className="pt-1 px-1">
              <VolumeControl showPresets={false} />
            </div>

            {/* Bottom bar */}
            <div className="flex items-center justify-between pt-1 text-xs text-zinc-400">
              <div className="flex items-center gap-1.5 font-medium">
                <Sparkles size={14} className="text-[#1DB954]" />
                <span>Spoty</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefreshTrack}
                  disabled={isRefreshing}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 hover:text-amber-400 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 active:scale-95 transition"
                  title="Не тот трек? Нажмите для повторного поиска и обновления кэша"
                >
                  <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-amber-400' : ''} />
                  <span>{isRefreshing ? 'Обновляем...' : 'Не тот трек?'}</span>
                </button>

                <button
                  onClick={() => setQueueOpen(true)}
                  className="p-2 text-zinc-400 hover:text-white transition flex items-center gap-1.5"
                  aria-label="Queue"
                >
                  <ListMusic size={20} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Lyrics Tab ── */}
        {activeTab === 'lyrics' && (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="mb-3 flex items-center gap-3 flex-shrink-0">
              <img src={currentTrack.cover_url || '/placeholder.png'} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0"/>
              <div className="min-w-0 flex-1"><h2 className="text-lg font-extrabold text-white truncate">{currentTrack.title}</h2>
              <p className="text-sm text-zinc-400 truncate">{currentTrack.artist_name}</p></div>
              <button onClick={togglePlay} className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shrink-0" aria-label={isPlaying?'Пауза':'Продолжить воспроизведение'}>{isPlaying?<Pause size={20}/>:<Play size={20}/>}</button>
            </div>
            <LyricsPanel
              trackId={currentTrack.id}
              artist={currentTrack.artist_name}
              title={currentTrack.title}
              duration={currentTrack.duration}
              maxHeightClass="max-h-none"
              className="min-h-0 flex-1"
            />
          </div>
        )}

        {/* ── Similar Tracks Tab ── */}
        {activeTab === 'similar' && (
          <div className="flex-1 overflow-y-auto no-scrollbar">
            <p className="text-xs text-zinc-400 mb-3 flex items-center gap-1.5">
              <Sparkles size={12} className="text-[#1DB954]" />
              Похожие треки на «{currentTrack.title}»
            </p>
            {loadingSimilar ? (
              <div className="space-y-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-11 h-11 rounded-md bg-white/10 flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-white/10 rounded w-3/4" />
                      <div className="h-2.5 bg-white/10 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : similarTracks.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-sm">Ничего не найдено</div>
            ) : (
              <div className="space-y-1">
                {similarTracks.map((track) => (
                  <div
                    key={track.id}
                    onClick={() => {
                      haptic.impact('light');
                      usePlayerStore.getState().playTrack(track, similarTracks);
                    }}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/10 active:bg-white/15 cursor-pointer transition group"
                  >
                    <div className="relative w-11 h-11 flex-shrink-0 rounded-md overflow-hidden bg-[#282828]">
                      <img src={track.cover_url || '/placeholder.png'} alt={track.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                        <Play size={16} className="text-white fill-white" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white truncate">{track.title}</div>
                      <div className="text-xs text-zinc-400 truncate">{track.artist_name}</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        usePlayerStore.getState().addToQueue(track);
                        showToast('Добавлено в очередь');
                        haptic.selection();
                      }}
                      className="p-1.5 text-zinc-500 hover:text-white transition opacity-0 group-hover:opacity-100 flex-shrink-0"
                      title="В очередь"
                    >
                      <ListMusic size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sleep Timer Modal */}
      <SleepTimerModal isOpen={sleepTimerOpen} onClose={() => setSleepTimerOpen(false)} />

      {/* Toast */}
      <Toast message={toastMsg} visible={toastVisible} onHide={hideToast} />
    </>
  );
};
