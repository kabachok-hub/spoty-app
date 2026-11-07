import { create } from 'zustand';
import { isNativeAndroid, isNativeClient, nativeCall } from './nativeBridge';
import { AppRelease, selectRelease } from './releases';

export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.2.4';
const INTERVAL = 6 * 60 * 60 * 1000;
type UpdateState = { release: AppRelease | null; status: 'idle' | 'checking' | 'ready' | 'error'; checked: number; check: (manual?: boolean) => Promise<void> };
export const useAppUpdates = create<UpdateState>((set, get) => ({
  release: null, status: 'idle', checked: 0,
  async check(manual = false) {
    const state = get();
    if (!isNativeClient() || state.status === 'checking' || (!manual && Date.now() - state.checked < INTERVAL)) return;
    set({ status: 'checking' });
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    try {
      // Public GitHub request: never use the authenticated Spoty API client.
      const response = await fetch('https://api.github.com/repos/kabachok-hub/spoty-app/releases?per_page=20', {
        credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal, headers: { Accept: 'application/vnd.github+json' },
      });
      if (!response.ok) throw Error('Release feed unavailable');
      const text = await response.text();
      if (text.length > 2 * 1024 * 1024) throw Error('Release feed too large');
      set({ release: selectRelease(JSON.parse(text), APP_VERSION, isNativeAndroid()), status: 'ready', checked: Date.now() });
    } catch { set({ status: 'error', checked: Date.now() }); }
    finally { clearTimeout(timer); }
  },
}));
export async function openAppUpdate() {
  const release = useAppUpdates.getState().release;
  if (release) await nativeCall('openExternal', { url: release.url });
}
