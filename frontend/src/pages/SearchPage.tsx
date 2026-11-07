import { useBrowseWarmup } from '../platform/useBrowseWarmup';
import { useSettingsStore } from '../store/settingsStore';
import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { Track, Artist, Playlist, Album } from '../api/types';
import { api } from '../api/client';
import { TrackRow } from '../components/cards/TrackRow';
import { ArtistCard } from '../components/cards/ArtistCard';
import { PlaylistCard } from '../components/cards/PlaylistCard';
import { Skeleton } from '../components/ui/Skeleton';
import { useTelegram } from '../hooks/useTelegram';
import { useNavigationStore } from '../store/navigationStore';

interface SearchPageProps {
  onSelectArtist: (artistId: string) => void;
  onSelectPlaylist: (playlistId: string) => void;
  onSelectAlbum?: (albumId: string) => void;
}

type SearchCategory = 'all' | 'track' | 'artist' | 'album' | 'playlist';

const GENRE_CARDS = [
  { name: 'Pop', color: 'bg-gradient-to-br from-pink-600 to-rose-700' },
  { name: 'Hip-Hop', color: 'bg-gradient-to-br from-orange-600 to-amber-700' },
  { name: 'Rock', color: 'bg-gradient-to-br from-red-600 to-red-900' },
  { name: 'Dance & EDM', color: 'bg-gradient-to-br from-teal-500 to-emerald-700' },
  { name: 'Indie', color: 'bg-gradient-to-br from-purple-600 to-indigo-800' },
  { name: 'Chill', color: 'bg-gradient-to-br from-cyan-600 to-blue-800' },
  { name: 'Workout', color: 'bg-gradient-to-br from-emerald-600 to-green-800' },
  { name: 'R&B', color: 'bg-gradient-to-br from-amber-600 to-yellow-800' },
];

export const SearchPage: React.FC<SearchPageProps> = ({
  onSelectArtist,
  onSelectPlaylist,
  onSelectAlbum,
}) => {
  const [query, setQuery] = useState('');
  const [searchError, setSearchError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [activeType, setActiveType] = useState<SearchCategory>('all');
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  useBrowseWarmup(tracks, 'search', !loading && !searchError && !!query.trim());
  const { haptic } = useTelegram();
  const t = useSettingsStore(state => state.t);
  const openAlbum = useNavigationStore((state) => state.openAlbum);

  // Debounce search
  useEffect(() => {
    if (!query.trim()) {
      setTracks([]);
      setArtists([]);
      setPlaylists([]);
      setAlbums([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setSearchError(false);
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await api.search(query.trim(), activeType, 30);
        if (cancelled) return;
        setTracks(res.tracks || []);
        setArtists(res.artists || []);
        setPlaylists(res.playlists || []);
        setAlbums(res.albums || []);
      } catch (err) {
        if (!cancelled) setSearchError(true);
        console.error('Search error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);

    return () => { cancelled = true; clearTimeout(timeout); };
  }, [query, activeType, retry]);

  const handleCategoryClick = (genre: string) => {
    haptic.impact('light');
    setQuery(genre);
  };

  const tabs: { id: SearchCategory; label: string }[] = [
    { id: 'all', label: t('all') },
    { id: 'track', label: t('songs') },
    { id: 'artist', label: t('artists') },
    { id: 'album', label: t('albums') },
    { id: 'playlist', label: t('playlists') },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 pb-36 md:pb-28 select-none animate-fade-in">
      {/* Search Input Bar */}
      <div className="relative max-w-2xl">
        <SearchIcon
          size={20}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search_placeholder')}
          className="w-full bg-[#242424] text-white placeholder-zinc-400 pl-11 pr-10 py-3 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white border border-transparent transition shadow"
        />
        {query && (
          <button
            onClick={() => {
              haptic.impact('light');
              setQuery('');
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Filter Tabs when query is present */}
      {query.trim() && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                haptic.selection();
                setActiveType(tab.id);
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                activeType === tab.id
                  ? 'bg-white text-black'
                  : 'bg-[#282828] text-zinc-300 hover:bg-[#333]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* When no query: Trending + Browse Categories */}
      {!query.trim() && (
        <div className="space-y-6">
          {/* Trending Searches */}
          <div>
            <h2 className="text-base font-bold text-white mb-3">🔥 В тренде</h2>
            <div className="flex flex-wrap gap-2">
              {[
                'тёмный принц', 'королевский XVII', '9mice', 'Егор Крид',
                'Моргенштерн', 'Скриптонит', 'Yanix', 'Playboi Carti',
                'The Weeknd', 'Drake', 'Kendrick Lamar', 'Travis Scott',
              ].map((term) => (
                <button
                  key={term}
                  onClick={() => { haptic.impact('light'); setQuery(term); }}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border border-[#1DB954]/40 text-[#1DB954] bg-[#1DB954]/10 hover:bg-[#1DB954]/20 active:scale-95 transition"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          {/* Browse Genres */}
          <div>
            <h2 className="text-lg font-bold text-white mb-4">{t('browse_all')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
              {GENRE_CARDS.map((genre) => (
                <div
                  key={genre.name}
                  onClick={() => handleCategoryClick(genre.name)}
                  className={`relative h-24 p-3 rounded-xl ${genre.color} cursor-pointer shadow-lg hover:scale-[1.02] active:scale-[0.98] transition select-none overflow-hidden`}
                >
                  <span className="text-base font-bold text-white">{genre.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      )}

      {searchError && (
        <div role="alert" className="p-5 rounded-2xl bg-white/5 border border-white/10">
          <p className="font-semibold">Не удалось выполнить поиск</p>
          <p className="text-sm text-zinc-400 mt-1">Проверьте подключение и попробуйте ещё раз.</p>
          <button onClick={() => setRetry(value => value + 1)} className="min-h-11 mt-3 px-4 rounded-full bg-white/10">Повторить</button>
        </div>
      )}
      {/* Search Results */}
      {!loading && !searchError && query.trim() && (
        <div className="space-y-6">
          {/* Songs Section */}
          {(activeType === 'all' || activeType === 'track') && tracks.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-white mb-3">{t('songs')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6 gap-y-1">
                {tracks.slice(0, activeType === 'all' ? 8 : 30).map((track, i) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={i}
                    queueContext={tracks}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Artists Section */}
          {(activeType === 'all' || activeType === 'artist') && artists.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-white mb-3">{t('artists')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
                {artists.slice(0, activeType === 'all' ? 6 : 24).map((artist) => (
                  <ArtistCard
                    key={artist.id}
                    artist={artist}
                    onClick={onSelectArtist}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Albums Section */}
          {(activeType === 'all' || activeType === 'album') && albums.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-white mb-3">{t('albums')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
                {albums.slice(0, activeType === 'all' ? 6 : 24).map((album) => (
                  <div
                    key={album.id}
                    onClick={() => {
                      haptic.impact('light');
                      if (onSelectAlbum) {
                        onSelectAlbum(album.id);
                      } else {
                        openAlbum(album.id);
                      }
                    }}
                    className="group relative p-2.5 bg-[#181818] hover:bg-[#282828] active:bg-[#323232] rounded-xl cursor-pointer transition select-none flex flex-col"
                  >
                    <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2 bg-[#202020] shadow">
                      <img
                        src={album.cover_url || '/placeholder.png'}
                        alt={album.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                    <div className="font-semibold text-xs text-white truncate leading-snug">
                      {album.title}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5 truncate">
                      {album.artist_name || 'Album'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Playlists Section */}
          {(activeType === 'all' || activeType === 'playlist') && playlists.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-white mb-3">{t('playlists')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
                {playlists.slice(0, activeType === 'all' ? 6 : 24).map((playlist) => (
                  <PlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    onClick={onSelectPlaylist}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {tracks.length === 0 && artists.length === 0 && albums.length === 0 && playlists.length === 0 && (
            <div className="py-16 text-center text-zinc-400">
              <p className="text-base font-semibold">{t('no_results')}: «{query}»</p>
              <p className="text-xs text-zinc-500 mt-1">
                {t('no_results_desc')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
