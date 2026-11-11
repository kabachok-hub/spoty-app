import { useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import { usePlayerStore } from '../store/playerStore';
import { useRecentShelf, mixKey } from '../store/recentShelf';
import { api } from '../api/client';

export function RecentActivityRuntime() {
  const id = useUserStore(s => s.user?.telegram_id);
  useEffect(() => {
    const owner = id && id !== 999999999 ? String(id) : '';
    useRecentShelf.getState().switchOwner(owner);
    let pending = false;
    const unsubscribe = usePlayerStore.subscribe((state, previous) => {
      const current = state.currentTrack?.playback_context;
      const before = previous.currentTrack?.playback_context;
      if (current && (current.id !== before?.id || (!previous.isPlaying && state.isPlaying))) {
        useRecentShelf.getState().selectMix(owner, { ...current, subtitle: '' });
      } else if (before && !current && useRecentShelf.getState().activeMixKey === mixKey(before)) {
        useRecentShelf.getState().finishMix(owner);
      }
      if (current && state.repeatMode === 'off' && !state.isPlaying && !state.playbackError
          && state.autoplayPending && !previous.autoplayPending
          && useRecentShelf.getState().activeMixKey === mixKey(current)) {
        useRecentShelf.getState().finishMix(owner);
      }
      if (state.playbackIntent !== previous.playbackIntent) pending = true;
      if (!pending || state.playToken === previous.playToken || !state.isPlaying) return;
      pending = false;
      const track = state.currentTrack;
      // Automatic mix transitions must not flood this shelf with every song in the mix.
      if (!owner || !track || track.playback_context) return;
      useRecentShelf.getState().addTrack(owner, track);
      void api.recordRecentContext({ context_type: 'track', context_id: 'track:'+track.id,
        title: track.title, subtitle: track.artist_name, cover_url: track.cover_url, query: String(track.duration || 0) });
    });
    const context = (event: Event) => {
      const row = (event as CustomEvent).detail;
      if (row?.context_type === 'track') return;
      useRecentShelf.getState().selectMix(owner, { ...row, id: row.context_id, type: row.context_type });
    };
    window.addEventListener('spoty:recent-context', context);
    return () => { unsubscribe(); window.removeEventListener('spoty:recent-context', context); };
  }, [id]);
  return null;
}
