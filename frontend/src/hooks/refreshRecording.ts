import { api } from '../api/client';
import type { Track } from '../api/types';
import { usePlayerStore } from '../store/playerStore';
import { invalidateTelegramRecording } from './telegramAudioBuffer';
import { beginRecordingRefresh, endRecordingRefresh, bumpRecordingVersion } from './recordingVersions';

const pending = new Map<string, Promise<void>>();

export function refreshRecording(track: Track): Promise<void> {
  const existing = pending.get(track.id);
  if (existing) return existing;
  const started = usePlayerStore.getState();
  const stillOriginalPlayback = () => {
    const now = usePlayerStore.getState();
    return started.currentTrack?.id === track.id && now.currentTrack?.id === track.id && now.playToken === started.playToken;
  };
  beginRecordingRefresh(track.id);
  invalidateTelegramRecording(track.id);
  const request = (async () => {
    let refreshed = false;
    try {
      const result = await api.refreshTrack(track.id, track.artist_name, track.title, track.duration);
      if (result.status !== 'ok') throw new Error('Recording refresh failed');
      refreshed = true;
    } catch {
      const message = 'Не удалось обновить полную запись. Попробуйте ещё раз.';
      if (stillOriginalPlayback()) usePlayerStore.setState({ playbackError: message });
      throw new Error(message);
    } finally {
      // Discard even a prefetch that finished while the server was replacing the file.
      invalidateTelegramRecording(track.id);
      bumpRecordingVersion(track.id);
      endRecordingRefresh(track.id);
      // Re-prime upcoming audio without restarting the currently selected recording.
      const state = usePlayerStore.getState();
      usePlayerStore.setState({ queue: [...state.queue], ...(refreshed && stillOriginalPlayback()
        ? { playToken: Math.max(Date.now(), state.playToken + 1), currentTime: 0, seekTarget: null, playbackError: null }
        : {}) });
    }
  })();
  pending.set(track.id, request);
  request.then(() => pending.delete(track.id), () => pending.delete(track.id));
  return request;
}
