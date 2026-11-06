import React, { useEffect, useState } from 'react';
import { Play, Shuffle, Sparkles, Disc, ChevronRight, ListPlus, Compass, RefreshCw } from 'lucide-react';
import { Track } from '../api/types';
import { api, apiClient } from '../api/client';
import { TrackRow } from '../components/cards/TrackRow';
import { Skeleton } from '../components/ui/Skeleton';
import { usePlayerStore, ActiveMixContext } from '../store/playerStore';
import { useUserStore } from '../store/userStore';
import { isHiddenTrack } from '../store/recommendationPreferences';
import { useSettingsStore } from '../store/settingsStore';
import { useTelegram } from '../hooks/useTelegram';
import { MixItem } from '../components/cards/MixCard';
import { BatchAddToPlaylistModal } from '../components/modals/BatchAddToPlaylistModal';

interface MixPageProps {
  mix: MixItem;
  nextMix?: MixItem;
  onBack: () => void;
  onSelectNextMix?: (nextMix: MixItem) => void;
}

export const MixPage: React.FC<MixPageProps> = ({
  mix,
  nextMix,
  onBack,
  onSelectNextMix,
}) => {
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rawTracks, setTracks] = useState<Track[]>([]);
  useUserStore(s => s.dislikes);
  const tracks = rawTracks.filter(t => !isHiddenTrack(t));
  const [filterMode, setFilterMode] = useState<'all' | 'familiar' | 'discovery'>('all');
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  const setQueue = usePlayerStore((state) => state.setQueue);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const isShuffle = usePlayerStore((state) => state.isShuffle);
  const language = useSettingsStore((state) => state.language);
  const t = useSettingsStore((state) => state.t);

  const { haptic, setupBackButton } = useTelegram();

  useEffect(() => {
    const cleanup = setupBackButton(true, onBack);
    return cleanup;
  }, [setupBackButton, onBack]);

  const displayTitle = language === 'en' && mix.title_en ? mix.title_en : mix.title;
  const displaySubtitle = language === 'en' && mix.subtitle_en ? mix.subtitle_en : mix.subtitle;
  const bannerColor = mix.banner_color || '#1DB954';

  const loadMixTracks = async (force = false) => {
    if (force) {
      setIsRefreshing(true);
      haptic.impact('medium');
    } else {
      setLoading(true);
    }
    try {
      const q = mix.query || mix.title;
      const data = await api.getMixTracks(q, 50, force, mix.id);
      setTracks(data || []);
      if (force) {
        haptic.notification('success');
      }
    } catch (err) {
      console.error('Failed to load mix tracks:', err);
      if (force) {
        haptic.notification('error');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadMixTracks(false);
  }, [mix.id, mix.query, mix.title]);

  const familiarTracks = tracks.filter((t) => t.is_familiar);
  const discoveryTracks = tracks.filter((t) => !t.is_familiar);

  const displayedTracks =
    filterMode === 'familiar'
      ? familiarTracks
      : filterMode === 'discovery'
      ? discoveryTracks
      : tracks;

  const currentMixContext: ActiveMixContext = {
    id: mix.id,
    title: displayTitle,
    title_en: mix.title_en,
    query: mix.query || mix.title,
    type: mix.type || 'mix',
    nextMix: nextMix
      ? {
          id: nextMix.id,
          title: language === 'en' && nextMix.title_en ? nextMix.title_en : nextMix.title,
          title_en: nextMix.title_en,
          subtitle: language === 'en' && nextMix.subtitle_en ? nextMix.subtitle_en : nextMix.subtitle,
          cover_url: nextMix.cover_url,
          query: nextMix.query || nextMix.title,
          banner_color: nextMix.banner_color,
          banner_text: nextMix.banner_text,
        }
      : null,
  };

  const recordContext = () => {
    api.recordRecentContext({
      context_type: mix.type || 'mix',
      context_id: mix.id,
      title: displayTitle,
      subtitle: displaySubtitle || 'Микс дня • Spotify',
      cover_url: mix.cover_url || (displayedTracks[0]?.cover_url ?? ''),
      query: mix.query || mix.title,
      banner_color: bannerColor,
      banner_text: mix.banner_text,
    });
  };

  const handlePlayAll = () => {
    if (displayedTracks.length > 0) {
      haptic.impact('medium');
      recordContext();
      usePlayerStore.getState().setActiveContextUri(mix.id);
      usePlayerStore.getState().setActiveMix(currentMixContext);
      setQueue(displayedTracks, 0, currentMixContext);
    }
  };

  const handleShufflePlay = () => {
    if (displayedTracks.length > 0) {
      haptic.impact('medium');
      recordContext();
      if (!isShuffle) {
        toggleShuffle();
      }
      const randIdx = Math.floor(Math.random() * displayedTracks.length);
      usePlayerStore.getState().setActiveContextUri(mix.id);
      usePlayerStore.getState().setActiveMix(currentMixContext);
      setQueue(displayedTracks, randIdx, currentMixContext);
    }
  };

  const totalSeconds = displayedTracks.reduce((acc, tr) => acc + (tr.duration || 180), 0);
  const totalMinutes = Math.round(totalSeconds / 60);

  return (
    <div className="pb-36 select-none animate-fade-in">
      {/* Hero Header with dynamic mix banner color gradient */}
      <div
        className="relative pt-6 px-4 pb-8 rounded-b-3xl transition-colors duration-500 shadow-2xl"
        style={{
          background: `linear-gradient(180deg, ${bannerColor}66 0%, #121212 100%)`,
        }}
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 max-w-xl mx-auto">
          {/* Mix Cover Artwork */}
          <div className="relative w-44 h-44 sm:w-48 sm:h-48 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 bg-[#202020]">
            {mix.cover_url ? (
              <img
                src={mix.cover_url}
                alt={displayTitle}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950 p-4 text-center">
                <Disc size={48} className="text-zinc-500 mb-2" />
                <span className="text-xs font-bold text-zinc-300 line-clamp-2">{displayTitle}</span>
              </div>
            )}

            {/* Spotify style colored banner overlay at bottom */}
            {mix.banner_text && (
              <div
                className="absolute bottom-2.5 left-2.5 right-2.5 px-2.5 py-1 rounded text-black font-black text-xs tracking-tight uppercase truncate shadow-lg"
                style={{ backgroundColor: bannerColor }}
              >
                {mix.banner_text}
              </div>
            )}
          </div>

          {/* Title & Metadata */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/10 text-white mb-2">
              {mix.type === 'artist_mix' ? 'Микс артиста' : 'Персональный микс'}
            </span>

            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-2">
              {displayTitle}
            </h1>

            <p className="text-xs sm:text-sm text-zinc-300 line-clamp-2 mb-2 leading-relaxed">
              {displaySubtitle}
            </p>

            <div className="text-xs text-zinc-400 font-medium flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span>Spoty • <span className="text-white font-semibold">{displayedTracks.length} треков</span></span>
              {totalMinutes > 0 && <span>• ~{totalMinutes} мин</span>}
              <span className="text-[11px] text-[#1DB954] bg-[#1DB954]/10 border border-[#1DB954]/25 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
                <Sparkles size={11} />
                Обновляется каждые 2–3 ч
              </span>
            </div>

            {/* Smart Mix DNA Badge */}
            {familiarTracks.length > 0 && discoveryTracks.length > 0 && (
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  <Sparkles size={12} />
                  <span>{familiarTracks.length} любимых</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                  <Compass size={12} />
                  <span>{discoveryTracks.length} новых открытий</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons: Play All & Shuffle & Refresh */}
        <div className="flex items-center justify-between mt-6 max-w-xl mx-auto px-2">
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <button
              onClick={handlePlayAll}
              disabled={displayedTracks.length === 0}
              className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition"
              aria-label="Play All"
            >
              <Play size={24} className="fill-black translate-x-0.5" />
            </button>

            <button
              onClick={handleShufflePlay}
              disabled={displayedTracks.length === 0}
              className={`p-3 rounded-full hover:bg-white/10 transition ${
                isShuffle ? 'text-[#1DB954]' : 'text-zinc-400 hover:text-white'
              }`}
              aria-label="Shuffle"
            >
              <Shuffle size={20} />
            </button>

            <button
              onClick={() => {
                haptic.impact('light');
                setIsBatchModalOpen(true);
              }}
              disabled={displayedTracks.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 text-xs font-bold text-white transition border border-white/5"
              title="Добавить все треки в плейлист"
            >
              <ListPlus size={16} className="text-[#1DB954]" />
              <span className="hidden sm:inline">В плейлист</span>
            </button>

            <button
              onClick={() => loadMixTracks(true)}
              disabled={isRefreshing || loading}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 text-xs font-bold transition border border-white/5 ${
                isRefreshing ? 'text-amber-400' : 'text-zinc-300 hover:text-white'
              }`}
              title="Обновить треки в миксе прямо сейчас"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-amber-400' : ''} />
              <span>{isRefreshing ? 'Обновляем...' : 'Обновить'}</span>
            </button>
          </div>

          <div className="text-xs text-zinc-400">
            {displayedTracks.length > 0 && `Показано ${displayedTracks.length} из ${tracks.length}`}
          </div>
        </div>
      </div>

      {/* Smart Filter Pills */}
      {familiarTracks.length > 0 && discoveryTracks.length > 0 && (
        <div className="flex items-center gap-1.5 max-w-2xl mx-auto px-4 mt-4 mb-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => {
              haptic.selection();
              setFilterMode('all');
            }}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition active:scale-95 flex-shrink-0 ${
              filterMode === 'all'
                ? 'bg-white text-black font-bold shadow'
                : 'bg-[#222] text-zinc-400 hover:text-white'
            }`}
          >
            Все ({tracks.length})
          </button>
          <button
            onClick={() => {
              haptic.selection();
              setFilterMode('familiar');
            }}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition active:scale-95 flex-shrink-0 ${
              filterMode === 'familiar'
                ? 'bg-emerald-500 text-black font-bold shadow'
                : 'bg-[#222] text-zinc-400 hover:text-emerald-400'
            }`}
          >
            💎 Любимое ({familiarTracks.length})
          </button>
          <button
            onClick={() => {
              haptic.selection();
              setFilterMode('discovery');
            }}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition active:scale-95 flex-shrink-0 ${
              filterMode === 'discovery'
                ? 'bg-indigo-500 text-white font-bold shadow'
                : 'bg-[#222] text-zinc-400 hover:text-indigo-300'
            }`}
          >
            ✨ Открытия ({discoveryTracks.length})
          </button>
        </div>
      )}

      {/* Track List (Up to 50 tracks) */}
      <div className="p-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="space-y-3">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="w-40 h-4" />
                  <Skeleton className="w-24 h-3" />
                </div>
              </div>
            ))}
          </div>
        ) : displayedTracks.length === 0 ? (
          <div className="py-16 text-center text-zinc-500">
            <Sparkles size={36} className="mx-auto text-zinc-600 mb-2" />
            <p className="text-sm font-semibold">В этой категории пока нет треков</p>
          </div>
        ) : (
          <div className="space-y-1">
            {displayedTracks.map((track, index) => (
              <TrackRow
                key={`${track.id}-${index}`}
                track={track}
                index={index}
                queueContext={displayedTracks}
                contextUri={mix.id}
                mixContext={currentMixContext}
              />
            ))}
          </div>
        )}

        {/* Next Mix in line card */}
        {nextMix && onSelectNextMix && (
          <div
            onClick={() => {
              haptic.impact('medium');
              onSelectNextMix(nextMix);
            }}
            className="mt-8 p-4 rounded-2xl bg-[#1c1c1c] hover:bg-[#252525] border border-white/10 transition cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-zinc-800 overflow-hidden flex-shrink-0 shadow">
                {nextMix.cover_url ? (
                  <img
                    src={nextMix.cover_url}
                    alt={nextMix.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400">
                    <Disc size={20} />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-[#1DB954] uppercase tracking-wider">
                  Следующий микс
                </div>
                <div className="text-sm font-bold text-white truncate">
                  {language === 'en' && nextMix.title_en ? nextMix.title_en : nextMix.title}
                </div>
                <div className="text-xs text-zinc-400 truncate">
                  {nextMix.subtitle}
                </div>
              </div>
            </div>

            <ChevronRight size={20} className="text-zinc-400 group-hover:text-white group-hover:translate-x-1 transition" />
          </div>
        )}
      </div>

      {/* Batch Add to Playlist Modal */}
      <BatchAddToPlaylistModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        tracks={displayedTracks}
        sourceTitle={displayTitle}
      />
    </div>
  );
};
