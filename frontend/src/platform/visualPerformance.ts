import { useEffect, useSyncExternalStore } from 'react';
import { isHostHidden } from './nativeBridge';

export type VisualMode = 'economy' | 'balanced' | 'quality';
const KEY = 'spoty_visual_performance_v1';
const modes = new Set<VisualMode>(['economy', 'balanced', 'quality']);
const listeners = new Set<() => void>();
let mode: VisualMode = 'balanced';
try { const stored = localStorage.getItem(KEY) as VisualMode; if (modes.has(stored)) mode = stored; } catch { }
export function getVisualMode(): VisualMode { return mode; }
export function visualBudget() {
  switch (getVisualMode()) {
    case 'economy': return { fps: 15, width: 960, height: 540, blur: 0, stars: 70, particles: 12, freezeVideo: true };
    case 'balanced': return { fps: 30, width: 1280, height: 720, blur: 8, stars: 140, particles: 26, freezeVideo: false };
    default: return { fps: 60, width: Infinity, height: Infinity, blur: Infinity, stars: 220, particles: 42, freezeVideo: false };
  }
}
export function decorativeSize(width: number, height: number) {
  const budget = visualBudget(), scale = Math.min(1, budget.width / width, budget.height / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export function setVisualMode(next: VisualMode) {
  if (!modes.has(next)) return;
  mode = next;
  try { localStorage.setItem(KEY, next); } catch { }
  for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useVisualMode() {
  const current = useSyncExternalStore(subscribe, getVisualMode, () => 'quality' as const);
  useEffect(() => {
    document.documentElement.dataset.visualMode = current;
  }, [current]);
  return current;
}
export function decorativeHidden() { return (typeof document !== 'undefined' && document.hidden) || isHostHidden(); }
const subscribeVisibility = (listener: () => void) => {
  document.addEventListener('visibilitychange', listener); window.addEventListener('spoty-host-visibility', listener);
  return () => { document.removeEventListener('visibilitychange', listener); window.removeEventListener('spoty-host-visibility', listener); };
};
export function useDecorativeHidden() { return useSyncExternalStore(subscribeVisibility, decorativeHidden, () => false); }

/** Stops RAF entirely while hidden; only drawing is capped, never the audio clock. */
export function startDecorativeLoop(draw: () => void) {
  let frame: number | null = null, stopped = false, previous = -Infinity;
  const tick = (at: number) => {
    frame = null;
    if (stopped || decorativeHidden()) return;
    const interval = 1000 / visualBudget().fps;
    const elapsed = at - previous;
    if (!Number.isFinite(previous) || elapsed + .01 >= interval) {
      previous = interval && Number.isFinite(previous)
        ? previous + Math.max(1, Math.floor((elapsed + .01) / interval)) * interval : at;
      draw();
    }
    frame = requestAnimationFrame(tick);
  };
  const visibility = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null; previous = -Infinity;
    if (!stopped && !decorativeHidden()) frame = requestAnimationFrame(tick);
  };
  document.addEventListener('visibilitychange', visibility); window.addEventListener('spoty-host-visibility', visibility); visibility();
  return () => {
    stopped = true; if (frame !== null) cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange', visibility); window.removeEventListener('spoty-host-visibility', visibility);
  };
}
