import { useEffect } from 'react';
import type { Track } from '../api/types';
import { api } from '../api/client';
import { useNavigationStore } from '../store/navigationStore';
import { usePlayerStore } from '../store/playerStore';
import { isNativeClient, isHostHidden } from './nativeBridge';

const prepared = new Map<string, number>();
let budget = { started: 0, count: 0 };
export function warmVisibleTracks(tracks: Track[]) {
  const connection = (navigator as any).connection;
  if (!isNativeClient() || isHostHidden() || document.visibilityState !== 'visible' || navigator.onLine === false
    || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return;
  const now = Date.now();
  if (now - budget.started >= 60000) budget = { started: now, count: 0 };
  // Only two suggestions per settled view, four preparations per minute overall.
  for (const track of tracks.slice(0, 2)) {
    if (budget.count >= 4 || !track?.id || track.id === usePlayerStore.getState().currentTrack?.id) continue;
    const key = `${track.id}:${track.duration}`;
    if (now - (prepared.get(key) || 0) < 10 * 60000) continue;
    prepared.set(key, now); budget.count++;
    if (prepared.size > 100) prepared.delete(prepared.keys().next().value!);
    void api.preloadTrack(track.id, `${track.artist_name} - ${track.title}`, track.duration);
  }
}
/** Native clients only: begin preparing likely first selections while the user browses. */
export function useBrowseWarmup(tracks: Track[], tab: 'home' | 'search', enabled = true) {
  const view = useNavigationStore(s => s.currentView);
  useEffect(() => {
    if (!enabled || view.type !== 'tab' || view.tab !== tab || !tracks.length || !isNativeClient()) return;
    const timer = setTimeout(() => warmVisibleTracks(tracks), 1200);
    return () => clearTimeout(timer);
  }, [tracks, view, tab, enabled]);
}
