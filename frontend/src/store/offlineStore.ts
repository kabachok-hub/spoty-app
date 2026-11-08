import { create } from 'zustand';
import type { Track } from '../api/types';
import { api } from '../api/client';
import { readAuthToken } from '../platform/authStorage';
import { isNativeAndroid, nativeCall } from '../platform/nativeBridge';

export type OfflineTrack = { track: Track; bytes: number; addedAt: number; lastPlayedAt: number };
type Row = OfflineTrack & { blob: Blob };
const allowedLimits = [128, 512, 1024, 2048];
let owner = '', db: IDBDatabase | null = null, generation = 0, controller: AbortController | null = null;
const sources = new Map<string, string>();
async function account() {
  try { const token = await readAuthToken(); if (token) { const value = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))); if (Number.isSafeInteger(value.tg_id)) return String(value.tg_id); } } catch {}
  return 'guest';
}
async function database() {
  const next = await account();
  if (db && owner === next) return db;
  db?.close(); owner = next;
  for (const url of sources.values()) URL.revokeObjectURL(url); sources.clear();
  db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(`spoty-offline-v1-${next}`, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('tracks', { keyPath: 'track.id' });
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  return db;
}
async function storage<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const current = await database();
  return new Promise((resolve, reject) => {
    const transaction = current.transaction('tracks', mode), request = action(transaction.objectStore('tracks'));
    transaction.oncomplete = () => resolve(request.result); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
  });
}
function cleanTrack(track: Track): Track {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(track.id)) throw Error('Некорректный трек');
  return { id: track.id, title: String(track.title).slice(0,300), artist_name: String(track.artist_name).slice(0,300),
    duration: Number.isFinite(track.duration) ? Math.max(0, Math.min(14400, track.duration)) : 0,
    cover_url: track.cover_url || '/icon.svg', ...(track.artist_id ? { artist_id: track.artist_id } : {}), ...(track.album_title ? { album_title: track.album_title } : {}) };
}
export async function offlineSource(id: string): Promise<string | undefined> {
  if (isNativeAndroid()) return undefined; // Native service resolves its private files itself.
  await database();
  const row = await storage<Row | undefined>('readonly', s => s.get(id));
  if (!row?.blob?.size) return;
  const url = sources.get(id) || URL.createObjectURL(row.blob); sources.set(id, url);
  void storage('readwrite', s => s.put({ ...row, lastPlayedAt: Date.now() })).catch(() => {});
  return url;
}
interface OfflineState {
  tracks: OfflineTrack[]; busy: boolean; done: number; total: number; progress: number; error: string | null; limitMB: number; ready: boolean;
  refresh: () => Promise<void>; download: (tracks: Track[]) => Promise<void>; cancel: () => void;
  remove: (id: string) => Promise<void>; setLimit: (mb: number) => Promise<void>; cleanOld: () => Promise<void>;
}
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export const useOfflineStore = create<OfflineState>((set, get) => ({
  tracks: [], busy: false, done: 0, total: 0, progress: 0, error: null, limitMB: 512, ready: false,
  async refresh() {
    try {
      if (isNativeAndroid()) { const data = await nativeCall('offlineList'); set({ tracks: data.tracks || [], limitMB: data.limitMB || 512, ready: true }); }
      else {
        const rows = await storage<Row[]>('readonly', s => s.getAll());
        const limit = Number(localStorage.getItem(`spoty_offline_limit_${owner}`));
        set({ tracks: rows.map(({ blob: _, ...meta }) => meta).sort((a,b) => b.addedAt - a.addedAt), limitMB: allowedLimits.includes(limit) ? limit : 512, ready: true });
      }
    } catch { set({ ready: true, error: 'Не удалось открыть офлайн-хранилище. Проверьте свободное место.' }); }
  },
  cancel() { generation++; controller?.abort(); controller = null; if (isNativeAndroid()) void nativeCall('offlineCancel').catch(() => {}); set({ busy: false }); },
  async download(tracks) {
    if (get().busy) return;
    const selected = [...new Map(tracks.slice(0,1000).map(t => [t.id, cleanTrack(t)])).values()];
    const run = ++generation, expectedOwner = await account();
    set({ busy: true, done: 0, total: selected.length, progress: 0, error: null });
    try {
      await get().refresh();
      for (const track of selected) {
        if (run !== generation || expectedOwner !== await account()) return;
        if (get().tracks.some(row => row.track.id === track.id)) { set({ done: get().done + 1 }); continue; }
        const url = api.getStreamUrl(track.id, `${track.artist_name} - ${track.title}`, track.duration);
        set({ progress: 0 });
        if (isNativeAndroid()) {
          await nativeCall('offlineStart', { track, url });
          while (run === generation) {
            const status = await nativeCall('offlineStatus'); set({ progress: status.progress || 0 });
            if (status.phase === 'ready') break;
            if (status.phase !== 'downloading') throw Error(status.message || 'Не удалось скачать трек');
            await pause(700);
          }
        } else {
          controller = new AbortController();
          const response = await fetch(url, { credentials: 'omit', signal: controller.signal });
          if (!response.ok || !response.body || !/^(audio\/|application\/octet-stream)/i.test(response.headers.get('content-type') || '')) throw Error('Источник записи недоступен');
          const length = Number(response.headers.get('content-length'));
          if (!Number.isSafeInteger(length) || length < 10000 || length > 32*1024*1024) throw Error('Недопустимый размер записи');
          const used = get().tracks.reduce((sum, row) => sum + row.bytes, 0);
          if (used + length > get().limitMB * 1024*1024) throw Error('Лимит офлайн-хранилища исчерпан. Удалите песни или увеличьте лимит.');
          const chunks: BlobPart[] = []; let received = 0; const reader = response.body.getReader();
          try { while (true) {
            const chunk = await reader.read(); if (chunk.done) break;
            received += chunk.value.byteLength; if (received > length || run !== generation) throw Error('Скачивание отменено');
            chunks.push(chunk.value); set({ progress: Math.round(received / length * 100) });
          } } finally { reader.releaseLock(); }
          if (received !== length || run !== generation || expectedOwner !== await account()) throw Error('Скачивание прервано');
          const row: Row = { track, bytes: received, addedAt: Date.now(), lastPlayedAt: Date.now(), blob: new Blob(chunks, { type: response.headers.get('content-type') || 'audio/mpeg' }) };
          await storage('readwrite', s => s.put(row));
        }
        if (run !== generation) return;
        set({ done: get().done + 1 }); await get().refresh();
      }
    } catch (error) { if (run === generation) set({ error: error instanceof Error ? error.message : 'Не удалось скачать песни' }); }
    finally { if (run === generation) { controller = null; set({ busy: false }); } }
  },
  async remove(id) {
    if (isNativeAndroid()) await nativeCall('offlineRemove', { id }); else await storage('readwrite', s => s.delete(id));
    const url = sources.get(id); if (url) { URL.revokeObjectURL(url); sources.delete(id); }
    await get().refresh();
  },
  async setLimit(mb) {
    if (!allowedLimits.includes(mb)) return;
    if (get().tracks.reduce((sum,row) => sum + row.bytes, 0) > mb*1024*1024) { set({ error: 'Сначала освободите место в офлайн-разделе.' }); return; }
    if (isNativeAndroid()) await nativeCall('offlineLimit', { mb });
    else { await database(); localStorage.setItem(`spoty_offline_limit_${owner}`, String(mb)); }
    set({ limitMB: mb, error: null });
  },
  async cleanOld() {
    const { usePlayerStore } = await import('./playerStore'); const active = usePlayerStore.getState().currentTrack?.id;
    for (const row of get().tracks.filter(row => row.track.id !== active && row.lastPlayedAt < Date.now() - 30*86400000)) await get().remove(row.track.id);
  },
}));
if (typeof window !== 'undefined') {
  const changed = () => { useOfflineStore.getState().cancel(); useOfflineStore.setState({ tracks: [], ready: false }); db?.close(); db = null; void useOfflineStore.getState().refresh(); };
  window.addEventListener('spoty-account-changed', changed); window.addEventListener('spoty-offline-account-changed', changed);
}
