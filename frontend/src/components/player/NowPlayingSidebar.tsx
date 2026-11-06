import { refreshRecording } from '../../hooks/refreshRecording';
import React, { useState } from 'react';
import {
  X,
  Heart,
  Share2,
  FileText,
  Info,
  Check,
  Sparkles,
  Download,
  ListPlus,
  Disc,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  MoreVertical,
} from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useUserStore } from '../../store/userStore';
import { DislikeButton } from './DislikeButton';
import { useNavigationStore } from '../../store/navigationStore';
import { useTelegram } from '../../hooks/useTelegram';
import { api } from '../../api/client';
import { LyricsPanel } from './LyricsPanel';
import { BatchAddToPlaylistModal } from '../modals/BatchAddToPlaylistModal';
import { useCustomizationStore } from '../../store/customizationStore';
import { ProgressBar } from './ProgressBar';

export const NowPlayingSidebar: React.FC = () => {
  const playerStyle = useCustomizationStore((state) => state.playerStyle);
  const coverFilter = useCustomizationStore((state) => state.coverFilter);
  const titleAlign = useCustomizationStore((state) => state.titleAlign);
  const showArtistAvatar = useCustomizationStore((state) => state.showArtistAvatar);

  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const nextTrack = usePlayerStore((state) => state.nextTrack);
  const prevTrack = usePlayerStore((state) => state.prevTrack);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const seek = usePlayerStore((state) => state.seek);
  const isOpen = usePlayerStore((state) => state.isNowPlayingOpen);
  const setOpen = usePlayerStore((state) => state.setNowPlayingOpen);
  const activeMix = usePlayerStore((state) => state.activeMix);
  const openArtist = useNavigationStore((state) => state.openArtist);
  const setActiveTabNav = useNavigationStore((state) => state.setActiveTab);

  const isLiked = useUserStore((state) =>
    currentTrack ? state.isLiked(currentTrack.id) : false
  );
  const toggleLike = useUserStore((state) => state.toggleLike);

  const isFollowing = useUserStore((state) =>
    currentTrack?.artist_id ? state.isFollowing(currentTrack.artist_id) : false
  );
  const toggleFollowArtist = useUserStore((state) => state.toggleFollowArtist);

  const { haptic } = useTelegram();
  const [activeTab, setActiveTab] = useState<'lyrics' | 'about'>('lyrics');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

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
      setShowMoreMenu(false);
    }
  };

  const handleDownload = () => {
    if (!currentTrack) return;
    haptic.impact('medium');
    setDownloading(true);
    api.downloadTrack(currentTrack);
    setTimeout(() => setDownloading(false), 2500);
  };

  const handleClose = () => {
    haptic.impact('light');
    setOpen(false);
  };

  const handleArtistClick = () => {
    if (!currentTrack) return;
    haptic.selection();
    openArtist(currentTrack.artist_id, currentTrack.artist_name);
  };

  const handleFollowToggle = () => {
    if (!currentTrack?.artist_id) return;
    haptic.impact('medium');
    toggleFollowArtist({
      id: currentTrack.artist_id,
      name: currentTrack.artist_name,
      picture_url: currentTrack.artist_picture || currentTrack.cover_url || '',
    });
  };

  const handleShare = () => {
    if (!currentTrack) return;
    haptic.impact('light');
    const trackUrl = `${window.location.origin}/?trackId=${encodeURIComponent(currentTrack.id)}`;
    const shareText = `🎵 ${currentTrack.title} — ${currentTrack.artist_name}`;

    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(trackUrl)}&text=${encodeURIComponent(shareText)}`);
      return;
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(`${shareText}\n${trackUrl}`).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <aside
      className={`spoty-now-playing hidden md:flex fixed top-14 right-0 bottom-[84px] z-30 flex-col
        w-80 lg:w-[340px]
        bg-[#141414]/98 backdrop-blur-2xl border-l border-white/10 shadow-[-12px_0_30px_rgba(0,0,0,0.7)]
        select-none overflow-hidden
        transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
        ${isOpen ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'}`}
    >
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0 bg-black/20">
        <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
          {isPlaying ? (
            <div className="flex items-end gap-0.5 h-3.5 w-3 flex-shrink-0">
              <span className="w-0.5 h-full bg-[#1DB954] rounded-full animate-[soundbar_0.8s_ease-in-out_infinite]" />
              <span className="w-0.5 h-full bg-[#1DB954] rounded-full animate-[soundbar_0.6s_ease-in-out_infinite_0.15s]" />
              <span className="w-0.5 h-full bg-[#1DB954] rounded-full animate-[soundbar_1s_ease-in-out_infinite_0.3s]" />
            </div>
          ) : (
            <Disc size={16} className="text-[#1DB954] flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1DB954] block leading-none truncate">
              {activeMix ? `Микс • ${activeMix.title}` : currentTrack ? 'Сейчас играет' : 'Карточка трека'}
            </span>
            <h2 className="text-xs font-bold text-white truncate mt-0.5">
              {currentTrack ? currentTrack.title : 'Плеер Spoty'}
            </h2>
          </div>
        </div>

        <button
          onClick={handleClose}
          className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition flex items-center gap-1"
          aria-label="Свернуть карточку"
          title="Свернуть (закрыть)"
        >
          <ChevronRight size={20} className="text-zinc-300" />
        </button>
      </div>

      {/* ── Main Content Area ── */}
      {!currentTrack ? (
        /* Empty State when no track is currently selected */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="relative w-28 h-28 rounded-full bg-gradient-to-tr from-[#121212] via-[#242424] to-[#181818] border-2 border-zinc-700/50 flex items-center justify-center shadow-2xl animate-spin-slow">
            <div className="w-10 h-10 rounded-full bg-[#1DB954]/20 border border-[#1DB954]/40 flex items-center justify-center">
              <Disc size={20} className="text-[#1DB954]" />
            </div>
            <div className="absolute inset-0 rounded-full border border-white/5" />
          </div>

          <div className="space-y-1.5 max-w-[240px]">
            <h3 className="text-base font-bold text-white">Трек не выбран</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Включите любую песню, чтобы здесь появились обложка, синхронные слова песни и сведения об авторе.
            </p>
          </div>

          <button
            onClick={() => {
              haptic.impact('light');
              setActiveTabNav('charts');
              setOpen(false);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black text-xs font-bold shadow-lg shadow-[#1DB954]/20 active:scale-95 transition"
          >
            <TrendingUp size={14} />
            <span>Открыть Чарты</span>
          </button>
        </div>
      ) : (
        /* Track Loaded Content */
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          {/* Album Artwork: Vinyl Record Mode or Square Cover */}
          {playerStyle === 'vinyl' ? (
            <div className="relative aspect-square w-full max-w-[270px] mx-auto flex items-center justify-center my-1 select-none">
              {/* Spinning Vinyl Disc */}
              <div
                className={`w-full h-full rounded-full vinyl-disc relative flex items-center justify-center shadow-2xl animate-spin-slow ${
                  isPlaying ? 'animation-running' : 'animation-paused'
                }`}
              >
                {/* Vinyl specular reflection shine */}
                <div className="absolute inset-0 rounded-full vinyl-shine pointer-events-none" />

                {/* Center Circular Album Art Label */}
                <div className="w-[50%] h-[50%] rounded-full overflow-hidden relative shadow-inner border-2 border-black/40">
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
            <div
              className={`relative aspect-square w-full rounded-2xl overflow-hidden shadow-2xl shadow-black/80 bg-[#1e1e1e] flex-shrink-0 group ${
                playerStyle === 'large' ? 'max-w-none' : 'max-w-[280px] mx-auto'
              }`}
            >
              <img
                src={currentTrack.cover_url || '/placeholder.png'}
                alt={currentTrack.title}
                className={`w-full h-full object-cover transition-transform duration-700 ${
                  isPlaying ? 'scale-105' : 'scale-100'
                } ${coverFilter !== 'none' ? `filter-cover-${coverFilter}` : ''}`}
              />
              {isPlaying && (
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-ping" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">Играет</span>
                </div>
              )}
            </div>
          )}

          {/* Track Title, Artist, Avatar, & Actions */}
          <div className="space-y-3">
            <div
              className={`flex items-start justify-between gap-3 ${
                titleAlign === 'center'
                  ? 'flex-col items-center text-center'
                  : titleAlign === 'right'
                  ? 'flex-row-reverse text-right'
                  : 'text-left'
              }`}
            >
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-extrabold text-white leading-tight truncate">
                  {currentTrack.title}
                </h1>
                <div
                  className={`flex items-center gap-2 mt-1 ${
                    titleAlign === 'center'
                      ? 'justify-center'
                      : titleAlign === 'right'
                      ? 'justify-end'
                      : 'justify-start'
                  }`}
                >
                  {showArtistAvatar && (
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0 border border-white/20">
                      <img
                        src={currentTrack.cover_url || '/placeholder.png'}
                        alt={currentTrack.artist_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <button
                    onClick={handleArtistClick}
                    className="text-xs text-zinc-400 hover:text-[#1DB954] hover:underline font-semibold truncate transition block max-w-full"
                  >
                    {currentTrack.artist_name}
                  </button>
                </div>
              </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Like Heart */}
              <DislikeButton track={currentTrack} />
              <button
                onClick={() => {
                  haptic.notification('success');
                  toggleLike(currentTrack);
                }}
                className="p-1.5 text-zinc-400 hover:text-white transition rounded-full hover:bg-white/10"
                aria-label="Like"
              >
                <Heart
                  size={20}
                  className={isLiked ? 'text-[#1DB954] fill-[#1DB954]' : ''}
                />
              </button>

              {/* Download MP3 */}
              <button
                onClick={handleDownload}
                className={`p-1.5 transition rounded-full hover:bg-white/10 ${
                  downloading ? 'text-[#1DB954] animate-pulse' : 'text-zinc-400 hover:text-white'
                }`}
                title="Скачать MP3"
                aria-label="Download MP3"
              >
                <Download size={18} />
              </button>

              {/* Add to Playlist */}
              <button
                onClick={() => {
                  haptic.impact('light');
                  setIsPlaylistModalOpen(true);
                }}
                className="p-1.5 text-zinc-400 hover:text-white transition rounded-full hover:bg-white/10"
                title="Добавить в плейлист"
                aria-label="Add to Playlist"
              >
                <ListPlus size={18} />
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                className="p-1.5 text-zinc-400 hover:text-white transition rounded-full hover:bg-white/10"
                title="Поделиться"
              >
                {copied ? <Check size={18} className="text-[#1DB954]" /> : <Share2 size={18} />}
              </button>

              {/* Refresh / Not that track */}
              <button
                onClick={handleRefreshTrack}
                disabled={isRefreshing}
                className={`p-1.5 transition rounded-full hover:bg-white/10 ${
                  isRefreshing ? 'text-amber-400' : 'text-zinc-400 hover:text-amber-400'
                }`}
                title="Не тот трек? Нажмите, чтобы обновить аудио"
                aria-label="Обновить трек"
              >
                <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
              </button>

              {/* 3 Dots Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowMoreMenu((prev) => !prev)}
                  className={`p-1.5 text-zinc-400 hover:text-white transition rounded-full hover:bg-white/10 ${
                    showMoreMenu ? 'text-[#1DB954] bg-white/10' : ''
                  }`}
                  title="Дополнительно"
                >
                  <MoreVertical size={18} />
                </button>

                {showMoreMenu && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-9 z-50 w-52 bg-[#222222] border border-white/10 rounded-xl shadow-2xl py-1 text-xs text-zinc-200 animate-fade-in"
                  >
                    <button
                      onClick={handleRefreshTrack}
                      disabled={isRefreshing}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-amber-400 hover:bg-white/10 text-left font-medium"
                    >
                      <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
                      <span>{isRefreshing ? 'Обновляем трек...' : 'Не тот трек (обновить)'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        handleDownload();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left"
                    >
                      <Download size={15} className="text-[#1DB954]" />
                      <span>Скачать MP3</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        setIsPlaylistModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left"
                    >
                      <ListPlus size={15} />
                      <span>В плейлист</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

          {/* Quick Playback Bar inside Card with dynamic ProgressBar (Waveform, Wave, Thin, Smooth, Classic) */}
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 space-y-2">
            <ProgressBar showTime={true} className="w-full" />

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 pt-1">
              <button
                onClick={() => { haptic.impact('light'); prevTrack(); }}
                className="p-1 text-zinc-400 hover:text-white transition"
              >
                <SkipBack size={18} />
              </button>
              <button
                onClick={() => { haptic.impact('medium'); togglePlay(); }}
                className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition shadow"
              >
                {isPlaying ? <Pause size={16} className="fill-black" /> : <Play size={16} className="fill-black translate-x-0.5" />}
              </button>
              <button
                onClick={() => { haptic.impact('light'); nextTrack(); }}
                className="p-1 text-zinc-400 hover:text-white transition"
              >
                <SkipForward size={18} />
              </button>
            </div>
          </div>

        {/* Tab Switcher: Текст / Сведения */}
        <div className="flex bg-white/5 rounded-xl p-1 gap-1">
          <button
            onClick={() => {
              haptic.selection();
              setActiveTab('lyrics');
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'lyrics'
                ? 'bg-white text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FileText size={14} />
            <span>Текст песни</span>
          </button>

          <button
            onClick={() => {
              haptic.selection();
              setActiveTab('about');
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'about'
                ? 'bg-white text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Info size={14} />
            <span>Сведения</span>
          </button>
        </div>

        {/* ── TAB 1: Live Karaoke Synchronized Lyrics ── */}
        {activeTab === 'lyrics' && (
          <div className="p-3.5 rounded-2xl bg-[#1e1e1e]/70 border border-white/5">
            <LyricsPanel
              trackId={currentTrack.id}
              artist={currentTrack.artist_name}
              title={currentTrack.title}
              duration={currentTrack.duration}
              maxHeightClass="max-h-[42vh]"
            />
          </div>
        )}

        {/* ── TAB 2: Artist & Track Credits (as in Spotify Desktop) ── */}
        {activeTab === 'about' && (
          <div className="space-y-3">
            {/* About Artist Card */}
            <div className="p-4 rounded-2xl bg-[#1e1e1e]/70 border border-white/5 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Об исполнителе
              </span>

              <div className="flex items-center justify-between">
                <div
                  onClick={handleArtistClick}
                  className="cursor-pointer hover:underline"
                >
                  <div className="text-base font-bold text-white">
                    {currentTrack.artist_name}
                  </div>
                  <div className="text-xs text-zinc-400">Основной исполнитель</div>
                </div>

                <button
                  onClick={handleFollowToggle}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition active:scale-95 border ${
                    isFollowing
                      ? 'bg-transparent border-white/30 text-white hover:border-white'
                      : 'bg-white border-white text-black hover:scale-105'
                  }`}
                >
                  {isFollowing ? 'Уже подписаны' : 'Подписаться'}
                </button>
              </div>
            </div>

            {/* Track Credits Card */}
            <div className="p-4 rounded-2xl bg-[#1e1e1e]/70 border border-white/5 space-y-2.5 text-xs text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                Сведения о треке
              </span>

              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-zinc-400">Трек:</span>
                <span className="font-semibold text-white truncate max-w-[200px]">
                  {currentTrack.title}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-zinc-400">Исполнитель:</span>
                <span className="font-semibold text-white truncate max-w-[200px]">
                  {currentTrack.artist_name}
                </span>
              </div>

              {currentTrack.album_title && (
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Альбом:</span>
                  <span className="font-semibold text-white truncate max-w-[200px]">
                    {currentTrack.album_title}
                  </span>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-zinc-400">Длительность:</span>
                <span className="font-semibold text-white">
                  {Math.floor(currentTrack.duration / 60)}:
                  {(currentTrack.duration % 60).toString().padStart(2, '0')}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 text-zinc-400">
                <span>Качество звука:</span>
                <span className="text-[#1DB954] font-bold flex items-center gap-1">
                  <Sparkles size={12} />
                  HQ Audio 192 kbps
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Add Track to Playlist Modal */}
      {currentTrack && (
        <BatchAddToPlaylistModal
          isOpen={isPlaylistModalOpen}
          onClose={() => setIsPlaylistModalOpen(false)}
          tracks={[currentTrack]}
          sourceTitle={currentTrack.title}
        />
      )}
    </aside>
  );
};
