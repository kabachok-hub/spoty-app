import { MoodRadio } from '../components/layout/MoodRadio';
import React, { useEffect, useState } from 'react';
import { Play, Globe, RefreshCw } from 'lucide-react';
import { Track, ChartsData } from '../api/types';
import { apiClient } from '../api/client';
import { TrackRow } from '../components/cards/TrackRow';
import { Skeleton } from '../components/ui/Skeleton';
import { ScrollableRow } from '../components/ui/ScrollableRow';
import { usePlayerStore } from '../store/playerStore';
import { useTelegram } from '../hooks/useTelegram';

interface ChartsPageProps {
  onSelectArtist: (artistId: string) => void;
  onSelectAlbum: (albumId: string) => void;
}



type ChartKind = 'russian' | 'global';
interface ChartState { data: ChartsData | null; loading: boolean; error: boolean }

export const ChartsPage: React.FC<ChartsPageProps> = ({ onSelectAlbum }) => {
  const [sections, setSections] = useState<Record<ChartKind, ChartState>>({
    russian: { data: null, loading: true, error: false },
    global: { data: null, loading: true, error: false },
  });
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

  const handlePlayChart = (tracks: Track[], startIdx: number) => {
    haptic.impact('medium');
    if (tracks.length > startIdx) {
      usePlayerStore.getState().playTrack(tracks[startIdx], tracks);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8 pb-36 md:pb-28 select-none animate-fade-in">

      <MoodRadio />

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
