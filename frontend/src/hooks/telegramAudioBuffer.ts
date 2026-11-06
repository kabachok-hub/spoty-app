import { api } from '../api/client';
import type { Track } from '../api/types';
import { isRecordingRefreshing } from './recordingVersions';
import { traceBufferPreparation } from './playbackDiagnostics';

// Keep only the current track and two upcoming full recordings in device memory.
// Local blob URLs avoid opening a new native HTTP media request at a hidden transition.
const MAX_FILE_BYTES = 12 * 1024 * 1024;
type Entry = { controller: AbortController; url?: string; pending?: Promise<void> };
const entries = new Map<string, Entry>();
let generation = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

export function bufferedTelegramSource(id: string): string | undefined {
  return entries.get(id)?.url;
}

export function invalidateTelegramRecording(id: string) {
  const entry = entries.get(id);
  if (!entry) return;
  entry.controller.abort();
  if (entry.url) URL.revokeObjectURL(entry.url);
  entries.delete(id);
}

export function clearTelegramAudioBuffer() {
  generation++;
  if (retryTimer !== undefined) clearTimeout(retryTimer);
  retryTimer = undefined;
  for (const entry of entries.values()) {
    entry.controller.abort();
    if (entry.url) URL.revokeObjectURL(entry.url);
  }
  entries.clear();
}

async function prepare(track: Track): Promise<void> {
  if (isRecordingRefreshing(track.id)) return;
  const existing = entries.get(track.id);
  if (existing) return existing.pending;
  const entry: Entry = { controller: new AbortController() };
  entries.set(track.id, entry);
  entry.pending = (async () => {
    const started = Date.now();
    let timedOut = false;
    let failure: 'network' | 'source' = 'network';
    traceBufferPreparation('buffer_start', track.id, started);
    const timer = setTimeout(() => { timedOut = true; entry.controller.abort(); }, 90000);
    try {
      const response = await fetch(api.getStreamUrl(track.id, `${track.artist_name} - ${track.title}`, track.duration), {
        signal: entry.controller.signal, credentials: 'same-origin',
      });
      const type = response.headers.get('Content-Type')?.split(';')[0] || '';
      if (!response.ok || !type.startsWith('audio/') || Number(response.headers.get('Content-Length')) > MAX_FILE_BYTES) {
        failure = 'source';
        await response.body?.cancel();
        throw new Error('Recording unavailable or exceeds device buffer limit');
      }
      if (!response.body) throw new Error('Recording body unavailable');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_FILE_BYTES) throw new Error('Recording exceeds device buffer limit');
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      if (!size || entry.controller.signal.aborted || entries.get(track.id) !== entry) return;
      entry.url = URL.createObjectURL(new Blob(chunks as BlobPart[], { type }));
      traceBufferPreparation('buffer_ready', track.id, started);
    } catch {
      const cancelled = entry.controller.signal.aborted && !timedOut;
      if (!cancelled && entries.get(track.id) === entry) {
        traceBufferPreparation('buffer_failed', track.id, started, timedOut ? 'timeout' : failure);
      }
      entry.controller.abort();
      if (entries.get(track.id) === entry) entries.delete(track.id);
      // Keep the ordinary streaming path usable when prefetch fails.
    } finally { clearTimeout(timer); }
  })();
  return entry.pending;
}

export async function warmTelegramQueue(queue: Track[], index: number, attempt = 0): Promise<void> {
  if (retryTimer !== undefined) clearTimeout(retryTimer);
  retryTimer = undefined;
  const request = ++generation;
  const current = queue[index];
  if (!current) return;
  const upcoming = [1, 2].map(offset => queue[(index + offset) % queue.length])
    .filter((track, i, list) => track && track.id !== current.id && list.findIndex(t => t?.id === track.id) === i);
  const keep = new Set([current.id, ...upcoming.map(track => track.id)]);
  for (const [id, entry] of entries) {
    if (!keep.has(id)) {
      entry.controller.abort();
      if (entry.url) URL.revokeObjectURL(entry.url);
      entries.delete(id);
    }
  }
  // One download at a time; prioritize the next track over the one after it.
  let incomplete = false;
  for (const track of upcoming) {
    if (request !== generation) return;
    await prepare(track);
    // A queue change cancels this sequence; don't recreate cancelled downloads.
    if (request !== generation) return;
    // A failed next track must not prevent preparing the one after it.
    if (!entries.has(track.id)) incomplete = true;
  }
  if (incomplete && attempt < 2 && request === generation) {
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      if (request === generation) void warmTelegramQueue(queue, index, attempt + 1);
    }, attempt === 0 ? 1500 : 4000);
  }
}
