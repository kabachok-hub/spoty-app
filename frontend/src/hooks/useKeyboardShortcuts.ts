import { useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';

export function useKeyboardShortcuts() {
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const nextTrack = usePlayerStore((state) => state.nextTrack);
  const prevTrack = usePlayerStore((state) => state.prevTrack);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const seek = usePlayerStore((state) => state.seek);
  const volume = usePlayerStore((state) => state.volume);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const isMuted = usePlayerStore((state) => state.isMuted);
  const toggleMute = usePlayerStore((state) => state.toggleMute);
  const toggleNowPlaying = usePlayerStore((state) => state.toggleNowPlaying);
  const isFullscreen = usePlayerStore((state) => state.isFullscreen);
  const setFullscreen = usePlayerStore((state) => state.setFullscreen);
  const currentTrack = usePlayerStore((state) => state.currentTrack);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea, or contentEditable element
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // If no track is loaded, ignore media shortcuts
      if (!currentTrack) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            nextTrack();
          } else {
            const nextTime = Math.min(duration || Infinity, currentTime + 5);
            seek(nextTime);
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            prevTrack();
          } else {
            const prevTime = Math.max(0, currentTime - 5);
            seek(prevTime);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.05));
          break;

        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.05));
          break;

        case 'KeyM':
          toggleMute();
          break;

        case 'KeyL':
          toggleNowPlaying();
          break;

        case 'KeyF':
          setFullscreen(!isFullscreen);
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isFullscreen,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleMute,
    toggleNowPlaying,
    setFullscreen,
  ]);
}
