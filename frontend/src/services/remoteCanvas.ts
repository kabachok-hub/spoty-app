import { apiClient } from '../api/client';

const MAX = 8 * 1024 * 1024, BUDGET = 16 * 1024 * 1024;
const cache = new Map<string, { blob?: Blob; until: number }>();
let bytes = 0, account: number | undefined;

export function clearRemoteCanvas(owner?: number) {
  if (account !== owner) { cache.clear(); bytes = 0; account = owner; }
}

/** Account-scoped, memory-only media cache; no Spotify credential in the renderer. */
export async function remoteCanvas(owner: number, trackId: string, signal: AbortSignal): Promise<Blob | undefined> {
  clearRemoteCanvas(owner);
  if (!/^(?:[0-9]{1,20}|sp_[A-Za-z0-9]{22})$/.test(trackId)) return;
  const previous = cache.get(trackId);
  if (previous && previous.until > Date.now()) {
    cache.delete(trackId); cache.set(trackId, previous); return previous.blob;
  }
  let blob: Blob | undefined;
  try {
    const response = await apiClient.get<Blob>(`/canvas/${encodeURIComponent(trackId)}/video`, {
      responseType: 'blob', timeout: 28000, signal,
    });
    if (response.status === 200 && response.data.size > 0 && response.data.size <= MAX && response.data.type === 'video/mp4') blob = response.data;
  } catch { /* Optional visuals must never interrupt audio or display playback errors. */ }
  if (signal.aborted || account !== owner) return;
  bytes -= cache.get(trackId)?.blob?.size || 0;
  cache.delete(trackId);
  cache.set(trackId, { blob, until: Date.now() + (blob ? 300000 : 60000) });
  bytes += blob?.size || 0;
  while (cache.size > 64 || bytes > BUDGET) {
    const key = cache.keys().next().value as string;
    bytes -= cache.get(key)?.blob?.size || 0; cache.delete(key);
  }
  return blob;
}
