import { isNativeAndroid } from './nativeBridge';
import { useEffect } from 'react';
import { create } from 'zustand';
import { apiClient } from '../api/client';
import { useSettingsStore } from '../store/settingsStore';
import { usePlayerStore } from '../store/playerStore';
import { recordingVersion } from '../hooks/recordingVersions';
import { setNormalizationGain } from '../hooks/useAudioPlayer';

type Gain = { gain: number; gain_db: number };
let initial: Record<string, Gain> = {};
try { const saved = JSON.parse(localStorage.getItem('spoty_loudness_v1') || '{}');
  for (const [key, value] of Object.entries(saved).slice(-256)) { const v = value as Gain; if (Number.isFinite(v?.gain) && v.gain >= .05 && v.gain <= 2) initial[key] = v; }
} catch { /* Optional metadata. */ }
export const useSoundProfiles = create<{ gains: Record<string, Gain> }>(() => ({ gains: initial }));
export const profileKey = (id: string) => `${id}:${recordingVersion(id)}`;
export function SoundProfiles() {
  const enabled = useSettingsStore(s => s.normalizeAudio);
  const queue = usePlayerStore(s => s.queue), index = usePlayerStore(s => s.queueIndex), token = usePlayerStore(s => s.playToken);
  useEffect(() => {
    if (!enabled || isNativeAndroid()) return;
    let cancelled = false; const timers: ReturnType<typeof setTimeout>[] = [];
    const tracks = queue.slice(Math.max(0, index), Math.max(0, index) + 3);
    for (const track of tracks) {
      const key = profileKey(track.id), cached = useSoundProfiles.getState().gains[key];
      setNormalizationGain(track.id, cached?.gain || 1);
      if (cached) continue;
      const fetch = async (attempt: number) => {
        try {
          const { data } = await apiClient.get('/stream/loudness', { params: { track_id: track.id }, timeout: 6000 });
          if (cancelled) return;
          if (data.status === 'ready' && Number.isFinite(data.gain) && data.gain >= .05 && data.gain <= 2) {
            const gains = { ...useSoundProfiles.getState().gains, [key]: { gain: data.gain, gain_db: data.gain_db } };
            const bounded = Object.fromEntries(Object.entries(gains).slice(-256));
            useSoundProfiles.setState({ gains: bounded }); setNormalizationGain(track.id, data.gain);
            try { localStorage.setItem('spoty_loudness_v1', JSON.stringify(bounded)); } catch {}
          } else if (attempt < 5) timers.push(setTimeout(() => void fetch(attempt + 1), 4000));
        } catch { /* Playback remains available when analysis is unavailable/offline. */ }
      };
      void fetch(0);
    }
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [enabled, queue, index, token]);
  return null;
}
