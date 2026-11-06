import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Clock,
  Play,
  Share2,
  Check,
  Disc,
  Music2,
  Sparkles,
  Trophy,
  Flame,
  Headphones,
  RotateCw,
} from 'lucide-react';
import { UserStats } from '../api/types';
import { api } from '../api/client';
import { usePlayerStore } from '../store/playerStore';
import { useNavigationStore } from '../store/navigationStore';
import { useTelegram } from '../hooks/useTelegram';
import { Skeleton } from '../components/ui/Skeleton';

interface StatsPageProps {
  onBack: () => void;
}

export const StatsPage: React.FC<StatsPageProps> = ({ onBack }) => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const playTrack = usePlayerStore((state) => state.playTrack);
  const setQueue = usePlayerStore((state) => state.setQueue);
  const openArtist = useNavigationStore((state) => state.openArtist);
  const { haptic, setupBackButton } = useTelegram();

  useEffect(() => {
    const cleanup = setupBackButton(true, onBack);
    return cleanup;
  }, [setupBackButton, onBack]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await api.getMyStats();
      setStats(data);
    } catch (e) {
      console.error('Failed to load stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handlePlayTop5 = () => {
    if (!stats || !stats.top_tracks || stats.top_tracks.length === 0) return;
    haptic.impact('medium');
    const tracksToPlay = stats.top_tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artist_name: t.artist_name,
      cover_url: t.cover_url,
      duration: t.duration,
    }));
    setQueue(tracksToPlay, 0);
  };

  const handleShare = () => {
    if (!stats) return;
    haptic.impact('light');

    const topTracksList = (stats.top_tracks || [])
      .map((t, i) => `${i + 1}. ${t.artist_name} — ${t.title} (${t.play_count}x)`)
      .join('\n');

    const topArtistsList = (stats.top_artists || [])
      .map((a, i) => `${i + 1}. ${a.artist_name} (${a.play_count}x)`)
      .join('\n');

    const shareText = `📊 Моя статистика в Spoty:\n\n⏱️ Время: ${stats.total_hours} ч (${stats.total_plays} прослушиваний)\n⚡ Вайб: ${stats.listener_vibe}\n\n🔥 ТОП-5 ТРЕКОВ:\n${topTracksList}\n\n🎤 ТОП-5 АРТИСТОВ:\n${topArtistsList}\n\nСлушай в Spoty!`;

    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent(shareText)}`);
      return;
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6 pb-36 animate-fade-in select-none max-w-3xl mx-auto">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!stats || stats.total_plays === 0) {
    return (
      <div className="p-8 text-center text-zinc-400 select-none pb-36 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 text-[#1DB954]">
          <BarChart3 size={32} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Статистика пока пуста</h2>
        <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
          Включайте любимые треки в Spoty, и здесь появится ваш персональный Топ-5 песен, любимые артисты и время прослушивания!
        </p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-full bg-[#1DB954] text-black text-xs font-bold hover:scale-105 active:scale-95 transition"
        >
          Перейти к музыке
        </button>
      </div>
    );
  }

  return (
    <div className="pb-36 select-none animate-fade-in max-w-3xl mx-auto px-4 pt-4 space-y-6">
      {/* ── Hero Banner (Spotify Wrapped Style) ── */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-[#1DB954]/25 via-emerald-950/40 to-black border border-[#1DB954]/30 shadow-2xl">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1DB954]/20 border border-[#1DB954]/40 text-[#1DB954] text-[11px] font-extrabold uppercase tracking-wider mb-2">
              <Sparkles size={13} />
              <span>SPOTY STATS & WRAPPED</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Ваша статистика прослушиваний
            </h1>
            <p className="text-xs sm:text-sm text-zinc-300 mt-1">
              Персональный отчет: любимая музыка и топовые артисты
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black hover:bg-zinc-200 active:scale-95 transition text-xs font-bold shadow-lg"
              title="Поделиться статистикой"
            >
              {copied ? <Check size={15} className="text-[#1DB954]" /> : <Share2 size={15} />}
              <span>{copied ? 'Скопировано!' : 'Поделиться'}</span>
            </button>

            <button
              onClick={loadStats}
              className="p-2 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 text-zinc-300 hover:text-white transition"
              title="Обновить данные"
            >
              <RotateCw size={16} />
            </button>
          </div>
        </div>

        {/* Listener Persona Badge */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <div>
              <div className="text-[10px] text-zinc-400 uppercase font-bold">Ваш статус слушателя</div>
              <div className="text-sm font-extrabold text-white text-[#1DB954]">
                {stats.listener_vibe}
              </div>
            </div>
          </div>

          {stats.top_tracks.length > 0 && (
            <button
              onClick={handlePlayTop5}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1DB954] text-black text-xs font-bold hover:bg-[#1ed760] active:scale-95 transition shadow-md"
            >
              <Play size={14} className="fill-black" />
              <span>Включить весь Топ-5</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Key Metrics Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#1c1c1c] border border-white/5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-semibold">
            <Clock size={15} className="text-[#1DB954]" />
            <span>Время</span>
          </div>
          <div className="text-2xl font-black text-white">
            {stats.total_hours >= 1 ? `${stats.total_hours} ч` : `${stats.total_minutes} мин`}
          </div>
          <div className="text-[10px] text-zinc-500">музыки прослушано</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#1c1c1c] border border-white/5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-semibold">
            <Headphones size={15} className="text-purple-400" />
            <span>Треки</span>
          </div>
          <div className="text-2xl font-black text-white">{stats.total_plays}</div>
          <div className="text-[10px] text-zinc-500">всего прослушиваний</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#1c1c1c] border border-white/5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-semibold">
            <Music2 size={15} className="text-sky-400" />
            <span>Уникальных</span>
          </div>
          <div className="text-2xl font-black text-white">{stats.unique_tracks}</div>
          <div className="text-[10px] text-zinc-500">разных композиций</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#1c1c1c] border border-white/5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-semibold">
            <Flame size={15} className="text-amber-400" />
            <span>Артистов</span>
          </div>
          <div className="text-2xl font-black text-white">{stats.unique_artists}</div>
          <div className="text-[10px] text-zinc-500">в вашей медиатеке</div>
        </div>
      </div>

      {/* ── ТОП-5 ТРЕКОВ (TOP 5 TRACKS) ── */}
      <div className="p-5 rounded-3xl bg-[#191919] border border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1DB954]/20 flex items-center justify-center text-[#1DB954]">
              <Trophy size={16} />
            </div>
            <h2 className="text-lg font-black text-white tracking-tight">
              ТОП-5 ТРЕКОВ
            </h2>
          </div>
          <span className="text-xs text-zinc-400">Чаще всего на повторе</span>
        </div>

        <div className="space-y-2">
          {stats.top_tracks.map((track, idx) => (
            <div
              key={track.id}
              onClick={() => {
                haptic.impact('light');
                playTrack({
                  id: track.id,
                  title: track.title,
                  artist_name: track.artist_name,
                  cover_url: track.cover_url,
                  duration: track.duration,
                });
              }}
              className="group relative flex items-center justify-between p-3 rounded-2xl hover:bg-white/10 active:bg-white/15 transition cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                {/* Rank Number */}
                <div
                  className={`w-6 text-center font-black text-base sm:text-lg flex-shrink-0 ${
                    idx === 0
                      ? 'text-[#1DB954]'
                      : idx === 1
                      ? 'text-emerald-400'
                      : idx === 2
                      ? 'text-zinc-300'
                      : 'text-zinc-500'
                  }`}
                >
                  #{track.rank}
                </div>

                {/* Track Artwork */}
                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#242424] flex-shrink-0 shadow-md">
                  {track.cover_url ? (
                    <img
                      src={track.cover_url}
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600">
                      <Disc size={20} />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play size={18} className="fill-white text-white translate-x-0.5" />
                  </div>
                </div>

                {/* Title & Artist */}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white truncate group-hover:text-[#1DB954] transition-colors">
                    {track.title}
                  </div>
                  <div className="text-xs text-zinc-400 truncate">
                    {track.artist_name}
                  </div>
                </div>
              </div>

              {/* Play count badge */}
              <div className="flex-shrink-0 pl-3">
                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-white/5 group-hover:bg-[#1DB954]/20 group-hover:text-[#1DB954] text-zinc-300 transition">
                  {track.play_count} {track.play_count === 1 ? 'воспроизведение' : 'прослушиваний'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── ТОП-5 АРТИСТОВ (TOP 5 ARTISTS) ── */}
      <div className="p-5 rounded-3xl bg-[#191919] border border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
              <Flame size={16} />
            </div>
            <h2 className="text-lg font-black text-white tracking-tight">
              ТОП-5 ИСПОЛНИТЕЛЕЙ
            </h2>
          </div>
          <span className="text-xs text-zinc-400">Любимые музыканты</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {stats.top_artists.map((artist, idx) => (
            <div
              key={artist.artist_name}
              onClick={() => {
                haptic.selection();
                openArtist(undefined, artist.artist_name);
              }}
              className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/15 transition cursor-pointer gap-3"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span
                  className={`w-5 text-center font-black text-sm ${
                    idx === 0 ? 'text-[#1DB954]' : 'text-zinc-400'
                  }`}
                >
                  #{artist.rank}
                </span>

                <div className="w-11 h-11 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center flex-shrink-0 border border-white/10">
                  {artist.picture_url ? (
                    <img
                      src={artist.picture_url}
                      alt={artist.artist_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Music2 size={18} className="text-zinc-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white truncate hover:text-[#1DB954] transition">
                    {artist.artist_name}
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {artist.unique_songs} {artist.unique_songs === 1 ? 'трек' : 'треков'} в ротации
                  </div>
                </div>
              </div>

              <div className="text-xs font-bold text-zinc-400 flex-shrink-0">
                {artist.play_count} раз
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
