type Host = { postMessage: (message: string) => void; onmessage?: (event: { data: string }) => void; listen?: (handler: (event: { data: string }) => void) => void };
declare global { interface Window { SpotyAndroid?: Host; SpotyDesktop?: Host } }
type Listener = (state: any) => void;
const listeners = new Set<Listener>();
const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
let sequence = 0;
let attached: Host | undefined;
let hostHidden = false;
export const isHostHidden = () => hostHidden;
export const isNativeAndroid = () => typeof window !== 'undefined' && !!window.SpotyAndroid;
export const isNativeClient = () => typeof window !== 'undefined' && !!(window.SpotyAndroid || window.SpotyDesktop);
export function nativeCall<T = any>(command: string, data: unknown = {}): Promise<T> {
  const host = window.SpotyAndroid || window.SpotyDesktop;
  if (!host) return Promise.reject(new Error('Native host unavailable'));
  if (attached !== host) {
    attached = host;
    const receive = (event: { data: string }) => {
      let message: any;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.event === 'visibility') {
        hostHidden = !!message.hidden;
        if (typeof document !== 'undefined') document.documentElement.dataset.hostHidden = String(hostHidden);
        window.dispatchEvent(new Event('spoty-host-visibility')); return;
      }
      if (message.event === 'toggle-play') { window.dispatchEvent(new Event('spoty-toggle-play')); return; }
      if (message.event === 'state') { for (const listener of listeners) listener(message.state); return; }
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id); clearTimeout(request.timer);
      if (message.error) request.reject(new Error('Не удалось выполнить действие приложения'));
      else request.resolve(message.result);
    };
    if (host.listen) host.listen(receive); else host.onmessage = receive;
  }
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Приложение не ответило. Попробуйте ещё раз.')); }, 15000);
    pending.set(id, { resolve, reject, timer });
    try { host.postMessage(JSON.stringify({ id, command, data })); }
    catch { pending.delete(id); clearTimeout(timer); reject(new Error('Native host unavailable')); }
  });
}
export function listenNativeState(listener: Listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
