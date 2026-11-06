import { useEffect, useRef, useCallback, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';

const STORAGE_KEY = 'sleep_timer_end';

export function useSleepTimer() {
  const [timeLeft, setTimeLeft] = useState<number>(0); // seconds remaining
  const [isActive, setIsActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check saved timer on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const endTs = parseInt(saved, 10);
        const now = Date.now();
        if (endTs > now) {
          setTimeLeft(Math.ceil((endTs - now) / 1000));
          setIsActive(true);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (e) {}
  }, []);

  // Tick countdown
  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Timer fired — pause player
          clearInterval(intervalRef.current!);
          setIsActive(false);
          try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
          usePlayerStore.getState().pause();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive]);

  const setTimer = useCallback((minutes: number) => {
    const endTs = Date.now() + minutes * 60 * 1000;
    try { localStorage.setItem(STORAGE_KEY, String(endTs)); } catch (e) {}
    setTimeLeft(minutes * 60);
    setIsActive(true);
  }, []);

  const cancelTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsActive(false);
    setTimeLeft(0);
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }, []);

  // Format remaining time as MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return { timeLeft, isActive, setTimer, cancelTimer, formatTime };
}
