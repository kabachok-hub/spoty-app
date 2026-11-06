import type { Track } from '../api/types';

export const trackSignature = (track: Pick<Track, 'artist_name' | 'title'>): string => {
  const normalize = (value: string) => (value || '').normalize('NFKC').toLowerCase().replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return normalize(track.artist_name) + '|' + normalize(track.title);
};

let hiddenIds = new Set<string>();
let hiddenKeys = new Set<string>();
export function syncHiddenTracks(tracks: Track[]) {
  hiddenIds = new Set(tracks.map(t => t.id));
  hiddenKeys = new Set(tracks.map(trackSignature));
}
export const isHiddenTrack = (track: Track): boolean => hiddenIds.has(track.id) || hiddenKeys.has(trackSignature(track));
export const isAutomaticMix = (mix?: { type?: string } | null): boolean => Boolean(mix && !['album', 'playlist', 'liked_songs'].includes(mix.type || 'mix'));
