import { useMixTuning } from '../store/mixTuning';
import { useEffect } from 'react';
import { api } from '../api/client';
import type { Track } from '../api/types';
import { usePlayerStore } from '../store/playerStore';
import { useSettingsStore } from '../store/settingsStore';
import { listenNativeState, nativeCall } from './nativeBridge';

type Entry = { occurrenceId: string; track: Track; url: string };
export function reconcileNativeQueue(previous: Entry[], queue: Track[]): Entry[] {
  const used = new Set<string>();
  return queue.map(track => {
    const found = previous.find(e => !used.has(e.occurrenceId) && e.track === track)
      || previous.find(e => !used.has(e.occurrenceId) && e.track.id === track.id);
    const occurrenceId = found?.occurrenceId || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    used.add(occurrenceId);
    return { occurrenceId, track, url: api.getStreamUrl(track.id, `${track.artist_name} - ${track.title}`, track.duration) };
  });
}

/** Android owns the queue; UI updates never start a second HTMLAudio player. */
export function NativeAudioRuntime() {
  useEffect(() => {
    let cancelled = false, applying = false, ready = false, revision = 0;
    let entries: Entry[] = [];
    const clientId = `${Date.now()}-${Math.random()}`;
    const apply = (snapshot: any) => {
      if (cancelled || !snapshot || (snapshot.clientId === clientId && snapshot.revision < revision)) return;
      const state = usePlayerStore.getState();
      // An older client cannot overwrite a newly-issued user command.
      if (ready && snapshot.clientId !== clientId && revision > 0) return;
      if (Array.isArray(snapshot.queue)) entries = snapshot.queue;
      const index = entries.findIndex(e => e.occurrenceId === snapshot.occurrenceId);
      const track = index >= 0 ? entries[index].track : null;
      applying = true;
      try {
        usePlayerStore.setState({
          ...(snapshot.queue ? { queue: entries.map(e => e.track), queueIndex: index } : { queueIndex: index }),
          currentTrack: track, isPlaying: !!snapshot.playWhenReady,
          currentTime: Math.max(0, snapshot.position || 0), duration: snapshot.duration || track?.duration || 0,
          repeatMode: snapshot.repeat || 'off', isShuffle: !!snapshot.shuffle,
          playedTrackIds: Array.isArray(snapshot.playedTrackIds) ? snapshot.playedTrackIds : state.playedTrackIds,
          seekTarget: null, autoplayPending: !!snapshot.continuing,
          playbackError: snapshot.error || null, playbackNotice: snapshot.notice || null,
          ...(track?.playback_context ? { activeMix: track.playback_context, activeContextUri: track.playback_context.id } : {}),
          playToken: snapshot.playToken ?? state.playToken,
        });
      } finally { applying = false; }
    };
    const send = () => {
      if (!ready || applying || cancelled) return;
      const state = usePlayerStore.getState();
      entries = reconcileNativeQueue(entries, state.queue);
      const sentRevision = ++revision;
      const settings = useSettingsStore.getState();
      void nativeCall('sync', { clientId, revision: sentRevision, queue: entries,
        index: state.queueIndex, position: state.seekTarget ?? state.currentTime,
        seek: state.seekTarget !== null, playing: state.isPlaying, playToken: state.playToken,
        repeat: state.repeatMode, shuffle: state.isShuffle, volume: state.isMuted ? 0 : state.volume,
        normalizeAudio: settings.normalizeAudio, crossfadeSeconds: settings.crossfadeSeconds,
        mixTuning: { novelty: useMixTuning.getState().novelty, diversity: useMixTuning.getState().diversity },
        equalizer: { enabled: settings.equalizerEnabled, bands: settings.equalizerBands },
      }).catch(() => {
        if (!cancelled && sentRevision === revision) {
          applying = true;
          usePlayerStore.setState({ isPlaying: false, playbackError: 'Не удалось запустить плеер. Нажмите повтор.' });
          applying = false;
        }
      });
    };
    const unlisten = listenNativeState(apply);
    const unsettings = useSettingsStore.subscribe((state, previous) => {
      if (state.equalizerEnabled !== previous.equalizerEnabled || state.equalizerBands !== previous.equalizerBands || state.normalizeAudio !== previous.normalizeAudio || state.crossfadeSeconds !== previous.crossfadeSeconds) send();
    });
    const untuning = useMixTuning.subscribe(send);
    const unsubscribe = usePlayerStore.subscribe((state, previous) => {
      if (state.queue !== previous.queue || state.currentTrack?.id !== previous.currentTrack?.id
        || state.playToken !== previous.playToken || state.isPlaying !== previous.isPlaying
        || state.seekTarget !== previous.seekTarget || state.repeatMode !== previous.repeatMode
        || state.isShuffle !== previous.isShuffle || state.volume !== previous.volume || state.isMuted !== previous.isMuted) send();
    });
    void nativeCall('subscribe').then(snapshot => {
      if (cancelled) return;
      if (snapshot.queue?.length) apply(snapshot);
      ready = true;
      send();
    }).catch(() => { if (!cancelled) usePlayerStore.setState({ playbackError: 'Не удалось подключить плеер. Откройте приложение повторно.' }); });
    return () => { cancelled = true; unsubscribe(); unsettings(); untuning(); unlisten(); };
  }, []);
  return null;
}
