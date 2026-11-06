import { useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { api } from '../api/client';
import { isNativeClient } from './nativeBridge';

const prepared = new Map<string, number>();
/** Desktop app only: warm the shared server early, instead of waiting for the final25s. */
export function DesktopWarmup() {
  const queue = usePlayerStore(s => s.queue), index = usePlayerStore(s => s.queueIndex);
  const playing = usePlayerStore(s => s.isPlaying), repeat = usePlayerStore(s => s.repeatMode);
  useEffect(() => {
    if (!isNativeClient() || !playing || repeat === 'one') return;
    for (const track of queue.slice(index + 1, index + 3)) {
      const key = `${track.id}:${track.duration}`;
      if (Date.now() - (prepared.get(key) || 0) < 60000) continue;
      prepared.set(key, Date.now());
      if (prepared.size > 100) prepared.delete(prepared.keys().next().value!);
      void api.preloadTrack(track.id, `${track.artist_name} - ${track.title}`, track.duration);
    }
  }, [queue, index, playing, repeat]);
  return null;
}
