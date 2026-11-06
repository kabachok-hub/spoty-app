import { useEffect } from 'react';
import { ensureAutoplay, usePlayerStore } from '../store/playerStore';

// Fetch metadata early; the existing Telegram current + two Blob buffer stays unchanged.
export function useRadioMode() {
  const track = usePlayerStore(s => s.currentTrack);
  const queue = usePlayerStore(s => s.queue);
  const shuffle = usePlayerStore(s => s.isShuffle);
  const played = usePlayerStore(s => s.playedTrackIds);
  const index = usePlayerStore(s => s.queueIndex);
  const repeat = usePlayerStore(s => s.repeatMode);
  const playing = usePlayerStore(s => s.isPlaying);
  useEffect(() => {
    const remaining = shuffle ? queue.filter(t => !played.includes(t.id) && t.id !== track?.id).length : queue.length - index - 1;
    if (track && playing && repeat === 'off' && remaining <= 8) void ensureAutoplay();
  }, [track?.id, queue, index, repeat, playing, shuffle, played]);
}
