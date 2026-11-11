import { ArtistNames } from '../player/ArtistNames';
import { trackShareUrl } from '../../platform/publicSite';
import { refreshRecording } from '../../hooks/refreshRecording';
import React, { useState } from 'react';
import { Play, Pause, Heart, MoreVertical, Plus, Trash2, ListPlus, Download, Share2, RefreshCw } from 'lucide-react';
import { Track } from '../../api/types';
import { api } from '../../api/client';
import { usePlayerStore } from '../../store/playerStore';
import { useUserStore } from '../../store/userStore';
import { useTelegram } from '../../hooks/useTelegram';
import { useNavigationStore } from '../../store/navigationStore';
import { DislikeButton } from '../player/DislikeButton';

interface TrackRowProps {
  track: Track;
  index?: number;
  queueContext?: Track[];
  showIndex?: boolean;
  onRemove?: () => void;
  playlistId?: string;
  contextUri?: string;
  mixContext?: import('../../store/playerStore').ActiveMixContext;
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  queueContext,
  showIndex = true,
  onRemove,
  playlistId,
  contextUri,
  mixContext,
}) => {
  const openArtist = useNavigationStore((state) => state.openArtist);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const playNext = usePlayerStore((state) => state.playNext);

  const isLiked = useUserStore((state) => state.isLiked(track.id));
  const toggleLike = useUserStore((state) => state.toggleLike);
  const playlists = useUserStore((state) => state.playlists);
  const addTrackToPlaylist = useUserStore((state) => state.addTrackToPlaylist);

  const { haptic } = useTelegram();
  const [showMenu, setShowMenu] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);

  const isCurrent = currentTrack?.id === track.id;

  const handlePlayClick = () => {
    haptic.impact('light');
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track, queueContext, contextUri, mixContext);
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.notification('success');
    toggleLike(track);
  };

  const handleRefreshTrack = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    haptic.impact('medium');
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      await refreshRecording(track);
      haptic.notification('success');
    } catch (err) {
      console.error('Refresh track failed:', err);
      setRefreshError('Не удалось обновить запись. Попробуйте ещё раз.');
      haptic.notification('error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div
      className={`group relative flex items-center justify-between p-2 rounded-lg hover:bg-white/10 active:bg-white/15 transition cursor-pointer select-none touch-manipulation ${
        isCurrent ? 'bg-white/10' : ''
      }`}
    >
      <button
        type="button"
        onClick={handlePlayClick}
        aria-label={`${isCurrent && isPlaying ? 'Приостановить' : 'Воспроизвести'}: ${track.title}`}
        className="absolute inset-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1DB954]"
      />
      <div className="relative pointer-events-none flex items-center gap-3 min-w-0 flex-1">
        {showIndex && typeof index === 'number' && (
          <div className="w-5 text-center text-xs font-semibold text-zinc-400 group-hover:hidden">
            {isCurrent && isPlaying ? (
              <span className="flex items-end justify-center gap-0.5 h-3">
                <span className="w-0.5 h-3 bg-[#1DB954] animate-bounce" />
                <span className="w-0.5 h-2 bg-[#1DB954] animate-bounce delay-100" />
                <span className="w-0.5 h-3.5 bg-[#1DB954] animate-bounce delay-200" />
              </span>
            ) : (
              index + 1
            )}
          </div>
        )}

        <div className="relative w-11 h-11 flex-shrink-0 rounded-md overflow-hidden bg-[#282828]">
          <img
            src={track.cover_url || '/placeholder.png'}
            alt={track.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div
            className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
              isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            {isCurrent && isPlaying ? (
              <Pause size={18} className="text-white fill-white" />
            ) : (
              <Play size={18} className="text-white fill-white translate-x-0.5" />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div
            className={`text-sm font-semibold truncate ${
              isCurrent ? 'text-[#1DB954]' : 'text-white'
            }`}
          >
            {track.title}
          </div>
          {refreshError && <p role="status" className="text-xs text-amber-300">{refreshError}</p>}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="pointer-events-auto w-fit max-w-full min-w-0 p-0 text-xs text-zinc-400 truncate text-left transition ">
              <ArtistNames track={track} />
            </span>
            {track.badge && (
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 leading-none ${
                  track.is_familiar
                    ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/20'
                    : 'text-indigo-300 bg-indigo-500/15 border border-indigo-500/20'
                }`}
              >
                {track.badge}
              </span>
            )}
          </div>
        </div>
      </div>

      <div onClick={handlePlayClick} className="relative flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleLikeClick}
          className="min-w-11 min-h-11 flex items-center justify-center text-zinc-400 hover:text-white transition"
          aria-label="Like"
        >
          <Heart
            size={18}
            className={isLiked ? 'text-[#1DB954] fill-[#1DB954]' : 'hover:scale-110'}
          />
        </button>

        <span className="pointer-events-none text-xs text-zinc-400 w-10 text-right">
          {formatDuration(track.duration)}
        </span>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className={`min-w-11 min-h-11 rounded-full transition flex items-center justify-center ${
              showMenu ? 'text-white bg-white/15' : 'text-zinc-300 hover:text-white hover:bg-white/10'
            }`}
            title="Действия с треком"
            aria-label="More options"
          >
            <MoreVertical size={19} />
          </button>

          {showMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-9 z-50 w-52 bg-[#262626] border border-white/15 rounded-2xl shadow-2xl py-1 text-sm text-zinc-200 animate-fade-in backdrop-blur-xl"
            >
              <button
                onClick={() => {
                  playNext(track);
                  haptic.notification('success');
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left"
              >
                <ListPlus size={16} /> Играть следующей
              </button>

              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowPlaylistPicker(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left"
              >
                <Plus size={16} /> В плейлист
              </button>

              <button className="w-full flex items-center gap-3 px-3 py-3 hover:bg-white/10 text-left text-zinc-200" onClick={() => api.saveOffline(track)}><Download size={16} />Сохранить офлайн</button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  haptic.notification('success');
                  api.downloadTrack(track);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left text-zinc-200"
              >
                <Download size={16} className="text-[#1DB954]" /> Скачать MP3
              </button>

              <button
                onClick={() => {
                  setShowMenu(false);
                  haptic.impact('light');
                  const tg = (window as any).Telegram?.WebApp;
                  const url = trackShareUrl(track.id);
                  const text = `🎵 $<ArtistNames track={track} /> — ${track.title}`;
                  if (tg?.openTelegramLink) {
                    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
                  } else {
                    navigator.clipboard?.writeText(`${text}\n${url}`);
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left text-zinc-200"
              >
                <Share2 size={16} className="text-blue-400" /> Поделиться
              </button>

              <button
                onClick={handleRefreshTrack}
                disabled={isRefreshing}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left text-zinc-200"
              >
                <RefreshCw size={16} className={`text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Обновляем трек...' : 'Не тот трек (обновить)'}
              </button>

              <DislikeButton track={track} label />

              {onRemove && (
                <button
                  onClick={() => {
                    onRemove();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-red-500/20 text-red-400 text-left"
                >
                  <Trash2 size={16} /> Remove
                </button>
              )}
            </div>
          )}

          {showPlaylistPicker && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
              <div className="w-full max-w-xs bg-[#242424] border border-white/10 rounded-2xl p-4 shadow-2xl">
                <div className="font-bold text-base text-white mb-3">Добавить в плейлист</div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {playlists.length === 0 ? (
                    <div className="text-xs text-zinc-400 py-3 text-center">Плейлисты пока не созданы</div>
                  ) : (
                    playlists.map((pl) => {
                      const isHuge = pl.title.trim().toLowerCase() === 'огромный плейлист';
                      return (
                        <button
                          key={pl.id}
                          onClick={() => {
                            addTrackToPlaylist(pl.id, track);
                            haptic.notification('success');
                            setShowPlaylistPicker(false);
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl transition text-left text-sm ${
                            isHuge
                              ? 'bg-[#1DB954]/15 border border-[#1DB954]/30 hover:bg-[#1DB954]/25 text-white font-semibold'
                              : 'hover:bg-white/10 text-zinc-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {isHuge && <span className="text-[#1DB954]">🔥</span>}
                            <span className="truncate">{pl.title}</span>
                          </div>
                          <Plus size={16} className={isHuge ? 'text-[#1DB954]' : 'text-zinc-400'} />
                        </button>
                      );
                    })
                  )}
                </div>
                <button
                  onClick={() => setShowPlaylistPicker(false)}
                  className="w-full mt-3 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-semibold transition"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
