import { api } from '../api/client';
import type { Album, Artist, Track } from '../api/types';

type Reference = { name: string; artist: string; album: string; id: string };
type Collection = { name: string; key: string; description: string; tracks: Reference[] };
export type SpotifyLibrary = { artists: Reference[]; tracks: Reference[]; albums: Reference[]; playlists: Collection[] };
type Row = Record<string, unknown>;

const row = (value: unknown): Row => value && typeof value === 'object' ? value as Row : {};
const items = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const string = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const normalized = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const same = (a: string, b: string) => normalized(a) === normalized(b);
const uri = (value: unknown, type: string) => {
  const match = /^(?:spotify:(artist|track|album|playlist):|https:\/\/open\.spotify\.com\/(artist|track|album|playlist)\/)([A-Za-z0-9]{22})(?:\?.*)?$/.exec(string(value));
  return match && (match[1] || match[2]) === type ? match[3] : '';
};

function reference(value: unknown, type: 'artist' | 'track' | 'album'): Reference | undefined {
  const data = row(value);
  const name = string(data.name) || string(data[type]) || string(data.trackName) || string(data.albumName)
    || (type === 'artist' ? string(value) : '');
  const artist = string(data.artist) || string(data.artistName) || string(row(items(data.artists)[0]).name);
  const id = uri(data.uri || data.trackUri || data.albumUri || data.artistUri || value, type);
  if (!name && !id) return;
  return { name, artist, album: string(data.album) || string(data.albumName), id };
}

export function parseSpotifyLibrary(files: unknown[]): SpotifyLibrary {
  const library: SpotifyLibrary = { artists: [], tracks: [], albums: [], playlists: [] };
  const collectionKeys = new Map<string, number>();
  for (const file of files) {
    const data = row(file);
    for (const [field, type] of [['artists', 'artist'], ['tracks', 'track'], ['albums', 'album']] as const) {
      for (const value of items(data[field])) {
        const entry = reference(value, type);
        if (entry) library[field].push(entry);
      }
    }
    for (const playlist of items(data.playlists)) {
      const entry = row(playlist);
      const name = string(entry.name);
      if (!name) continue;
      const sourceId = uri(entry.uri || entry.playlistUri, 'playlist');
      const count = (collectionKeys.get(name) || 0) + 1;
      collectionKeys.set(name, count);
      const tracks = items(entry.items).flatMap(item => {
        const track = reference(row(item).track, 'track');
        return track ? [track] : [];
      });
      library.playlists.push({ name, key: sourceId || `${name}#${count}`, description: string(entry.description), tracks });
    }
  }
  return library;
}

const identity = (entry: Reference) => entry.id || [entry.name, entry.artist, entry.album].map(normalized).join('|');
const unique = (entries: Reference[]) => [...new Map(entries.map(entry => [identity(entry), entry])).values()];

function singleMatch<T extends { id: string }>(results: T[]) {
  return new Set(results.map(result => result.id)).size === 1 ? results[0] : undefined;
}

async function findArtist(entry: Reference): Promise<Artist | undefined> {
  if (!entry.name) return;
  const { artists } = await api.search(entry.name, 'artist', 20);
  const matches = artists.filter(artist => /^\d+$/.test(artist.id) && same(artist.name, entry.name));
  return singleMatch(matches);
}

async function findTrack(entry: Reference): Promise<Track | undefined> {
  if (entry.name && entry.artist) {
    const { tracks } = await api.search(`${entry.artist} ${entry.name}`, 'track', 20);
    const matches = tracks.filter(track => same(track.title, entry.name)
      && (same(track.artist_name, entry.artist) || track.artists?.some(artist => same(artist.name, entry.artist))));
    const albumMatches = entry.album ? matches.filter(track => same(track.album_title || '', entry.album)) : [];
    const match = singleMatch(albumMatches.length ? albumMatches : matches);
    if (match) return match;
  }
  if (entry.id) return api.getTrack('sp_' + entry.id).catch(() => undefined);
}

async function findAlbum(entry: Reference): Promise<Album | undefined> {
  if (!entry.name || !entry.artist) return;
  const { albums } = await api.search(`${entry.artist} ${entry.name}`, 'album', 20);
  return singleMatch(albums.filter(album => same(album.title, entry.name) && same(album.artist_name, entry.artist)));
}

async function importMarker(key: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return 'Импорт Spotify · ' + Array.from(new Uint8Array(digest).slice(0, 8), byte => byte.toString(16).padStart(2, '0')).join('');
}

let importRunning = false;

export async function importSpotifyLibrary(library: SpotifyLibrary, owner: number,
  currentOwner: () => number | undefined, onProgress: (message: string) => void) {
  if (importRunning) throw new Error('Импорт уже выполняется.');
  importRunning = true;
  try {
    return await copyLibrary(library, owner, currentOwner, onProgress);
  } finally {
    importRunning = false;
  }
}

async function copyLibrary(library: SpotifyLibrary, owner: number,
  currentOwner: () => number | undefined, onProgress: (message: string) => void) {
  const [followed, favorites, playlists] = await Promise.all([
    api.getMyFollowing(), api.getMyFavoriteIds(), api.getMyPlaylists(),
  ]);
  const followingIds = new Set(followed.map(artist => artist.id));
  const favoriteIds = new Set(favorites);
  const failures: string[] = [];
  const result = { artists: 0, tracks: 0, playlists: 0, albums: 0, failures };
  const trackCache = new Map<string, Track | undefined>();
  const checkAccount = () => {
    if (currentOwner() !== owner) throw new Error('Аккаунт Spoty сменился. Импорт остановлен.');
  };
  const attempt = async (label: string, action: () => Promise<void>) => {
    checkAccount();
    onProgress(label);
    try { await action(); } catch { failures.push(label); }
    checkAccount();
  };
  const resolveTrack = async (entry: Reference) => {
    const key = identity(entry);
    if (!trackCache.has(key)) trackCache.set(key, await findTrack(entry));
    return trackCache.get(key);
  };
  const saveCollection = async (name: string, key: string, description: string, tracks: Track[]) => {
    checkAccount();
    const marker = await importMarker(key);
    checkAccount();
    let playlist = playlists.find(item => item.description?.split('\n', 1)[0] === marker && item.is_owner !== false);
    if (!playlist) {
      playlist = await api.createPlaylist(name.slice(0, 200), `${marker}\n${description}`.trim().slice(0, 500), false);
      playlists.push({ ...playlist, description: marker });
    }
    for (let offset = 0; offset < tracks.length; offset += 100) {
      checkAccount();
      await api.addBatchTracksToPlaylist(playlist.id, tracks.slice(offset, offset + 100));
    }
  };

  for (const entry of unique(library.artists)) await attempt(entry.name || entry.id, async () => {
    const artist = await findArtist(entry);
    if (!artist) throw new Error('Artist unavailable or ambiguous');
    checkAccount();
    if (!followingIds.has(artist.id)) {
      await api.followArtist(artist.id);
      followingIds.add(artist.id);
    }
    result.artists++;
  });
  for (const entry of unique(library.tracks)) await attempt(entry.name || entry.id, async () => {
    const track = await resolveTrack(entry);
    if (!track) throw new Error('Track unavailable');
    checkAccount();
    if (!favoriteIds.has(track.id)) {
      await api.addFavorite(track);
      favoriteIds.add(track.id);
    }
    result.tracks++;
  });
  for (const entry of library.playlists) await attempt(entry.name, async () => {
    const tracks: Track[] = [];
    for (const reference of entry.tracks) await attempt(`${entry.name} · ${reference.name || reference.id}`, async () => {
      const track = await resolveTrack(reference);
      if (!track) throw new Error('Track unavailable');
      tracks.push(track);
    });
    if (entry.tracks.length && !tracks.length) throw new Error('No matched tracks');
    await saveCollection(entry.name, 'playlist:' + entry.key, entry.description, tracks);
    result.playlists++;
  });
  for (const entry of unique(library.albums)) await attempt(entry.name || entry.id, async () => {
    const album = await findAlbum(entry);
    if (!album) throw new Error('Album unavailable or ambiguous');
    const details = await api.getAlbum(album.id);
    if (!details.tracks?.length) throw new Error('Album has no tracks');
    await saveCollection(album.title, 'album:' + identity(entry), album.artist_name, details.tracks);
    result.albums++;
  });
  return result;
}
