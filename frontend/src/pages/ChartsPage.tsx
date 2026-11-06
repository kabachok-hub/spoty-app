import React, { useEffect, useState } from 'react';
import { Play, Globe, Flame, RefreshCw } from 'lucide-react';
import { Track, ChartsData } from '../api/types';
import { api, apiClient } from '../api/client';
import { TrackRow } from '../components/cards/TrackRow';
import { Skeleton } from '../components/ui/Skeleton';
import { ScrollableRow } from '../components/ui/ScrollableRow';
import { usePlayerStore, ActiveMixContext } from '../store/playerStore';
import { useTelegram } from '../hooks/useTelegram';

interface ChartsPageProps {
  onSelectArtist: (artistId: string) => void;
  onSelectAlbum: (albumId: string) => void;
}

const MOODS = [
  { emoji: '🌙', label: 'Ночная', query: 'night drive', fallback: 'lo-fi beats', gradient: 'from-[#0d0d2b] to-[#2d1b69]' },
  { emoji: '🔥', label: 'Хайп', query: 'hype trap', fallback: 'russian rap', gradient: 'from-[#4a0000] to-[#c0392b]' },
  { emoji: '😢', label: 'Меланхолия', query: 'sad songs', fallback: 'melancholy', gradient: 'from-[#0a1628] to-[#1565c0]' },
  { emoji: '🎉', label: 'Вечеринка', query: 'party hits', fallback: 'dance hits', gradient: 'from-[#003300] to-[#1DB954]' },
  { emoji: '🧘', label: 'Фокус', query: 'deep focus', fallback: 'study music', gradient: 'from-[#1a1800] to-[#e6a817]' },
  { emoji: '❤️', label: 'Романтика', query: 'love songs', fallback: 'romantic songs', gradient: 'from-[#2a0010] to-[#e91e63]' },
];

type ChartKind = 'russian' | 'global';
interface ChartState { data: ChartsData | null; loading: boolean; error: boolean }

export const ChartsPage: React.FC<ChartsPageProps> = ({ onSelectAlbum }) => {
  const [sections, setSections] = useState<Record<ChartKind, ChartState>>({
    russian: { data: null, loading: true, error: false },
    global: { data: null, loading: true, error: false },
  });
  const [activeMood, setActiveMood] = useState<string | null>(null);
  const { haptic } = useTelegram();

  const loadChart = async (kind: ChartKind, signal?: AbortSignal) => {
    setSections(old => ({ ...old, [kind]: { ...old[kind], loading: true, error: false } }));
    try {
      const response = await apiClient.get<ChartsData>(`/search/charts/${kind}?limit=25`, { signal });
      if (!signal?.aborted) setSections(old => ({ ...old, [kind]: { data: response.data, loading: false, error: false } }));
    } catch {
      if (!signal?.aborted) setSections(old => ({ ...old, [kind]: { ...old[kind], loading: false, error: true } }));
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadChart('russian', controller.signal);
    void loadChart('global', controller.signal);
    return () => controller.abort();
  }, []);

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

      // Fallback: if search returned nothing, try fallback keyword
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

  const handlePlayChart = (tracks: Track[], startIdx: number) => {
    haptic.impact('medium');
    if (tracks.length > startIdx) {
      usePlayerStore.getState().playTrack(tracks[startIdx], tracks);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8 pb-36 md:pb-28 select-none animate-fade-in">

      {/* ── Mood Radio ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Flame size={18} className="text-orange-400" />
          <h2 className="text-lg font-bold text-white">Радио по настроению</h2>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {MOODS.map((mood) => (
            <button
              key={mood.label}
              onClick={() => handleMoodPlay(mood)}
              className={`bg-gradient-to-br ${mood.gradient} rounded-xl p-3.5 flex flex-col items-start gap-1.5 active:scale-95 transition-all duration-150 shadow-lg relative overflow-hidden`}
            >
              {activeMood === mood.label && (
                <div className="absolute inset-0 bg-white/10 flex items-center justify-center">
                  <Play size={20} className="text-white fill-white animate-pulse" />
                </div>
              )}
              <span className="text-2xl leading-none">{mood.emoji}</span>
              <span className="text-[11px] font-bold text-white/90 leading-tight text-left">{mood.label}</span>
            </button>
          ))}
        </div>
      </div>

      {(['russian', 'global'] as ChartKind[]).map(kind => {
        const section = sections[kind];
        const tracks = section.data?.tracks || [];
        return (
          <section key={kind} aria-busy={section.loading}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                {kind === 'global' ? <Globe size={18} className="text-blue-400 shrink-0" /> : <span>🎵</span>}
                <h2 className="text-lg font-bold text-white">{section.data?.title || (kind === 'russian' ? 'Русские и зарубежные хиты' : 'Популярное в Deezer')}</h2>
              </div>
              {tracks.length > 0 && <button onClick={() => handlePlayChart(tracks, 0)}
                className="flex shrink-0 items-center gap-1.5 bg-[#1DB954] text-black text-xs font-bold px-3 py-1.5 rounded-full active:scale-95">
                <Play size={12} className="fill-black" /> Играть
              </button>}
            </div>
            <p className="text-xs text-zinc-400 mb-3">{section.data?.description || (kind === 'russian'
              ? 'Публичная подборка, не официальный чарт России.' : 'Рейтинг Deezer; состав зависит от региона источника.')}
              {section.data?.source_url && <> <a href={section.data.source_url} target="_blank" rel="noopener noreferrer" className="text-[#1DB954] underline">Источник</a></>}
            </p>
            {(section.error || section.data?.stale || (!section.loading && tracks.length === 0)) && (
              <div role="status" className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3 mb-3 text-sm text-zinc-300">
                <span>{tracks.length ? 'Обновление недоступно. Показываем сохранённую подборку.' : 'Не удалось загрузить подборку.'}</span>
                <button disabled={section.loading} onClick={() => void loadChart(kind)} className="flex items-center gap-1.5 text-[#1DB954] shrink-0 disabled:opacity-50">
                  <RefreshCw size={14} className={section.loading ? 'animate-spin' : ''} /> Повторить
                </button>
              </div>
            )}
            {section.loading && tracks.length === 0 ? <div className="space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div> : <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6 gap-y-1">
              {tracks.map((track, i) => <TrackRow key={track.id} track={track} index={i} queueContext={tracks} />)}
            </div>}
          </section>
        );
      })}

      {(sections.global.data?.albums?.length || 0) > 0 && <section>
        <h2 className="text-lg font-bold text-white mb-1">Альбомы из популярных треков</h2>
        <p className="text-xs text-zinc-400 mb-3">В порядке появления в подборке Deezer.</p>
        <ScrollableRow>
          {sections.global.data?.albums.slice(0, 15).map(album => (
            <button key={album.id} onClick={() => { haptic.impact('light'); onSelectAlbum(album.id); }} className="w-28 flex-shrink-0 text-left group">
              <div className="aspect-square rounded-xl overflow-hidden mb-1.5 shadow-lg">
                <img src={album.cover_url || '/placeholder.png'} alt={album.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              </div>
              <p className="text-xs font-semibold text-white truncate">{album.title}</p>
              <p className="text-[10px] text-zinc-400 truncate">{album.artist_name}</p>
            </button>
          ))}
        </ScrollableRow>
      </section>}
    </div>
  );
};
