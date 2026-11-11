import React, { useEffect } from 'react';
import { create } from 'zustand';
import { apiClient } from '../../api/client';
import { usePlayerStore } from '../../store/playerStore';
import type { Track } from '../../api/types';
import { useNavigationStore } from '../../store/navigationStore';

type Credits = NonNullable<Track['artists']>;
const useCredits = create<{ rows: Map<string, { artists: Credits; until: number }> }>(() => ({ rows: new Map() }));
const pending = new Map<string, Promise<void>>();
async function load(id: string): Promise<void> {
  if ((useCredits.getState().rows.get(id)?.until || 0) > Date.now()) return;
  if (pending.has(id)) return pending.get(id);
  if (pending.size >= 4) return;
  const task = (async () => {
    let artists: Credits = [];
    try {
      const { data } = await apiClient.get<Track>(`/search/tracks/${encodeURIComponent(id)}`, { timeout: 6000 });
      if (String(data.id) === id && Array.isArray(data.artists)) artists = data.artists.filter(a => a && typeof a.name === 'string' && typeof a.id === 'string').slice(0, 20);
    } catch { /* Public credits are optional; retain known artist names on failure. */ }
    const rows = new Map(useCredits.getState().rows);
    rows.delete(id);rows.set(id, { artists, until: Date.now() + (artists.length ? 3600000 : 60000) });
    while (rows.size > 128) rows.delete(rows.keys().next().value as string);
    useCredits.setState({ rows });
  })().finally(() => pending.delete(id));
  pending.set(id, task);return task;
}

/** Display-only enrichment: never replaces a playing track or its audio source. */
export function ArtistNames({ track }: { track: Pick<Track, 'id' | 'artist_name' | 'artists' | 'artist_id'> }) {
  const openArtist = useNavigationStore(s => s.openArtist);
  const current = usePlayerStore(s => s.currentTrack?.id);
  const cached = useCredits(s => s.rows.get(track.id));
  useEffect(() => {
    if (!track.id || current !== track.id) return;
    const timer = setTimeout(() => { void load(track.id); }, 500);
    return () => clearTimeout(timer);
  }, [track.id, current]);
  const credits = cached?.artists.length ? cached.artists : track.artists;
  const artists = credits?.length ? credits : [{ id: track.artist_id || '', name: track.artist_name }];
  const seen = new Set<string>();
  const unique = artists.filter(a => { if (!a.name || seen.has(a.name)) return false; seen.add(a.name); return true; });
  return <span data-testid="artist-credits" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>{unique.map((artist, index) => <React.Fragment key={artist.id || artist.name}>
    {index > 0 && <span className="text-inherit">, </span>}
    {artist.id ? <button type="button" data-artist-id={artist.id} title={artist.name}
      aria-label={`Открыть исполнителя ${artist.name}`}
      className="inline p-0 text-inherit text-left hover:underline hover:text-[var(--accent-color,#1DB954)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 rounded-sm"
      onPointerDown={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); openArtist(artist.id, artist.name); }}
    >{artist.name}</button> : <span>{artist.name}</span>}
  </React.Fragment>)}</span>;
}
