import { ArtistNames } from '../components/player/ArtistNames';
import { OfflineDownloadButton } from '../components/player/OfflinePanel';
import React, { useEffect, useState } from 'react';
import { Play, Shuffle, Disc, Calendar, Music2, ListPlus } from 'lucide-react';
import { Album, Track } from '../api/types';
import { api } from '../api/client';
import { TrackRow } from '../components/cards/TrackRow';
import { Skeleton } from '../components/ui/Skeleton';
import { usePlayerStore, ActiveMixContext } from '../store/playerStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTelegram } from '../hooks/useTelegram';
import { useNavigationStore } from '../store/navigationStore';
import { BatchAddToPlaylistModal } from '../components/modals/BatchAddToPlaylistModal';

interface AlbumPageProps {
  albumId: string;
  onBack: () => void;
}

export const AlbumPage: React.FC<AlbumPageProps> = ({ albumId, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  const setQueue = usePlayerStore((state) => state.setQueue);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const isShuffle = usePlayerStore((state) => state.isShuffle);
  const t = useSettingsStore((state) => state.t);
  const openArtist = useNavigationStore((state) => state.openArtist);

  const { haptic, setupBackButton } = useTelegram();

  useEffect(() => {
    const cleanup = setupBackButton(true, onBack);
    return cleanup;
  }, [setupBackButton, onBack]);

  useEffect(() => {
    async function loadAlbumData() {
      setLoading(true);
      try {
        const albumData = await api.getAlbum(albumId);
        setAlbum(albumData);
        // Ensure every track in the album inherits the album cover and title if missing
        const formattedTracks = (albumData.tracks || []).map((tr) => ({
          ...tr,
          cover_url: tr.cover_url || albumData.cover_url,
          album_title: tr.album_title || albumData.title,
          album_id: tr.album_id || albumData.id,
          artist_name: tr.artist_name || albumData.artist_name || 'Artist',
          artist_id: tr.artist_id || albumData.artist_id,
        }));
        setTracks(formattedTracks);
      } catch (err) {
        console.error('Failed to load album:', err);
      } finally {
        setLoading(false);
      }
    }

    if (albumId) {
      loadAlbumData();
    }
  }, [albumId]);

  const getAlbumMixContext = (): ActiveMixContext | null => {
    if (!album) return null;
    return {
      id: `album-${album.id}`,
      title: album.title,
      query: `${album.artist_name || ''} ${album.title}`,
      type: 'album',
      nextMix: album.artist_name
        ? {
            id: `artist-mix-${album.artist_id || album.artist_name}`,
            title: `${album.artist_name}: радио`,
            query: album.artist_name,
          }
        : {
            id: 'daily-mix-1',
            title: 'Микс дня #1',
            query: 'daily mix 1',
          },
      subqueryIndex: 0,
    };
  };

  const recordContext = () => {
    if (!album) return;
    api.recordRecentContext({
      context_type: 'album',
      context_id: album.id,
      title: album.title,
      subtitle: `${album.artist_name || 'Альбом'} • ${tracks.length} треков`,
      cover_url: album.cover_url || tracks[0]?.cover_url || '',
      query: `${album.artist_name || ''} ${album.title}`,
    });
  };

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      haptic.impact('medium');
      recordContext();
      const ctx = getAlbumMixContext();
      if (ctx) {
        usePlayerStore.getState().setActiveContextUri(ctx.id);
        usePlayerStore.getState().setActiveMix(ctx);
      }
      setQueue(tracks, 0, ctx);
    }
  };

  const handleShufflePlay = () => {
    if (tracks.length > 0) {
      haptic.impact('medium');
      recordContext();
      if (!isShuffle) {
        toggleShuffle();
      }
      const randIdx = Math.floor(Math.random() * tracks.length);
      const ctx = getAlbumMixContext();
      if (ctx) {
        usePlayerStore.getState().setActiveContextUri(ctx.id);
        usePlayerStore.getState().setActiveMix(ctx);
      }
      setQueue(tracks, randIdx, ctx);
    }
  };

  const totalSeconds = tracks.reduce((acc, tr) => acc + (tr.duration || 180), 0);
  const totalMinutes = Math.round(totalSeconds / 60);
  const releaseYear = album?.release_date ? album.release_date.split('-')[0] : '';

  if (loading) {
    return (
      <div className="p-4 space-y-6 pb-32 animate-fade-in select-none">
        <div className="flex flex-col sm:flex-row items-center gap-5 pt-4">
          <Skeleton className="w-48 h-48 rounded-2xl flex-shrink-0" />
          <div className="flex-1 w-full space-y-3 text-center sm:text-left">
            <Skeleton className="h-4 w-20 mx-auto sm:mx-0 rounded" />
            <Skeleton className="h-8 w-3/4 mx-auto sm:mx-0 rounded-lg" />
            <Skeleton className="h-4 w-1/2 mx-auto sm:mx-0 rounded" />
          </div>
        </div>
        <div className="space-y-2 pt-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="p-8 text-center text-zinc-400 select-none">
        <Disc size={48} className="mx-auto text-zinc-600 mb-3" />
        <p className="text-base font-semibold text-white mb-1">Альбом не найден</p>
        <p className="text-xs text-zinc-500 mb-4">Не удалось загрузить данные об альбоме</p>
        <button
          onClick={onBack}
          className="px-5 py-2 bg-white/10 hover:bg-white/20 active:scale-95 rounded-full text-xs font-bold text-white transition"
        >
          Назад
        </button>
      </div>
    );
  }

  return (
    <div className="pb-36 select-none animate-fade-in">
      {/* Hero Header */}
      <div className="relative pt-6 px-4 pb-6 bg-gradient-to-b from-[#242424] via-[#181818] to-transparent shadow-xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 max-w-xl mx-auto">
          {/* Album Cover Art */}
          <div className="relative w-44 h-44 sm:w-48 sm:h-48 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 bg-[#202020]">
            {album.cover_url ? (
              <img
                src={album.cover_url}
                alt={album.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800 text-zinc-500">
                <Disc size={48} />
              </div>
            )}
          </div>

          {/* Title & Metadata */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/10 text-zinc-300 mb-2">
              {album.record_type === 'single' ? 'Сингл' : album.record_type === 'ep' ? 'EP' : t('album')}
            </span>

            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-2 tracking-tight line-clamp-2">
              {album.title}
            </h1>

            {/* Artist clickable link */}
            {album.artist_name && (
              <div className="mb-2">
                <span className="text-sm font-bold text-white active:opacity-75 transition inline-flex items-center gap-1.5">
                  <Music2 size={14} className="text-[#1DB954]" />
                  <span><ArtistNames track={{...album,id: ''}} /></span>
                </span>
              </div>
            )}

            <div className="text-xs text-zinc-400 font-medium flex items-center justify-center sm:justify-start gap-2">
              {releaseYear && (
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {releaseYear}
                </span>
              )}
              <span>•</span>
              <span className="text-zinc-300 font-semibold">{tracks.length} {t('songs').toLowerCase()}</span>
              {totalMinutes > 0 && (
                <>
                  <span>•</span>
                  <span>~{totalMinutes} мин</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons: Play All & Shuffle */}
        <div className="flex items-center justify-between mt-6 max-w-xl mx-auto px-2">
          <div className="flex items-center gap-4">
            <button
              onClick={handlePlayAll}
              disabled={tracks.length === 0}
              className="w-14 h-14 rounded-full bg-[#1DB954] hover:bg-[#1ed760] active:scale-95 text-black flex items-center justify-center shadow-xl transition"
              aria-label="Play Album"
            >
              <Play size={24} className="fill-black translate-x-0.5" />
            </button>

            <button
              onClick={handleShufflePlay}
              disabled={tracks.length === 0}
              className={`p-3 rounded-full hover:bg-white/10 active:scale-90 transition ${
                isShuffle ? 'text-[#1DB954]' : 'text-zinc-400 hover:text-white'
              }`}
              aria-label="Shuffle"
            >
              <Shuffle size={22} />
            </button>

            <button
              onClick={() => {
                haptic.impact('light');
                setIsBatchModalOpen(true);
              }}
              disabled={tracks.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 text-xs font-bold text-white transition border border-white/5"
              title="Добавить все треки в плейлист"
            >
              <ListPlus size={18} className="text-[#1DB954]" />
              <span>В плейлист</span>
            </button>
          </div>

          <div className="text-xs text-zinc-400 font-medium">
            {tracks.length > 0 && `${tracks.length} треков`}
          </div>
        </div>
      </div>

      <OfflineDownloadButton tracks={tracks} />
      {/* Track List */}
      <div className="p-4 max-w-2xl mx-auto">
        {tracks.length === 0 ? (
          <div className="py-16 text-center text-zinc-500">
            <Disc size={36} className="mx-auto text-zinc-600 mb-2" />
            <p className="text-sm font-semibold">В этом альбоме пока нет доступных треков</p>
          </div>
        ) : (
          <div className="space-y-1">
            {tracks.map((track, index) => (
              <TrackRow
                key={`${track.id}-${index}`}
                track={track}
                index={index}
                queueContext={tracks}
                contextUri={album ? `album-${album.id}` : undefined}
                mixContext={getAlbumMixContext() || undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Batch Add to Playlist Modal */}
      <BatchAddToPlaylistModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        tracks={tracks}
        sourceTitle={album.title}
      />
    </div>
  );
};
