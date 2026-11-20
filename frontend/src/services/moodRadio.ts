import { apiClient } from '../api/client';
import { artistKey, isHiddenTrack, trackSignature } from '../store/recommendationPreferences';
import type { Artist, Track } from '../api/types';

export const MOOD_STATIONS = [
  { id: 'night', title: 'Ночная', idea: 'Для поздней дороги', query: 'night drive', extra: 'dark synthwave chill phonk', genres: ['synthwave', 'chillwave', 'phonk', 'trip hop', 'ambient'] },
  { id: 'hype', title: 'Хайп', idea: 'Больше напора', query: 'hype trap', extra: 'drill trap bass', genres: ['trap', 'drill', 'phonk', 'hardcore hip hop', 'rage rap'] },
  { id: 'sad', title: 'Меланхолия', idea: 'Когда хочется погрустить', query: 'sad songs', extra: 'emo rap sad indie', genres: ['emo rap', 'sad rap', 'slowcore', 'dream pop', 'darkwave'] },
  { id: 'party', title: 'Вечеринка', idea: 'Чтобы двигаться', query: 'party hits', extra: 'dance house club', genres: ['dance', 'house', 'dance pop', 'disco', 'edm'] },
  { id: 'focus', title: 'Фокус', idea: 'Спокойный ритм', query: 'deep focus', extra: 'lofi instrumental downtempo', genres: ['lofi', 'ambient', 'instrumental', 'downtempo', 'chillout'] },
  { id: 'romance', title: 'Романтика', idea: 'Мягче и теплее', query: 'love songs', extra: 'smooth rnb slow jams', genres: ['rnb', 'soul', 'neo soul', 'quiet storm', 'sophisti pop'] },
] as const;

export type Mood = typeof MOOD_STATIONS[number];
type RelatedArtist = Artist & { similarity_score?: number; relation_sources?: string[] };

const genre = (name: string) => name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const names = (track: Track) =>
  [track.artist_name, ...(track.artists || []).map(artist => artist.name)].map(artistKey).filter(Boolean);
const catalogId = (id?: string) => Boolean(id && /^\d+$/.test(id));
const labels = (track: Track) => Array.isArray(track.genres) ? track.genres.map(genre) : [];

function musicPool(tracks: Track[]) {
  const seen = new Set<string>();
  return tracks.filter(track => {
    const key = trackSignature(track);
    if (!track.id || !track.title || !track.artist_name || isHiddenTrack(track) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function diversify(tracks: Track[], limit: number) {
  const pool = [...tracks];
  const result: Track[] = [];
  while (result.length < limit && pool.length) {
    const last = new Set(result.slice(-2).flatMap(names));
    const index = pool.findIndex(track => !names(track).some(name => last.has(name)));
    result.push(pool.splice(Math.max(index, 0), 1)[0]);
  }
  return result;
}

function pickSeeds(followed: Artist[], favorites: Track[], history: Track[]) {
  const scores = new Map<string, { name: string; score: number }>();
  for (const artist of followed) if (catalogId(artist.id)) scores.set(artist.id, { name: artist.name, score: 3 });
  for (const [tracks, weight] of [[favorites.slice(0, 100), 4], [history.slice(0, 60), 1]] as const) {
    for (const track of musicPool(tracks)) {
      const id = track.artist_id || followed.find(artist => artistKey(artist.name) === artistKey(track.artist_name))?.id;
      if (!id || !catalogId(id)) continue;
      const previous = scores.get(id);
      scores.set(id, { name: track.artist_name, score: (previous?.score || 0) + weight });
    }
  }
  return [...scores].sort((a, b) => b[1].score - a[1].score).slice(0, 4).map(([id, artist]) => ({ id, name: artist.name }));
}

export function rankMoodTracks(mood: Mood, candidates: Track[], moodMatches: Track[], ownArtists: Artist[],
  favorites: Track[], history: Track[], related: RelatedArtist[] = []) {
  const exact = new Set(musicPool([...favorites, ...history]).map(trackSignature));
  const ownIds = new Set(ownArtists.map(artist => artist.id));
  const ownNames = new Set([...ownArtists.map(artist => artistKey(artist.name)), ...[...favorites, ...history].flatMap(names)]);
  const relatedIds = new Set(related.map(artist => artist.id));
  const relatedNames = new Set(related.map(artist => artistKey(artist.name)));
  const liked = new Set(favorites.map(trackSignature));
  const heardRecently = new Set(history.slice(0, 15).map(trackSignature));
  const matched = new Set(moodMatches.map(trackSignature));
  const tags = new Set(mood.genres.map(genre));

  // A genre tag alone is not taste evidence, and a similar artist alone is not mood evidence.
  const matching = musicPool([...moodMatches, ...candidates]).flatMap((track, index) => {
    const key = trackSignature(track);
    const trackNames = names(track);
    const own = exact.has(key) || ownIds.has(track.artist_id || '') || trackNames.some(name => ownNames.has(name));
    const similar = relatedIds.has(track.artist_id || '') || trackNames.some(name => relatedNames.has(name));
    const tagged = labels(track).some(tag => tags.has(tag));
    if ((!own && !similar) || (!matched.has(key) && !tagged)) return [];
    return [{ track, score: (own ? 18 : 0) + (tagged ? 8 : 0) + (liked.has(key) ? 7 : 0)
      - (heardRecently.has(key) ? 4 : 0) - index * 0.04 }];
  }).sort((a, b) => b.score - a.score).map(row => row.track);
  return diversify(matching, 40);
}

export async function loadMoodTracks(mood: Mood, followed: Artist[], favorites: Track[], signedIn: boolean) {
  const read = async <T,>(path: string, params?: object): Promise<T | undefined> => {
    const response = await apiClient.get<T>(path, { params, timeout: 6500 }).catch(() => undefined);
    return response?.data;
  };
  const queries = Promise.all([mood.query, mood.extra].map(q =>
    read<{ tracks: Track[] }>('/search', { q, type: 'track', limit: 25 })));
  const history = signedIn ? await read<Track[]>('/me/history') || [] : [];
  const seeds = pickSeeds(followed, favorites, history);
  const [search, ownTracks, relatedRows] = await Promise.all([
    queries,
    Promise.all(seeds.map(artist => read<Track[]>(`/artists/${artist.id}/top-tracks`))),
    Promise.all(seeds.slice(0, 2).map(artist => read<RelatedArtist[]>(`/artists/${artist.id}/related`))),
  ]);
  const related = [...new Map(relatedRows.flatMap(rows =>
    (rows || []).filter(artist => catalogId(artist.id)
      && ((artist.similarity_score || 0) >= 0.55 || (artist.relation_sources?.length || 0) >= 2))
      .slice(0, 2).map(artist => [artist.id, artist] as const),
  )).values()].slice(0, 4);
  const nearbyTracks = await Promise.all(related.map(artist => read<Track[]>(`/artists/${artist.id}/top-tracks`)));
  const moodMatches = search.flatMap(result => result?.tracks || []);
  const candidates = [...favorites.slice(0, 120), ...history.slice(0, 100), ...ownTracks.flatMap(rows => rows || []),
    ...nearbyTracks.flatMap(rows => rows || [])];
  if (!followed.length && !favorites.length && !history.length) {
    return { tracks: [], status: 'empty-library' as const };
  }
  const tracks = rankMoodTracks(mood, candidates, moodMatches, followed, favorites, history, related);
  if (tracks.length) return { tracks, status: 'matched' as const };
  const familiar = diversify(musicPool([...favorites.slice(0, 60), ...history.slice(10, 70), ...history.slice(0, 10), ...ownTracks.flatMap(rows => rows || [])]), 14);
  return { tracks: familiar, status: 'missing-mood' as const };
}
