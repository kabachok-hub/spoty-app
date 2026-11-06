import React, { useEffect, useState } from 'react';
import { Play, Pause, Shuffle, Check, Plus, BadgeCheck } from 'lucide-react';
import { Artist, Track, Album } from '../api/types';
import { api } from '../api/client';
import { TrackRow } from '../components/cards/TrackRow';
import { Skeleton } from '../components/ui/Skeleton';
import { ScrollableRow } from '../components/ui/ScrollableRow';
import { usePlayerStore } from '../store/playerStore';
import { useUserStore } from '../store/userStore';
import { useSettingsStore } from '../store/settingsStore';
import { useNavigationStore } from '../store/navigationStore';
import { useTelegram } from '../hooks/useTelegram';

interface ArtistPageProps {
  artistId: string;
  onBack: () => void;
  onSelectAlbum?: (albumId: string) => void;
}

export const ArtistPage: React.FC<ArtistPageProps> = ({
  artistId,
  onBack,
  onSelectAlbum,
}) => {
  const [loading, setLoading] = useState(true);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [playingAlbumId, setPlayingAlbumId] = useState<string | null>(null);

  const isFollowing = useUserStore((state) => state.isFollowing(artistId));
  const toggleFollowArtist = useUserStore((state) => state.toggleFollowArtist);
  const setQueue = usePlayerStore((state) => state.setQueue);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const activeContextUri = usePlayerStore((state) => state.activeContextUri);
  const setActiveContextUri = usePlayerStore((state) => state.setActiveContextUri);
  const t = useSettingsStore((state) => state.t);
  const openAlbum = useNavigationStore((state) => state.openAlbum);

  const { haptic, setupBackButton } = useTelegram();

  useEffect(() => {
    const cleanup = setupBackButton(true, onBack);
    return cleanup;
  }, [setupBackButton, onBack]);

  useEffect(() => {
    async function loadArtistData() {
      setLoading(true);
      try {
        const [artistRes, tracksRes, albumsRes] = await Promise.all([
          api.getArtist(artistId),
          api.getArtistTopTracks(artistId),
          api.getArtistAlbums(artistId),
        ]);
        setArtist(artistRes);
        setTopTracks(tracksRes || []);
        setAlbums(albumsRes || []);
      } catch (err) {
        console.error('Failed to load artist:', err);
      } finally {
        setLoading(false);
      }
    }

    loadArtistData();
  }, [artistId]);

  const handlePlayAll = () => {
    if (topTracks.length > 0) {
      haptic.impact('medium');
      setQueue(topTracks, 0);
    }
  };

  const handleShufflePlay = () => {
    if (topTracks.length > 0) {
      haptic.impact('medium');
      toggleShuffle();
      const randomIdx = Math.floor(Math.random() * topTracks.length);
      setQueue(topTracks, randomIdx);
    }
  };

  const handleFollowToggle = () => {
    if (artist) {
      haptic.notification('success');
      toggleFollowArtist(artist);
    }
  };

  const handleAlbumClick = (albumId: string) => {
    haptic.impact('light');
    if (onSelectAlbum) {
      onSelectAlbum(albumId);
    } else {
      openAlbum(albumId);
    }
  };

  const handlePlayAlbumDirectly = async (album: Album, e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.impact('medium');

    if (activeContextUri === album.id) {
      togglePlay();
      return;
    }

    setPlayingAlbumId(album.id);
    try {
      const albumData = await api.getAlbum(album.id);
      const albumTracks = (albumData.tracks || []).map((tr) => ({
        ...tr,
        cover_url: tr.cover_url || album.cover_url,
        album_title: tr.album_title || album.title,
        album_id: tr.album_id || album.id,
        artist_name: tr.artist_name || album.artist_name || artist?.name || 'Artist',
        artist_id: tr.artist_id || album.artist_id || artistId,
      }));
      if (albumTracks.length > 0) {
        setActiveContextUri(album.id);
        setQueue(albumTracks, 0);
      }
    } catch (err) {
      console.error('Failed to play album:', err);
    } finally {
      setPlayingAlbumId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-6 pb-32">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-10 w-48 rounded-full" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="p-8 text-center text-zinc-400">
        <p>Artist not found.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-white/10 rounded-full text-xs font-semibold text-white"
        >
          Назад
        </button>
      </div>
    );
  }

  const displayedTracks = showAllTracks ? topTracks : topTracks.slice(0, 5);

  return (
    <div className="pb-32 select-none animate-fade-in">
      {/* Hero Banner Header */}
      <div className="relative h-72 w-full overflow-hidden">
        <img
          src={artist.picture_url || '/placeholder.png'}
          alt={artist.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/40 to-transparent flex flex-col justify-end p-5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 mb-1">
            <BadgeCheck size={16} className="fill-blue-500 text-black" />
            <span className="text-white">{t('verified_artist')}</span>
          </div>

          <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none mb-2">
            {artist.name}
          </h1>

          {artist.nb_fan !== undefined && artist.nb_fan > 0 && (
            <p className="text-xs text-zinc-300 font-medium">
              {artist.nb_fan.toLocaleString()} {t('monthly_listeners')}
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handlePlayAll}
            className="w-14 h-14 rounded-full bg-[#1DB954] hover:bg-[#1ed760] active:scale-95 text-black flex items-center justify-center shadow-lg transition"
            aria-label="Play"
          >
            <Play size={26} className="fill-black translate-x-0.5" />
          </button>

          <button
            onClick={handleShufflePlay}
            className="p-2.5 text-zinc-400 hover:text-white transition"
            aria-label="Shuffle play"
          >
            <Shuffle size={22} />
          </button>

          <button
            onClick={handleFollowToggle}
            className={`px-4 py-1.5 rounded-full border text-xs font-bold transition flex items-center gap-1.5 ${
              isFollowing
                ? 'border-white/20 text-white hover:border-white'
                : 'border-white text-white hover:scale-105'
            }`}
          >
            {isFollowing ? (
              <>
                <Check size={14} className="text-[#1DB954]" /> {t('following')}
              </>
            ) : (
              <>
                <Plus size={14} /> {t('follow')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Popular Tracks Section */}
      <div className="px-5 mt-2">
        <h2 className="text-lg font-bold text-white mb-3">{t('popular')}</h2>
        <div className="space-y-1">
          {displayedTracks.map((track, idx) => (
            <TrackRow
              key={track.id}
              track={track}
              index={idx}
              queueContext={topTracks}
            />
          ))}
        </div>

        {topTracks.length > 5 && (
          <button
            onClick={() => {
              haptic.selection();
              setShowAllTracks(!showAllTracks);
            }}
            className="mt-3 text-xs font-bold text-zinc-400 hover:text-white transition py-1 inline-block"
          >
            {showAllTracks ? t('show_less') : t('show_all')}
          </button>
        )}
      </div>

      {/* Latest Release Card (Spotify Style) */}
      {albums.length > 0 && albums[0] && (
        <div className="px-5 mt-6">
          <h2 className="text-lg font-bold text-white mb-2.5">{t('new_release')}</h2>
          <div
            onClick={() => handleAlbumClick(albums[0].id)}
            className="flex items-center gap-3.5 p-3 rounded-xl bg-[#181818] hover:bg-[#242424] active:bg-[#2c2c2c] cursor-pointer transition group"
          >
            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0 shadow">
              <img
                src={albums[0].cover_url || '/placeholder.png'}
                alt={albums[0].title}
                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
              />
              <button
                onClick={(e) => handlePlayAlbumDirectly(albums[0], e)}
                disabled={playingAlbumId === albums[0].id}
                className="absolute right-1.5 bottom-1.5 w-7 h-7 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black shadow-lg flex items-center justify-center transition"
                aria-label="Play Album"
              >
                {playingAlbumId === albums[0].id ? (
                  <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play size={13} className="fill-black translate-x-0.5" />
                )}
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate">{albums[0].title}</div>
              <div className="text-xs text-zinc-400 mt-0.5 truncate">
                {albums[0].release_date ? albums[0].release_date : t('album')}
                {albums[0].nb_tracks ? ` • ${albums[0].nb_tracks} треков` : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discography / Albums */}
      {albums.length > 0 && (
        <div className="px-5 mt-8">
          <h2 className="text-lg font-bold text-white mb-3">{t('discography')}</h2>
          <ScrollableRow>
            {albums.map((album) => {
              const isThisAlbumActive = activeContextUri === album.id;
              const isThisAlbumPlaying = isThisAlbumActive && isPlaying;

              return (
                <div
                  key={album.id}
                  onClick={() => handleAlbumClick(album.id)}
                  className="group relative w-36 sm:w-44 flex-shrink-0 p-2.5 bg-[#181818] hover:bg-[#282828] active:bg-[#323232] rounded-xl cursor-pointer transition select-none flex flex-col"
                >
                  <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2 bg-[#202020] shadow">
                    <img
                      src={album.cover_url || '/placeholder.png'}
                      alt={album.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    {/* Floating Green Play Button */}
                    <button
                      onClick={(e) => handlePlayAlbumDirectly(album, e)}
                      disabled={playingAlbumId === album.id}
                      className={`absolute right-2 bottom-2 w-9 h-9 rounded-full bg-[#1DB954] hover:bg-[#1ed760] active:scale-95 text-black shadow-xl flex items-center justify-center transition-all duration-200 z-10 ${
                        isThisAlbumPlaying
                          ? 'opacity-100 scale-100 shadow-lg shadow-black/60'
                          : 'opacity-90 sm:opacity-0 sm:group-hover:opacity-100'
                      }`}
                      aria-label={isThisAlbumPlaying ? 'Pause Album' : 'Play Album'}
                    >
                      {playingAlbumId === album.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      ) : isThisAlbumPlaying ? (
                        <Pause size={18} className="fill-black text-black" />
                      ) : (
                        <Play size={18} className="fill-black translate-x-0.5" />
                      )}
                    </button>
                  </div>
                  <div className="font-semibold text-xs text-white truncate leading-snug">
                    {album.title}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5 truncate">
                    {album.release_date ? album.release_date.split('-')[0] : t('album')}
                    {album.nb_tracks ? ` • ${album.nb_tracks} треков` : ''}
                  </div>
                </div>
              );
            })}
          </ScrollableRow>
        </div>
      )}
    </div>
  );
};
