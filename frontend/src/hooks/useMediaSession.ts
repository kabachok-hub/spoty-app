import { useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';

export function useMediaSession() {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const play = () => usePlayerStore.getState().setPlaying(true);
  const pause = () => usePlayerStore.getState().setPlaying(false);
  const nextTrack = () => usePlayerStore.getState().nextTrack();
  const prevTrack = () => usePlayerStore.getState().prevTrack();
  const seek = (sec: number) => usePlayerStore.getState().seek(sec);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    // Resolve absolute artwork URL for iOS Dynamic Island and Lockscreen
    const cover = currentTrack.cover_url
      ? currentTrack.cover_url.startsWith('http')
        ? currentTrack.cover_url
        : new URL(currentTrack.cover_url, window.location.origin).href
      : `${window.location.origin}/placeholder.png`;

    // Set lockscreen & notification metadata
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist_name,
      album: currentTrack.album_title || 'Spotify TMA',
      artwork: [
        { src: cover, sizes: '96x96' },
        { src: cover, sizes: '128x128' },
        { src: cover, sizes: '192x192' },
        { src: cover, sizes: '256x256' },
        { src: cover, sizes: '384x384' },
        { src: cover, sizes: '512x512' },
      ],
    });

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    // Register media control actions
    navigator.mediaSession.setActionHandler('play', () => play());
    navigator.mediaSession.setActionHandler('pause', () => pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
    
    try {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          seek(details.seekTime);
        }
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const skip = details.seekOffset || 10;
        seek(Math.max(0, currentTime - skip));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const skip = details.seekOffset || 10;
        seek(Math.min(duration, currentTime + skip));
      });
    } catch (e) {
      // Some browsers do not support seekto action
    }

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        try {
          navigator.mediaSession.setActionHandler('seekto', null);
          navigator.mediaSession.setActionHandler('seekbackward', null);
          navigator.mediaSession.setActionHandler('seekforward', null);
        } catch (e) {}
      }
    };
  }, [currentTrack]);

  // Update playback position state for lockscreen timeline slider
  useEffect(() => {
    if (!('mediaSession' in navigator) || !duration || duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: Math.max(duration, 1),
        playbackRate: 1,
        position: Math.min(currentTime, duration),
      });
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch (e) {
      // Not supported or invalid state
    }
  }, [currentTime, duration, isPlaying]);
}
