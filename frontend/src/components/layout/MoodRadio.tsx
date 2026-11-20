import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AudioLines, Loader2, Pause, Play } from 'lucide-react';
import { useTelegram } from '../../hooks/useTelegram';
import { MOOD_STATIONS, loadMoodTracks, type Mood } from '../../services/moodRadio';
import { usePlayerStore, type ActiveMixContext } from '../../store/playerStore';
import { useUserStore } from '../../store/userStore';

const contextFor = (mood: Mood) => ({ id: 'mood-radio-' + mood.id, title: mood.title, query: mood.query, type: 'mood_radio' });

export function MoodRadio({ actions }: { actions?: ReactNode }) {
  const active = usePlayerStore(state => state.activeMix?.id);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const owner = useUserStore(state => state.user?.telegram_id);
  const { haptic } = useTelegram();
  const [loading, setLoading] = useState<Mood['id']>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const run = useRef(0);
  useEffect(() => () => { run.current++; }, []);

  const play = async (mood: Mood) => {
    const context = contextFor(mood);
    const player = usePlayerStore.getState();
    haptic.impact('medium');
    if (player.activeMix?.id === context.id && player.currentTrack && !player.playbackError
      && (player.isPlaying || !player.duration || player.currentTime < player.duration - 0.25)) {
      player.togglePlay();
      return;
    }
    const request = ++run.current;
    setLoading(mood.id);
    setError('');
    setNotice('');
    const audio = document.getElementById('spotify-native-audio') as HTMLAudioElement | null;
    void audio?.play().catch(() => {});
    try {
      const preferences = useUserStore.getState();
      const { tracks, status } = await loadMoodTracks(mood, preferences.followedArtists, preferences.favorites,
        Boolean(owner && owner !== 999999999));
      if (request !== run.current || useUserStore.getState().user?.telegram_id !== owner) return;
      if (!tracks.length) {
        setError(status === 'empty-library'
          ? 'Подпишись на артистов или отметь любимые треки, чтобы собрать своё радио.'
          : 'В твоей медиатеке пока мало треков для этого настроения.');
        return;
      }
      if (status === 'missing-mood') setNotice('У каталога мало данных об этом настроении. Играет музыка от знакомых тебе артистов.');
      const playback: ActiveMixContext = { ...context, ownerId: owner, nextMix: null };
      player.playTrack(tracks[0], tracks, context.id, playback);
    } catch {
      if (request === run.current) setError('Не удалось включить радио. Попробуй ещё раз.');
    } finally {
      if (request === run.current) setLoading(undefined);
    }
  };

  return <section className="spoty-mood-radio" aria-label="Радио по настроению">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-base font-bold sm:text-lg"><AudioLines size={20} className="text-emerald-300" />Радио по настроению</h2>
      {actions}
    </div>
    <div className="spoty-mood-grid">
      {MOOD_STATIONS.map(mood => {
        const playing = isPlaying && active === contextFor(mood).id;
        return <button key={mood.id} type="button" className="spoty-mood-card" onClick={() => void play(mood)}
          data-mood={mood.id} disabled={Boolean(loading)} aria-pressed={playing} aria-busy={loading === mood.id}>
          <span className="spoty-mood-copy">
            <strong>{mood.title}</strong>
            <small>{loading === mood.id ? 'Подбираем треки…' : mood.idea}</small>
          </span>
          <span className="spoty-mood-action" aria-hidden="true">
            {loading === mood.id ? <Loader2 size={16} className="animate-spin" /> : playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          </span>
        </button>;
      })}
    </div>
    {notice && <p className="mt-2 text-sm text-zinc-300" role="status">{notice}</p>}
    {error && <p className="mt-2 text-sm text-rose-300" role="alert">{error}</p>}
  </section>;
}
