import { create } from 'zustand';

export type CanvasClip = { key: string; owner: string; trackId: string; blob: Blob; duration: number; updatedAt: number };
const MAX_FILE = 8 * 1024 * 1024, MAX_TOTAL = 48 * 1024 * 1024;
let database: Promise<IDBDatabase> | undefined;
const db = () => database ||= new Promise((resolve, reject) => {
  const request = indexedDB.open('spoty-track-canvas-v1', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('clips', { keyPath: 'key' });
  request.onerror = () => { database = undefined; reject(Error('Не удалось открыть хранилище Canvas.')); };
  request.onsuccess = () => {
    request.result.onversionchange = () => { request.result.close(); database = undefined; };
    resolve(request.result);
  };
});
let enabled = true;
try { enabled = localStorage.getItem('spoty_canvas_enabled_v1') !== 'false'; } catch { /* Private storage. */ }
export const useCanvasStore = create<{ enabled: boolean; revision: number; setEnabled: (value: boolean) => void }>((set) => ({
  enabled, revision: 0, setEnabled(value) {
    set({ enabled: value });
    try { localStorage.setItem('spoty_canvas_enabled_v1', String(value)); } catch { /* Device preference. */ }
  },
}));
const changed = () => useCanvasStore.setState(s => ({ revision: s.revision + 1 }));
const key = (owner: string, trackId: string) => JSON.stringify([owner, trackId]);
export async function readCanvas(owner: string, trackId: string): Promise<CanvasClip | undefined> {
  if (!owner || !trackId) return;
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('clips', 'readonly'), request = tx.objectStore('clips').get(key(owner, trackId));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function inspectCanvas(file: File): Promise<number> {
  if (!file.size || file.size > MAX_FILE) throw Error('Выберите видео размером до 8 МБ.');
  if (!['video/mp4', 'video/webm'].includes(file.type)) throw Error('Поддерживаются MP4 и WebM.');
  const video = document.createElement('video'), url = URL.createObjectURL(file);
  video.muted = true; video.preload = 'metadata'; video.playsInline = true;
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Не удалось прочитать видео.')), 8000);
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        if (!Number.isFinite(video.duration) || video.duration < 3 || video.duration > 8.15) reject(Error('Длительность Canvas должна быть от 3 до 8 секунд.'));
        else if (!video.videoWidth || video.videoWidth > 1920 || video.videoHeight > 1920) reject(Error('Максимальный размер видео — 1920 пикселей по стороне.'));
        else resolve(video.duration);
      };
      video.onerror = () => { clearTimeout(timer); reject(Error('Не удалось прочитать видео. Попробуйте другой MP4 или WebM.')); };
      video.src = url;
    });
  } finally { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); }
}
export async function saveCanvas(owner: string, trackId: string, file: File, duration: number) {
  if (!owner || !trackId || !file.size || file.size > MAX_FILE || !Number.isFinite(duration) || duration < 3 || duration > 8.15) throw Error('Некорректный Canvas.');
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction('clips', 'readwrite'), store = tx.objectStore('clips'), all = store.getAll();
    let reason = 'Не удалось сохранить Canvas. Проверьте свободное место.';
    all.onsuccess = () => {
      const rows = (all.result as CanvasClip[]).filter(r => r.key !== key(owner, trackId));
      if (rows.reduce((sum, r) => sum + r.blob.size, 0) + file.size > MAX_TOTAL || rows.filter(r => r.owner === owner).length >= 12) {
        reason = 'Хранилище Canvas заполнено. Удалите один из сохранённых роликов.'; tx.abort(); return;
      }
      store.put({ key: key(owner, trackId), owner, trackId, blob: file, duration, updatedAt: Date.now() } satisfies CanvasClip);
    };
    tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(Error(reason));
  });
  changed();
}
export async function deleteCanvas(owner: string, trackId: string) {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction('clips', 'readwrite'); tx.objectStore('clips').delete(key(owner, trackId));
    tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(Error('Не удалось удалить Canvas.'));
  });
  changed();
}
