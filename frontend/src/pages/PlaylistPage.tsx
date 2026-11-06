import { useSettingsStore } from '../store/settingsStore';
import React, { useEffect, useState } from 'react';
import { Play, Shuffle, Heart, Music, Trash2, Clock } from 'lucide-react';
import { Playlist, Track } from '../api/types';
import { api } from '../api/client';
import { TrackRow } from '../components/cards/TrackRow';
import { Skeleton } from '../components/ui/Skeleton';
import { usePlayerStore, ActiveMixContext } from '../store/playerStore';
import { useUserStore } from '../store/userStore';
import { useTelegram } from '../hooks/useTelegram';

interface PlaylistPageProps {
  playlistId?: string;
  isLikedSongs?: boolean;
  onBack: () => void;
}

export const PlaylistPage: React.FC<PlaylistPageProps> = ({
  playlistId,
  isLikedSongs = false,
  onBack,
}) => {
  const [loading, setLoading] = useState(true);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);

  const favorites = useUserStore((state) => state.favorites);
  const deletePlaylist = useUserStore((state) => state.deletePlaylist);
  const removeTrackFromPlaylist = useUserStore((state) => state.removeTrackFromPlaylist);

  const setQueue = usePlayerStore((state) => state.setQueue);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);

  const { haptic, setupBackButton } = useTelegram();
  const t = useSettingsStore(s => s.t);

  useEffect(() => {
    const cleanup = setupBackButton(true, onBack);
    return cleanup;
  }, [setupBackButton, onBack]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      if (isLikedSongs) {
        setTracks(favorites);
        setPlaylist({
          id: 'liked-songs',
          title: t('liked_songs'),
          description: t('liked_songs_desc'),
          track_count: favorites.length,
          is_owner: true,
        });
        setLoading(false);
        return;
      }

      if (!playlistId) return;

      try {
        // Try user playlist first
        const userPl = await api.getPlaylist(playlistId).catch(() => null);
        if (userPl) {
          setPlaylist(userPl);
          setTracks(userPl.tracks || []);
        } else {
          // Try Deezer public playlist
          const externalPl = await api.getExternalPlaylist(playlistId);
          setPlaylist(externalPl);
          setTracks(externalPl.tracks || []);
        }
      } catch (e) {
        console.error('Failed to load playlist:', e);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [playlistId, isLikedSongs, favorites.length]);

  const getPlaylistMixContext = (): ActiveMixContext => {
    const artistCounts: Record<string, number> = {};
    tracks.forEach((t) => {
      if (t.artist_name) artistCounts[t.artist_name] = (artistCounts[t.artist_name] || 0) + 1;
    });
    const sortedArtists = Object.entries(artistCounts).sort((a, b) => b[1] - a[1]);
    const topArtist = sortedArtists[0]?.[0] || '';

    return {
      id: isLikedSongs ? 'liked-songs' : `playlist-${playlist?.id || 'custom'}`,
      title: playlist?.title || (isLikedSongs ? 'Любимые треки' : 'Плейлист'),
      query: playlist?.title || (topArtist ? `${topArtist} hits` : 'hits'),
      type: 'playlist',
      nextMix: topArtist
        ? {
            id: `artist-mix-${topArtist}`,
            title: `${topArtist}: радио`,
            query: topArtist,
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
    api.recordRecentContext({
      context_type: isLikedSongs ? 'liked_songs' : 'playlist',
      context_id: isLikedSongs ? 'liked-songs' : playlist?.id || 'playlist',
      title: playlist?.title || (isLikedSongs ? 'Любимые треки' : 'Плейлист'),
      subtitle: `Плейлист • ${tracks.length} треков`,
      cover_url: isLikedSongs ? '' : playlist?.cover_url || tracks[0]?.cover_url || '',
      query: playlist?.title || '',
    });
  };

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      haptic.impact('medium');
      recordContext();
      const ctx = getPlaylistMixContext();
      usePlayerStore.getState().setActiveContextUri(ctx.id);
      usePlayerStore.getState().setActiveMix(ctx);
      setQueue(tracks, 0, ctx);
    }
  };

  const handleShufflePlay = () => {
    if (tracks.length > 0) {
      haptic.impact('medium');
      recordContext();
      toggleShuffle();
      const randIdx = Math.floor(Math.random() * tracks.length);
      const ctx = getPlaylistMixContext();
      usePlayerStore.getState().setActiveContextUri(ctx.id);
      usePlayerStore.getState().setActiveMix(ctx);
      setQueue(tracks, randIdx, ctx);
    }
  };

  const handleDelete = async () => {
    if (playlist && playlist.id && !isLikedSongs) {
      if (confirm(`Delete playlist "${playlist.title}"?`)) {
        await deletePlaylist(playlist.id);
        haptic.notification('warning');
        onBack();
      }
    }
  };

  const handleRemoveTrack = (trackId: string) => {
    if (playlistId && !isLikedSongs) {
      removeTrackFromPlaylist(playlistId, trackId);
      setTracks((prev) => prev.filter((t) => t.id !== trackId));
      haptic.notification('success');
    }
  };

  const totalDurationMin = Math.round(
    tracks.reduce((acc, t) => acc + (t.duration || 0), 0) / 60
  );

  if (loading) {
    return (
      <div className="p-4 space-y-4 pb-32">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-32 select-none animate-fade-in">
      {/* Playlist Hero Section */}
      <div
        className={`p-6 pb-4 ${
          isLikedSongs
            ? 'bg-gradient-to-b from-indigo-800 via-purple-900/40 to-[#121212]'
            : 'bg-gradient-to-b from-zinc-700 via-zinc-900/50 to-[#121212]'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="w-40 h-40 rounded-xl overflow-hidden shadow-2xl flex-shrink-0 flex items-center justify-center bg-black/30">
            {isLikedSongs ? (
              <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center">
                <Heart size={64} className="text-white fill-white" />
              </div>
            ) : playlist?.cover_url ? (
              <img
                src={playlist.cover_url}
                alt={playlist.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Music size={64} className="text-zinc-500" />
            )}
          </div>

          <div className="flex flex-col text-center sm:text-left min-w-0 flex-1">
            <span className="text-xs uppercase font-bold text-zinc-300 tracking-wider">Плейлист</span>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mt-1 mb-2">
              {playlist?.title || 'Плейлист'}
            </h1>
            {playlist?.description && (
              <p className="text-xs text-zinc-300 line-clamp-2 mb-2">
                {playlist.description}
              </p>
            )}
            <div className="text-xs font-semibold text-zinc-300 flex items-center justify-center sm:justify-start gap-2">
              <span>{tracks.length} треков</span>
              {totalDurationMin > 0 && <span>• около {totalDurationMin} мин</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handlePlayAll}
            disabled={tracks.length === 0}
            className="w-14 h-14 rounded-full bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-40 active:scale-95 text-black flex items-center justify-center shadow-lg transition"
            aria-label="Play"
          >
            <Play size={26} className="fill-black translate-x-0.5" />
          </button>

          <button
            onClick={handleShufflePlay}
            disabled={tracks.length === 0}
            className="p-2.5 text-zinc-400 hover:text-white disabled:opacity-40 transition"
            aria-label="Shuffle"
          >
            <Shuffle size={22} />
          </button>
        </div>

        {playlist?.is_owner && !isLikedSongs && (
          <button
            onClick={handleDelete}
            className="p-2 text-zinc-400 hover:text-red-400 transition"
            title="Delete playlist"
          >
            <Trash2 size={20} />
          </button>
        )}
      </div>

      {/* Tracklist */}
      <div className="px-4 mt-2">
        {tracks.length === 0 ? (
          <div className="py-16 text-center text-zinc-500">
            <Music size={40} className="mx-auto mb-2 opacity-40" />
            <p className="font-semibold text-sm">{t('empty_playlist')}</p>
            <p className="text-xs mt-1">Найдите музыку в поиске и добавьте понравившиеся треки.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {tracks.map((track, idx) => (
              <TrackRow
                key={`${track.id}-${idx}`}
                track={track}
                index={idx}
                queueContext={tracks}
                contextUri={isLikedSongs ? 'liked-songs' : `playlist-${playlist?.id}`}
                mixContext={getPlaylistMixContext()}
                onRemove={
                  playlist?.is_owner && !isLikedSongs
                    ? () => handleRemoveTrack(track.id)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
