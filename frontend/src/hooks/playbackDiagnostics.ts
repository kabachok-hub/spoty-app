import { apiClient } from '../api/client';

// Bounded device trace. Never include media URLs, auth data or arbitrary error messages.
const events: Record<string, unknown>[] = [];
let sending = false;
let lastSent = 0;
let sourceStarted = Date.now();
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let recentHiddenNetworkFailureAt = 0;

export function isAndroidMiniApp(): boolean {
  const tg = (window as any).Telegram?.WebApp;
  return Boolean(tg?.initData && tg?.platform === 'android');
}

export function mobileMiniAppPlatform(): 'android' | 'ios' | null {
  const tg = (window as any).Telegram?.WebApp;
  return tg?.initData && (tg.platform === 'android' || tg.platform === 'ios') ? tg.platform : null;
}

export const BACKGROUND_PLAYBACK_MESSAGE = 'Фоновая загрузка прервана. Возможно, телефон ограничил доступ Telegram к сети. Откройте приложение, проверьте соединение и настройки работы в фоне.';

function likelyBackgroundNetworkFailure(audio: HTMLAudioElement): boolean {
  // Native source errors alone cannot distinguish HTTP502 from Android gating.
  // Require independent, recent hidden fetch failures; never relabel Blob/decode errors.
  return isAndroidMiniApp() && document.visibilityState !== 'visible' && !audio.src?.startsWith('blob:') &&
    recentHiddenNetworkFailureAt > 0 && Date.now() - recentHiddenNetworkFailureAt >= 0 &&
    Date.now() - recentHiddenNetworkFailureAt < 10000;
}

export function playbackFailure(error: unknown, audio: HTMLAudioElement): { code: string; message: string } {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'NotAllowedError') return { code: 'blocked', message: 'Telegram или браузер запретил запуск. Откройте плеер и нажмите «Повторить».' };
  if (name === 'AbortError') return { code: 'interrupted', message: 'Запуск записи был прерван. Нажмите «Повторить».' };
  if ((audio.error?.code === 2 || audio.error?.code === 4 || name === 'NotSupportedError' || name === 'TimeoutError') && likelyBackgroundNetworkFailure(audio)) {
    return { code: 'network', message: BACKGROUND_PLAYBACK_MESSAGE };
  }
  if (audio.error?.code === 2) return { code: 'network', message: 'Ошибка сети при загрузке записи. Проверьте соединение и повторите запуск.' };
  if (audio.error?.code === 3) return { code: 'decode', message: 'Не удалось декодировать запись. Повторите запуск или выберите другой трек.' };
  if (audio.error?.code === 4 || name === 'NotSupportedError') return { code: 'source', message: 'Полная запись недоступна или формат не поддерживается. Выберите другой трек.' };
  if (name === 'TimeoutError') return { code: 'timeout', message: 'Запись не начала играть за 45 секунд. Откройте плеер и повторите запуск.' };
  return { code: 'unknown', message: 'Не удалось запустить полную запись. Повторите запуск или выберите следующий трек.' };
}

export function tracePlayback(event: string, audio: HTMLAudioElement, trackId?: string, failure = 'none', contextState = 'none') {
  try {
    if (event === 'visible') recentHiddenNetworkFailureAt = 0;
    if (event === 'source') sourceStarted = Date.now();
    const tg = (window as any).Telegram?.WebApp;
    events.push({ event, track_id: String(trackId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80),
      at: Date.now(), elapsed_ms: Math.min(86400000, Math.max(0, Date.now() - sourceStarted)),
      hidden: document.visibilityState !== 'visible', online: navigator.onLine !== false,
      ready: audio.readyState, network: audio.networkState, media_error: audio.error?.code || 0,
      paused: audio.paused, ended: audio.ended, position: Math.max(0, Math.min(86400, Number.isFinite(audio.currentTime) ? audio.currentTime : 0)),
      local_source: audio.src?.startsWith('blob:') || false,
      failure, context: contextState, telegram: Boolean(tg?.initData),
      platform: String(tg?.platform || 'browser').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 40),
      version: String(tg?.version || '').replace(/[^0-9.]/g, '').slice(0, 20),
    });
    if (events.length > 20) events.shift();
    if (event === 'failure' || event === 'visible') void flushPlaybackTrace();
  } catch { /* Diagnostics must never interrupt playback. */ }
}

export function traceBufferPreparation(event: 'buffer_start' | 'buffer_ready' | 'buffer_failed', trackId: string,
  started: number, failure: 'none' | 'network' | 'source' | 'timeout' = 'none') {
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (event === 'buffer_ready') recentHiddenNetworkFailureAt = 0;
    else if (event === 'buffer_failed' && failure === 'network' && document.visibilityState !== 'visible' && Date.now() - started < 1000) {
      recentHiddenNetworkFailureAt = Date.now();
    }
    events.push({ event, track_id: trackId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80), at: Date.now(),
      elapsed_ms: Math.min(86400000, Math.max(0, Date.now() - started)),
      hidden: document.visibilityState !== 'visible', online: navigator.onLine !== false,
      ready: event === 'buffer_ready' ? 4 : 0, network: 0, media_error: 0,
      paused: true, ended: false, local_source: event === 'buffer_ready', position: 0,
      failure, context: 'none', telegram: Boolean(tg?.initData),
      platform: String(tg?.platform || 'browser').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 40),
      version: String(tg?.version || '').replace(/[^0-9.]/g, '').slice(0, 20) });
    if (events.length > 20) events.shift();
    if (event !== 'buffer_start') void flushPlaybackTrace();
  } catch { /* Buffer diagnostics must never interrupt preparation. */ }
}

async function flushPlaybackTrace() {
  if (sending || !events.length) return;
  const remaining = 10000 - (Date.now() - lastSent);
  if (remaining > 0) {
    if (retryTimer === undefined) retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void flushPlaybackTrace();
    }, remaining);
    return;
  }
  // Authentication is supplied by the shared interceptor; anonymous listeners have no remote trace.
  if (!(window as any).Telegram?.WebApp?.initData && !localStorage.getItem('spotify_auth_token')) return;
  sending = true;
  lastSent = Date.now();
  const batch = events.splice(0);
  try { await apiClient.post('/stream/diagnostics', { events: batch }, { timeout: 8000 }); }
  catch { events.unshift(...batch); events.splice(0, Math.max(0, events.length - 20)); }
  finally { sending = false; }
}
