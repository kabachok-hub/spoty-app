import React, { useEffect, useState, useRef } from 'react';
import { Play, Sparkles, Heart, Github, TrendingUp, RefreshCw } from 'lucide-react';
import { Track, Artist, Album, Playlist, ChartsData } from '../api/types';
import { api, apiClient } from '../api/client';
import { SyncModal } from '../components/auth/SyncModal';
import { TrackRow } from '../components/cards/TrackRow';
import { ArtistCard } from '../components/cards/ArtistCard';
import { PlaylistCard } from '../components/cards/PlaylistCard';
import { MixCard, MixItem } from '../components/cards/MixCard';
import { Skeleton } from '../components/ui/Skeleton';
import { ScrollableRow } from '../components/ui/ScrollableRow';
import { usePlayerStore, ActiveMixContext } from '../store/playerStore';
import { useUserStore } from '../store/userStore';
import { useSettingsStore } from '../store/settingsStore';
import { useNavigationStore } from '../store/navigationStore';
import { useTelegram } from '../hooks/useTelegram';

interface HomePageProps {
  onSelectArtist: (artistId: string) => void;
  onSelectPlaylist: (playlistId: string) => void;
  onSelectLikedSongs: () => void;
  onSelectMix: (mix: MixItem, nextMix?: MixItem) => void;
  onSelectAlbum?: (albumId: string) => void;
}

type FilterChip = 'all' | 'music' | 'mixes';

const MOODS = [
  { emoji: '🌙', label: 'Ночная', query: 'night drive', fallback: 'lo-fi beats', gradient: 'from-[#0d0d2b] to-[#2d1b69]' },
  { emoji: '🔥', label: 'Хайп', query: 'hype trap', fallback: 'russian rap', gradient: 'from-[#4a0000] to-[#c0392b]' },
  { emoji: '😢', label: 'Меланхолия', query: 'sad songs', fallback: 'melancholy', gradient: 'from-[#0a1628] to-[#1565c0]' },
  { emoji: '🎉', label: 'Вечеринка', query: 'party hits', fallback: 'dance hits', gradient: 'from-[#003300] to-[#1DB954]' },
  { emoji: '🧘', label: 'Фокус', query: 'deep focus', fallback: 'study music', gradient: 'from-[#1a1800] to-[#e6a817]' },
  { emoji: '❤️', label: 'Романтика', query: 'love songs', fallback: 'romantic songs', gradient: 'from-[#2a0010] to-[#e91e63]' },
];

export const HomePage: React.FC<HomePageProps> = ({
  onSelectArtist,
  onSelectPlaylist,
  onSelectLikedSongs,
  onSelectMix,
  onSelectAlbum,
}) => {
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterChip>('all');

  const [userName, setUserName] = useState('');
  const [dailyMixes, setDailyMixes] = useState<MixItem[]>([]);
  const [bestMixes, setBestMixes] = useState<MixItem[]>([]);
  const [stations, setStations] = useState<MixItem[]>([]);
  const [discoveryArtists, setDiscoveryArtists] = useState<Artist[]>([]);
  const [newReleases, setNewReleases] = useState<Album[]>([]);
  const [recentItems, setRecentItems] = useState<MixItem[]>([]);
  const [chartTracks, setChartTracks] = useState<Track[]>([]);
  const [chartArtists, setChartArtists] = useState<Artist[]>([]);
  const [chartAlbums, setChartAlbums] = useState<any[]>([]);
  const [chartInfo, setChartInfo] = useState<ChartsData | null>(null);
  const [chartRetrying, setChartRetrying] = useState(false);
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);

  const playTrack = usePlayerStore((state) => state.playTrack);
  const setQueue = usePlayerStore((state) => state.setQueue);
  const user = useUserStore((state) => state.user);
  const authStatus = useUserStore(state => state.authStatus);
  const initUser = useUserStore(state => state.initUser);
  const favorites = useUserStore((state) => state.favorites);
  const t = useSettingsStore((state) => state.t);
  const { haptic } = useTelegram();

  const [syncOpen, setSyncOpen] = useState(false);
  const isSignedIn = !!user && user.telegram_id !== 999999999;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadVersion = useRef(0);
  const loadAllData = async (force = false) => {
    const version = ++loadVersion.current;
    const userId = user?.telegram_id;
    const valid = () => version === loadVersion.current && userId === useUserStore.getState().user?.telegram_id;
    if (userId && userId !== 999999999) {
      void apiClient.get('/recommendations/explore').then(({data}) => {
        if (!valid()) return;
        setStations(data.recommended_stations || []);
        setDiscoveryArtists(data.discovery_artists || []);
        setNewReleases(data.new_releases || []);
      }).catch(() => { /* Main feed remains usable when catalog enrichment is unavailable. */ });
    } else { setStations([]); setDiscoveryArtists([]); setNewReleases([]); }
    if (force) {
      setIsRefreshing(true);
      haptic.impact('medium');
    } else {
      setLoading(true);
    }
    try {
      const [recsRes, chartsRes, historyRes] = await Promise.all([
        apiClient.get('/recommendations/home', { params: force ? { force_refresh: true } : {} }).catch(() => ({ data: null })),
        api.getCharts().catch(() => null),
        api.getMyHistory().catch(() => [] as Track[]),
      ]);

      if (!valid()) return;
      const recs = recsRes.data;
      if (recs) {
        setUserName(recs.user_name || user?.first_name || 'друг');
        setDailyMixes(recs.daily_mixes || []);
        setBestMixes(recs.best_mixes || []);
        setRecentItems(recs.recent_items || []);
      }

      setChartInfo(chartsRes);
      setChartTracks(chartsRes?.tracks || []);
      setChartArtists(chartsRes?.artists || []);
      setChartAlbums(chartsRes?.albums || []);
      setRecentTracks(historyRes || []);
      if (force) {
        haptic.notification('success');
      }
    } catch (err) {
      console.error('Failed to load home data:', err);
      if (force) {
        haptic.notification('error');
      }
    } finally {
      if (valid()) { setLoading(false); setIsRefreshing(false); }
    }
  };

  const retryCharts = async () => {
    setChartRetrying(true);
    try {
      const data = await api.getCharts();
      setChartInfo(data);
      setChartTracks(data.tracks);
      setChartArtists(data.artists);
      setChartAlbums(data.albums);
    } catch {
      // Keep any already displayed snapshot; retry remains available.
    } finally {
      setChartRetrying(false);
    }
  };

  useEffect(() => {
    loadAllData(false);
    const tasteChanged = () => { void loadAllData(true); };
    window.addEventListener('spoty:taste-updated', tasteChanged);
    let refreshedAt = Date.now();
    const refreshExpired = () => {
      if (document.visibilityState === 'visible' && Date.now() - refreshedAt >= 10800000) {
        refreshedAt = Date.now();
        void loadAllData(false);
      }
    };
    const timer = window.setInterval(refreshExpired, 60000);
    document.addEventListener('visibilitychange', refreshExpired);
    return () => {
      loadVersion.current++;
      window.removeEventListener('spoty:taste-updated', tasteChanged);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshExpired);
    };
  }, [user]);

  const [activeMood, setActiveMood] = useState<string | null>(null);

  const handleMoodPlay = async (mood: typeof MOODS[0]) => {
    haptic.impact('medium');
    setActiveMood(mood.label);

    // Synchronously prime the audio element within the user gesture context!
    const audio = document.getElementById('spotify-native-audio') as HTMLAudioElement;
    if (audio) {
      audio.play().catch(() => {});
    }

    try {
      let res = await api.search(mood.query, 'track', 30);
      let tracks = res.tracks || [];

      // Fallback: try fallback query if first attempt gave 0 tracks
      if (tracks.length === 0 && mood.fallback) {
        res = await api.search(mood.fallback, 'track', 30);
        tracks = res.tracks || [];
      }

      if (tracks.length > 0) {
        const moodIdx = MOODS.findIndex((m) => m.label === mood.label);
        const nextMood =
          moodIdx !== -1 && moodIdx < MOODS.length - 1 ? MOODS[moodIdx + 1] : MOODS[0];

        const moodContext: ActiveMixContext = {
          id: `mood-${mood.label}`,
          title: `${mood.emoji} ${mood.label}`,
          query: mood.query,
          fallbackQuery: mood.fallback,
          type: 'mood_radio',
          nextMix: nextMood
            ? {
                id: `mood-${nextMood.label}`,
                title: `${nextMood.emoji} ${nextMood.label}`,
                query: nextMood.query,
              }
            : null,
        };

        usePlayerStore.getState().setActiveContextUri(`mood-${mood.label}`);
        usePlayerStore.getState().setActiveMix(moodContext);
        usePlayerStore.getState().playTrack(tracks[0], tracks, `mood-${mood.label}`, moodContext);
      }
    } catch (e) {
      console.error('Mood play error:', e);
    } finally {
      setTimeout(() => setActiveMood(null), 1200);
    }
  };

  const handleMixClick = (mix: MixItem, allMixesList?: MixItem[]) => {
    haptic.impact('light');
    if (mix.is_liked_songs) {
      onSelectLikedSongs();
      return;
    }
    if ((mix.type === 'album' || mix.id.startsWith('album-')) && onSelectAlbum) {
      const albumId = mix.id.replace('album-', '');
      onSelectAlbum(albumId);
      return;
    }
    if ((mix.type === 'playlist' || mix.id.startsWith('playlist-')) && onSelectPlaylist) {
      const playlistId = mix.id.replace('playlist-', '');
      onSelectPlaylist(playlistId);
      return;
    }
    if (mix.type === 'artist' && onSelectArtist) {
      const artistId = mix.id.replace('artist-', '');
      onSelectArtist(artistId);
      return;
    }

    let nextMix: MixItem | undefined = undefined;
    if (allMixesList && allMixesList.length > 1) {
      const idx = allMixesList.findIndex((m) => m.id === mix.id);
      if (idx !== -1 && idx < allMixesList.length - 1) {
        nextMix = allMixesList[idx + 1];
      }
    }

    onSelectMix(mix, nextMix);
  };

  const handlePlayMixDirectly = async (mix: MixItem) => {
    haptic.impact('medium');
    try {
      const q = mix.query || mix.title;
      api.recordRecentContext({
        context_type: mix.type || 'mix',
        context_id: mix.id,
        title: mix.title,
        subtitle: mix.subtitle || 'Микс дня • Spoty',
        cover_url: mix.cover_url || '',
        query: q,
        banner_color: mix.banner_color,
        banner_text: mix.banner_text,
      });

      const tracks: Track[] = await api.getMixTracks(q, 50, false, mix.id);
      if (tracks.length > 0) {
        let nextMix: MixItem | undefined = undefined;
        const allList = dailyMixes.some((m) => m.id === mix.id)
          ? dailyMixes
          : bestMixes.some((m) => m.id === mix.id)
          ? bestMixes
          : stations.some(m => m.id === mix.id) ? stations : recentItems;
        const idx = allList.findIndex((m) => m.id === mix.id);
        if (idx !== -1 && idx < allList.length - 1) {
          nextMix = allList[idx + 1];
        }

        const mixContext: ActiveMixContext = {
          id: mix.id,
          title: mix.title,
          title_en: mix.title_en,
          query: q,
          type: mix.type || 'mix',
          nextMix: nextMix
            ? {
                id: nextMix.id,
                title: nextMix.title,
                title_en: nextMix.title_en,
                subtitle: nextMix.subtitle,
                cover_url: nextMix.cover_url,
                query: nextMix.query || nextMix.title,
                banner_color: nextMix.banner_color,
                banner_text: nextMix.banner_text,
              }
            : null,
        };

        usePlayerStore.getState().setActiveContextUri(mix.id);
        usePlayerStore.getState().setActiveMix(mixContext);
        usePlayerStore.getState().setQueue(tracks, 0, mixContext);
      }
    } catch (e) {
      console.error('Failed to play mix:', e);
    }
  };

  const quickPicks = (recentTracks.length > 0 ? recentTracks : chartTracks).slice(0, 6);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-7 md:space-y-10 pb-36 md:pb-28 select-none animate-fade-in">
      {/* Top Filter Chips (Spotify style: Все / Музыка / Миксы) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
        {[
          { id: 'all' as FilterChip, label: t('all') },
          { id: 'music' as FilterChip, label: t('music') },
          { id: 'mixes' as FilterChip, label: t('mixes') },
        ].map((chip) => (
          <button
            key={chip.id}
            onClick={() => {
              haptic.selection();
              setFilter(chip.id);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
              filter === chip.id
                ? 'bg-[#1DB954] text-black font-bold'
                : 'bg-[#242424] text-zinc-300 hover:bg-[#2e2e2e]'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {!isSignedIn && authStatus === 'checking' && (
        <section aria-label="Загружаем профиль" aria-busy="true" className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
          <Skeleton className="h-5 w-1/3 rounded" />
          <Skeleton className="h-8 w-2/3 rounded" />
          <Skeleton className="h-5 w-full rounded" />
        </section>
      )}
      {!isSignedIn && authStatus === 'error' && (
        <section role="status" className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
          <p className="text-sm text-zinc-300">Не удалось проверить вход. Проверьте соединение и повторите попытку.</p>
          <button onClick={() => void initUser()} className="min-h-11 px-5 rounded-full bg-white/10 text-sm font-semibold">Повторить проверку</button>
        </section>
      )}
      {!isSignedIn && authStatus === 'ready' && (
        <section className="rounded-2xl border border-white/10 bg-[#181d1b]/95 p-5 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#1DB954]">Музыка под ваш вкус</div>
          <h2 className="text-xl font-bold">Ваши любимые треки — в одном месте</h2>
          <p className="text-sm text-zinc-300">Войдите через Telegram, чтобы сохранять песни, создавать плейлисты и получать персональные миксы.</p>
          <button onClick={() => setSyncOpen(true)} className="min-h-11 px-5 rounded-full bg-[#1DB954] text-black font-bold text-sm">Войти через Telegram</button>
        </section>
      )}
      <SyncModal isOpen={syncOpen} onClose={() => setSyncOpen(false)} />


      {/* Quick Picks Responsive Grid (2-col mobile, 3-col tablet, 6-col desktop) */}
      {filter !== 'mixes' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 md:gap-3.5">
            {quickPicks.map((track) => (
              <div
                key={`quick-${track.id}`}
                onClick={() => {
                  haptic.impact('light');
                  playTrack(track, quickPicks);
                }}
                className="group flex items-center bg-[#242424] hover:bg-[#2e2e2e] active:bg-[#383838] rounded-lg overflow-hidden cursor-pointer transition shadow select-none"
              >
                <img
                  src={track.cover_url || '/placeholder.png'}
                  alt={track.title}
                  className="w-14 h-14 min-w-[56px] min-h-[56px] max-w-[56px] max-h-[56px] object-cover flex-shrink-0"
                />
                <span className="font-semibold text-xs text-white px-2.5 line-clamp-2 leading-snug flex-1">
                  {track.title}
                </span>
                <button
                  className="mr-2 w-7 h-7 rounded-full bg-[#1DB954] text-black opacity-0 group-hover:opacity-100 flex items-center justify-center transition shadow-lg flex-shrink-0"
                  aria-label="Play"
                >
                  <Play size={14} className="fill-black translate-x-0.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🎭 Mood Radio */}
      {filter !== 'mixes' && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-base font-bold text-white">🎭 Радио по настроению</h2>
            <button
              onClick={() => {
                haptic.impact('light');
                useNavigationStore.getState().setActiveTab('charts');
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-[#1DB954] hover:text-[#1ed760] transition px-3 py-1 rounded-full bg-[#1DB954]/10 hover:bg-[#1DB954]/20 border border-[#1DB954]/30 active:scale-95 cursor-pointer"
            >
              <TrendingUp size={13} />
              <span>Все Чарты</span>
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MOODS.map((mood) => {
              const isLoading = activeMood === mood.label;
              return (
                <button
                  key={mood.label}
                  onClick={() => handleMoodPlay(mood)}
                  className={`bg-gradient-to-br ${mood.gradient} rounded-xl p-3 flex flex-col items-start gap-1 active:scale-95 transition-all duration-150 shadow relative overflow-hidden ${
                    isLoading ? 'ring-2 ring-white/50 scale-95 opacity-80' : ''
                  }`}
                >
                  <span className="text-xl leading-none">{mood.emoji}</span>
                  <span className="text-[11px] font-bold text-white/90 leading-tight text-left">
                    {isLoading ? 'Загрузка...' : mood.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isSignedIn && (loading || dailyMixes.length > 0) && (<>
      {/* SECTION 1: «Только для тебя, {Имя}» (Screenshot 1) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] font-semibold text-zinc-400">
              {t('made_for_you')},
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight leading-none mt-0.5">
              {userName || user?.first_name || 'Ваши миксы'}
            </h2>
          </div>
          <button
            onClick={() => loadAllData(true)}
            disabled={isRefreshing || loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 text-xs font-semibold transition border border-white/5 ${
              isRefreshing ? 'text-amber-400' : 'text-zinc-300 hover:text-white'
            }`}
            title="Обновляется каждые 3 часа"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-amber-400' : 'text-zinc-400'} />
            <span className="text-[11px] font-medium">{isRefreshing ? 'Обновляем...' : 'Обновить миксы'}</span>
          </button>
        </div>

        {loading ? (
          <div className="flex gap-3 overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="w-36 h-48 rounded-xl flex-shrink-0" />
            ))}
          </div>
        ) : (
          <ScrollableRow>
            {dailyMixes.map((mix) => (
              <div key={mix.id} className="w-36 sm:w-40 flex-shrink-0">
                <MixCard
                  mix={mix}
                  onClick={(m) => handleMixClick(m, dailyMixes)}
                  onPlay={(m) => handlePlayMixDirectly(m)}
                />
              </div>
            ))}
          </ScrollableRow>
        )}
      </div>

      </>)}
      {isSignedIn && (loading || bestMixes.length > 0) && (<>
      {/* SECTION 2: «Твои лучшие миксы» (Screenshot 1) */}
      <div>
        <h2 className="text-lg font-bold text-white mb-3 tracking-tight">
          {t('your_top_mixes')}
        </h2>

        {loading ? (
          <div className="flex gap-3 overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="w-36 h-48 rounded-xl flex-shrink-0" />
            ))}
          </div>
        ) : (
          <ScrollableRow>
            {bestMixes.map((mix) => (
              <div key={mix.id} className="w-36 sm:w-40 flex-shrink-0">
                <MixCard
                  mix={mix}
                  onClick={(m) => handleMixClick(m, bestMixes)}
                  onPlay={(m) => handlePlayMixDirectly(m)}
                />
              </div>
            ))}
          </ScrollableRow>
        )}
      </div>

      </>)}
      {isSignedIn && stations.length > 0 && <section>
        <h2 className="text-lg font-bold text-white mb-1">Рекомендуемые станции</h2>
        <p className="text-xs text-zinc-400 mb-3">Близкое вашему вкусу — с другими исполнителями. Обновляются каждые 3 часа.</p>
        <ScrollableRow>{stations.map(mix => <div key={mix.id} className="w-36 sm:w-40 flex-shrink-0">
          <MixCard mix={mix} onClick={m => handleMixClick(m, stations)} onPlay={handlePlayMixDirectly} />
        </div>)}</ScrollableRow>
      </section>}
      {isSignedIn && filter !== 'mixes' && newReleases.length > 0 && onSelectAlbum && <section>
        <h2 className="text-lg font-bold text-white mb-1">Новые релизы для вас</h2>
        <p className="text-xs text-zinc-400 mb-3">Альбомы, EP и синглы за последние 90 дней от ваших исполнителей.</p>
        <ScrollableRow>{newReleases.map(album => <button key={album.id} onClick={() => onSelectAlbum(album.id)}
          className="w-36 sm:w-40 flex-shrink-0 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition text-left">
          <img src={album.cover_url} alt="" loading="lazy" className="aspect-square w-full object-cover rounded-lg mb-2" />
          <p className="text-xs font-semibold text-white truncate">{album.title}</p>
          <p className="text-[11px] text-zinc-400 truncate">{album.artist_name}</p>
          <p className="text-[10px] text-zinc-400 mt-1">{album.release_date} · {album.record_type === 'single' ? 'Сингл' : album.record_type === 'ep' ? 'EP' : 'Альбом'}</p>
        </button>)}</ScrollableRow>
      </section>}
      {isSignedIn && filter !== 'mixes' && discoveryArtists.length > 0 && <section>
        <h2 className="text-lg font-bold text-white mb-1">Откройте новых исполнителей</h2>
        <p className="text-xs text-zinc-400 mb-3">Рядом с теми, кого вы уже слушаете.</p>
        <ScrollableRow>{discoveryArtists.map(artist => <div key={artist.id} className="w-32 flex-shrink-0">
          <ArtistCard artist={artist} onClick={onSelectArtist} />
        </div>)}</ScrollableRow>
      </section>}

      {/* SECTION 3: «Недавние» (Screenshot 2: Liked songs + Radio) */}
      {recentItems.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-white mb-3 tracking-tight">
            {t('recently_played')}
          </h2>

          <ScrollableRow>
            {/* Prominent Liked Songs Tile */}
            <div
              onClick={() => {
                haptic.impact('light');
                onSelectLikedSongs();
              }}
              className="w-36 sm:w-40 flex-shrink-0 flex flex-col p-2.5 rounded-xl bg-[#181818] hover:bg-[#282828] active:bg-[#303030] transition cursor-pointer select-none"
            >
              <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2 bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-700 flex items-center justify-center shadow-lg">
                <Heart size={44} className="text-white fill-white" />
              </div>
              <div className="font-semibold text-xs text-white truncate">
                {t('liked_songs')}
              </div>
              <p className="text-[11px] text-zinc-400 truncate">
                {favorites.length} {t('songs').toLowerCase()}
              </p>
            </div>

            {/* Other Recent Radio/Mix items */}
            {recentItems.filter((it) => !it.is_liked_songs).map((mix) => (
              <div key={mix.id} className="w-36 sm:w-40 flex-shrink-0">
                <MixCard
                  mix={mix}
                  onClick={(m) => handleMixClick(m, recentItems)}
                  onPlay={(m) => handlePlayMixDirectly(m)}
                />
              </div>
            ))}
          </ScrollableRow>
        </div>
      )}

      {/* SECTION 4: Top Hits Today */}
      {filter !== 'mixes' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white">{chartInfo?.title || 'Популярное в Deezer'}</h2>
            <button onClick={() => useNavigationStore.getState().setActiveTab('charts')} className="text-xs font-semibold text-[#1DB954]">Все треки</button>
          </div>
          <p className="text-xs text-zinc-400 mb-3">{chartInfo?.description || 'Рейтинг Deezer; состав зависит от региона источника.'}</p>
          {loading && !chartInfo && <Skeleton className="h-24 rounded-xl mb-3" />}
          {!loading && (!chartInfo || chartInfo.stale) && <div role="status" className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3 mb-3 text-sm text-zinc-300">
            <span>{chartTracks.length ? 'Показываем сохранённую подборку.' : 'Не удалось загрузить подборку.'}</span>
            <button disabled={chartRetrying} onClick={() => void retryCharts()} className="flex items-center gap-1.5 text-[#1DB954] shrink-0 disabled:opacity-50">
              <RefreshCw size={14} className={chartRetrying ? 'animate-spin' : ''} /> Повторить
            </button>
          </div>}

          <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6 gap-y-1">
            {chartTracks.slice(0, 10).map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                queueContext={chartTracks}
              />
            ))}
          </div>
        </div>
      )}

      {/* SECTION 5: Popular Artists */}
      {chartArtists.length > 0 && <div>
        <h2 className="text-lg font-bold text-white mb-3">Исполнители из подборки</h2>
        <ScrollableRow>
          {chartArtists.slice(0, 12).map((artist) => (
            <div key={artist.id} className="w-32 flex-shrink-0">
              <ArtistCard artist={artist} onClick={onSelectArtist} />
            </div>
          ))}
        </ScrollableRow>
      </div>}

      {/* SECTION 6: New Releases */}
      {chartAlbums.length > 0 && onSelectAlbum && (
        <div>
          <h2 className="text-lg font-bold text-white mb-3">Альбомы из популярных треков</h2>
          <ScrollableRow>
            {chartAlbums.slice(0, 12).map((album: any) => (
              <div
                key={album.id}
                onClick={() => { haptic.impact('light'); onSelectAlbum!(album.id); }}
                className="w-28 flex-shrink-0 cursor-pointer group"
              >
                <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-1.5 shadow">
                  <img
                    src={album.cover_url || album.cover_medium}
                    alt={album.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <p className="text-xs font-semibold text-white truncate">{album.title}</p>
                <p className="text-[10px] text-zinc-400 truncate">{album.artist_name}</p>
              </div>
            ))}
          </ScrollableRow>
        </div>
      )}


      {/* Footer with Creator GitHub */}
      <div className="pt-8 pb-6 flex flex-col items-center justify-center gap-2 border-t border-white/5 mt-4">
        <a
          href="https://github.com/kabachok-hub"
          onClick={(e) => {
            const tg = (window as any).Telegram?.WebApp;
            if (tg?.openLink) {
              e.preventDefault();
              tg.openLink('https://github.com/kabachok-hub');
            }
          }}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white transition group"
        >
          <Github size={16} className="text-zinc-400 group-hover:text-white transition" />
          <span>GitHub: kabachok-hub</span>
        </a>
        <div className="text-[11px] text-zinc-500">
          Spoty • 2026
        </div>
      </div>
    </div>
  );
};
