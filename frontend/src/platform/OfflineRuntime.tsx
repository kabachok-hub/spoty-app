import { isNativeAndroid } from './nativeBridge';
import { useEffect } from 'react';
import { useOfflineStore, offlineSource } from '../store/offlineStore';
import { registerOfflineResolver } from '../hooks/useAudioPlayer';
import { recordingVersion } from '../hooks/recordingVersions';
import { usePlayerStore } from '../store/playerStore';
export function OfflineRuntime() {
  useEffect(() => {
    registerOfflineResolver(id => recordingVersion(id) === 0 && useOfflineStore.getState().tracks.some(row => row.track.id === id) ? offlineSource(id) : undefined);
    void useOfflineStore.getState().refresh().then(() => {
      const player = usePlayerStore.getState();
      if (!isNativeAndroid() && !player.isPlaying && player.currentTrack && useOfflineStore.getState().tracks.some(row => row.track.id === player.currentTrack!.id)) usePlayerStore.setState({ playToken: Date.now() });
    });
    return () => registerOfflineResolver(null);
  }, []);
  return null;
}
