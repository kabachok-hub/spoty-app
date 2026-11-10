import { api, apiClient } from '../api/client';
import type { Track } from '../api/types';
import type { ActiveMixContext } from '../store/playerStore';

type Mix = { id: string; title: string; title_en?: string; query?: string; type?: string };
export function orderedMixes(feed: Mix[], context: ActiveMixContext | null): Mix[] {
  const visited = new Set([...(context?.visitedMixIds || []), ...(context ? [context.id] : [])]);
  const index = feed.findIndex(m => m.id === context?.id);
  const ordered = index < 0 ? feed : [...feed.slice(index + 1), ...feed.slice(0, index)];
  const seen = new Set<string>();
  return [context?.nextMix, ...ordered].filter((m): m is Mix => !!m?.query && !visited.has(m.id) && !seen.has(m.id) && !!seen.add(m.id));
}
export async function planContinuation(track: Track, queue: Track[], context: ActiveMixContext | null): Promise<Track[]> {
  const ids = new Set(queue.map(t => t.id));
  const fresh = (rows: Track[]) => rows.filter(t => !ids.has(t.id) && Number(t.duration) >= 45);
  const visited = new Set([...(context?.visitedMixIds || []), ...(context ? [context.id] : [])]);
  // A radio tail continues radio instead of cycling back through the home mixes.
  if (!context?.id.startsWith('autoplay-radio-')) {
    let home: any = {};
    try { home = (await apiClient.get('/recommendations/home')).data || {}; } catch { /* explicit next still works */ }
    const candidates = orderedMixes([...(home.daily_mixes || []), ...(home.best_mixes || []), ...(home.recommended_stations || [])], context);
    const tried = new Set<string>();
    for (const mix of candidates) {
      if (tried.has(mix.id)) continue;
      tried.add(mix.id);
      if (tried.size > 3) break; // Bound cold provider requests; a mix never silently becomes radio.
      visited.add(mix.id);
      try {
        const rows = fresh(await api.getMixTracks(mix.query!, 50, false, mix.id));
        if (rows.length) {
          const next = candidates.find(m => m.id !== mix.id && !visited.has(m.id));
          const origin: ActiveMixContext = { ...mix, query: mix.query!, type: mix.type || 'mix', visitedMixIds: [...visited], nextMix: next || null };
          return rows.map(t => ({ ...t, recommended_automatically: true, playback_context: origin }));
        }
      } catch { /* Try another real context, never a search for a fabricated mix name. */ }
    }
    if (context) return [];
  }
  // Exclude the whole recent queue before the backend limits/ranks the candidate pool.
  const rows = fresh(await api.getSimilarTracks(track.id, track.artist_name, track.title, 40, [...ids].slice(-300)));
  const origin: ActiveMixContext = { id: `autoplay-radio-${track.artist_id || track.artist_name}`, title: `${track.artist_name}: радио`, query: track.artist_name, type: 'radio', visitedMixIds: [...visited] };
  return rows.map(t => ({ ...t, recommended_automatically: true, playback_context: origin }));
}
