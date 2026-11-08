import { createPlaybackRecovery } from './playbackRecovery';
import { sampleListening, interruptListening, finishListening } from './listeningFeedback';
import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useSettingsStore } from '../store/settingsStore';
import { api } from '../api/client';
import { Track } from '../api/types';
import { SILENT_MP3_URI } from './silent_uri';
import { playbackFailure, tracePlayback } from './playbackDiagnostics';
import { bufferedTelegramSource, warmTelegramQueue, clearTelegramAudioBuffer, invalidateTelegramRecording } from './telegramAudioBuffer';

// Equalizer Web Audio graph (ONLY activated if user explicitly turns on Equalizer in settings)
let audioContext: AudioContext | null = null;
const eqSources = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();
let eqFilters: BiquadFilterNode[] = [];
let eqInitialized = false;

function resumeAudioContext() {
  if (audioContext?.state === 'suspended') {
    audioContext.resume().catch((err) => console.warn('AudioContext resume failed:', err));
  }
}

function initEqualizerGraph(audio: HTMLAudioElement) {
  const { equalizerEnabled, equalizerBands } = useSettingsStore.getState();
  resumeAudioContext();
  if (!equalizerEnabled) return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioContext) audioContext = new AudioCtx();
    resumeAudioContext();
    if (!eqInitialized) {
    const frequencies = [60, 230, 910, 3600, 14000];
    const types: BiquadFilterType[] = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];

    eqFilters = frequencies.map((freq, i) => {
      const filter = audioContext!.createBiquadFilter();
      filter.type = types[i];
      filter.frequency.value = freq;
      filter.Q.value = 1.0;
      filter.gain.value = 0;
      return filter;
    });

    for (let i = 0; i < eqFilters.length - 1; i++) {
      eqFilters[i].connect(eqFilters[i + 1]);
    }
    eqFilters[eqFilters.length - 1].connect(audioContext.destination);
    eqInitialized = true;
    }
    if (!eqSources.has(audio)) {
      const source = audioContext.createMediaElementSource(audio);
      source.connect(eqFilters[0]);
      eqSources.set(audio, source);
    }

    applyEqualizerGains(equalizerEnabled, equalizerBands);
  } catch (err) {
    console.warn('Web Audio Equalizer initialization skipped:', err);
  }
}

function applyEqualizerGains(enabled: boolean, bands: [number, number, number, number, number]) {
  if (!eqFilters || eqFilters.length !== 5) return;
  try {
    eqFilters.forEach((filter, i) => {
      const gainVal = enabled ? bands[i] : 0;
      if (audioContext && audioContext.currentTime) {
        filter.gain.setTargetAtTime(gainVal, audioContext.currentTime, 0.05);
      } else {
        filter.gain.value = gainVal;
      }
    });
  } catch (e) {}
}

/**
 * Sync mobile MediaSession metadata and transport state
 */
let lastMediaMetadataKey = '';

function syncMediaSession(track: Track | null, isPlaying: boolean, audio?: HTMLAudioElement | null) {
  if (!('mediaSession' in navigator)) return;
  const session = navigator.mediaSession;
  if (!track) {
    lastMediaMetadataKey = '';
    session.metadata = null;
    session.playbackState = 'none';
    try { session.setPositionState?.(); } catch {}
    return;
  }
  let cover = new URL('/icon.svg', window.location.origin).href;
  try { cover = new URL((track.cover_url || '/icon.svg').replace(/^http:\/\//i, 'https://'), window.location.origin).href; } catch {}
  const metadataKey = JSON.stringify([track.id, track.title, track.artist_name, track.album_title, cover]);
  if (metadataKey !== lastMediaMetadataKey && typeof MediaMetadata !== 'undefined') {
    try {
      session.metadata = new MediaMetadata({
        title: track.title, artist: track.artist_name, album: track.album_title || 'Spoty',
        artwork: [{ src: cover }],
      });
      lastMediaMetadataKey = metadataKey;
    } catch (error) { console.warn('Media metadata unavailable:', error); }
  }
  session.playbackState = isPlaying && (!audio || (!audio.paused && !audio.ended && audio.readyState >= 3)) ? 'playing' : 'paused';
  try {
    if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
      session.setPositionState?.({
        duration: audio.duration,
        playbackRate: Number.isFinite(audio.playbackRate) && audio.playbackRate > 0 ? audio.playbackRate : 1,
        position: Math.max(0, Math.min(Number.isFinite(audio.currentTime) ? audio.currentTime : 0, audio.duration)),
      });
    } else {
      session.setPositionState?.();
    }
  } catch (error) { console.warn('Media position unavailable:', error); }
}

/**
 * Spotify perceptual loudness curve with 50% base attenuation and 150% boost headroom.
 */
function computeEffectiveVolume(vol: number, isMuted: boolean): number {
  if (isMuted || vol <= 0) return 0;
  const clamped = Math.max(0, Math.min(1.5, vol));
  const baseFraction = Math.min(1.0, clamped);
  const baseAmp = Math.pow(baseFraction, 2.8) * 0.5;
  const boostAmp = clamped > 1.0 ? (clamped - 1.0) * 1.0 : 0;
  return Math.max(0, Math.min(1.0, baseAmp + boostAmp));
}

export const isTelegramEnv = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).Telegram?.WebApp?.initData ||
    window.location.search.includes('tgWebAppData') ||
    window.location.search.includes('tgWebApp') ||
    navigator.userAgent.includes('Telegram')
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SILENT AUDIO KEEP-ALIVE LOOP (BACKGROUND CPU & WAKELOCK ANCHOR)
// Best-effort legacy keep-alive. This does not guarantee background execution:
// Telegram and the OS still control WebView lifecycle and audio focus.
// ─────────────────────────────────────────────────────────────────────────────

let keepAliveAudio: HTMLAudioElement | null = null;

export function getOrCreateKeepAliveAudio(): HTMLAudioElement {
  if (!keepAliveAudio && typeof document !== 'undefined') {
    keepAliveAudio = document.getElementById('spotify-keepalive-loop') as HTMLAudioElement;
    if (!keepAliveAudio) {
      keepAliveAudio = document.createElement('audio');
      keepAliveAudio.id = 'spotify-keepalive-loop';
      keepAliveAudio.loop = true;
      keepAliveAudio.volume = 0.01; // Non-zero so browser kernel keeps WakeLock
      keepAliveAudio.setAttribute('playsinline', 'true');
      keepAliveAudio.setAttribute('webkit-playsinline', 'true');
      keepAliveAudio.crossOrigin = 'anonymous';
      keepAliveAudio.style.display = 'none';
      keepAliveAudio.src = '/silence.mp3';
      keepAliveAudio.onerror = () => {
        if (keepAliveAudio && keepAliveAudio.src !== SILENT_MP3_URI) {
          keepAliveAudio.src = SILENT_MP3_URI;
          keepAliveAudio.play().catch(() => {});
        }
      };
      document.body.appendChild(keepAliveAudio);
    }
  }
  return keepAliveAudio!;
}

export function startKeepAlive() {
  if (!isTelegramEnv()) { stopKeepAlive(); return; }
  try {
    const ka = getOrCreateKeepAliveAudio();
    if (ka && ka.paused) {
      ka.play().catch(() => {});
    }
  } catch (e) {}
}

export function stopKeepAlive() {
  try {
    if (keepAliveAudio && !keepAliveAudio.paused) {
      keepAliveAudio.pause();
    }
  } catch (e) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// DUAL-DECK SEAMLESS GAPLESS ENGINE (DECK A & DECK B)
// While Deck A is playing Track N, Deck B pre-buffers Track N+1.
// At Track N end, Deck B starts in 0ms gapless without any network stall!
// ─────────────────────────────────────────────────────────────────────────────

let deckA: HTMLAudioElement | null = null;
let deckB: HTMLAudioElement | null = null;
let activeDeck: 'A' | 'B' = 'A';
let currentLoadedTrackIdA: string | null = null;
let currentLoadedTrackIdB: string | null = null;
let hasTriggeredTransition = false;
let isSwitchingDeck = false;
let playbackRequest = 0;
let offlineResolver: ((id: string) => Promise<string | undefined> | undefined) | null = null;
let offlineLoading = false;
export function registerOfflineResolver(resolve: typeof offlineResolver) { offlineResolver = resolve; }

const normalizationGains = new Map<string, number>();
const gainTimers = new Map<string, ReturnType<typeof setInterval>>();
const deckMix = { A: 1, B: 1 };
let fadeTimer: ReturnType<typeof setInterval> | null = null;
let fadeOutgoing: 'A' | 'B' | null = null;
let fadeRequest: { nextId: string; seconds: number } | null = null;
let fadeInitialSeek = false;
export function setNormalizationGain(id: string, gain: number) {
  if (!Number.isFinite(gain) || gain < .05 || gain > 2) return;
  const previous = normalizationGains.get(id) || 1;
  const timer = gainTimers.get(id); if (timer) clearInterval(timer);
  if (usePlayerStore.getState().isPlaying && usePlayerStore.getState().currentTrack?.id === id && Math.abs(previous-gain) > .001) {
    const started = Date.now();
    gainTimers.set(id, setInterval(() => {
      const p = Math.min(1,(Date.now()-started)/400);
      normalizationGains.set(id, previous+(gain-previous)*p); applyDeckVolumes();
      if (p >= 1) { const current = gainTimers.get(id); if (current) clearInterval(current); gainTimers.delete(id); }
    },40));
    return;
  }
  normalizationGains.delete(id); normalizationGains.set(id, gain);
  if (normalizationGains.size > 256) normalizationGains.delete(normalizationGains.keys().next().value!);
  applyDeckVolumes();
}
function trackVolume(id: string | null | undefined) {
  const state = usePlayerStore.getState();
  const gain = useSettingsStore.getState().normalizeAudio && id ? normalizationGains.get(id) || 1 : 1;
  return Math.max(0, Math.min(1, computeEffectiveVolume(state.volume, state.isMuted) * gain));
}
function applyDeckVolumes() {
  if (deckA) deckA.volume = trackVolume(currentLoadedTrackIdA) * deckMix.A;
  if (deckB) deckB.volume = trackVolume(currentLoadedTrackIdB) * deckMix.B;
}
function cancelCrossfade() {
  if (fadeTimer !== null) clearInterval(fadeTimer);
  fadeTimer = null;
  if (fadeOutgoing && fadeOutgoing !== activeDeck) (fadeOutgoing === 'A' ? deckA : deckB)?.pause();
  fadeOutgoing = null; deckMix.A = deckMix.B = 1; applyDeckVolumes();
}
function beginCrossfade(outgoing: 'A' | 'B', seconds: number) {
  fadeOutgoing = outgoing;
  const started = Date.now(), incoming = activeDeck;
  fadeTimer = setInterval(() => {
    const state = usePlayerStore.getState();
    if (!state.isPlaying || activeDeck !== incoming) { cancelCrossfade(); return; }
    const progress = Math.min(1, (Date.now() - started) / (seconds * 1000));
    const out = Math.cos(progress * Math.PI / 2), into = Math.sin(progress * Math.PI / 2);
    const headroom = Math.max(1, out + into);
    deckMix[outgoing] = out / headroom;
    deckMix[incoming] = into / headroom;
    applyDeckVolumes();
    if (progress >= 1) {
      cancelCrossfade();
      const next = state.queue[state.queueIndex + 1] || (state.repeatMode === 'all' ? state.queue[0] : null);
      if (next) primeStandbyDeck(next);
    }
  }, 50);
}


function ensureAudioElements(): { a: HTMLAudioElement; b: HTMLAudioElement } {
  if (!deckA && typeof document !== 'undefined') {
    deckA = document.getElementById('spotify-deck-a') as HTMLAudioElement;
    if (!deckA) {
      deckA = document.createElement('audio');
      deckA.id = 'spotify-deck-a';
      deckA.setAttribute('playsinline', 'true');
      deckA.setAttribute('webkit-playsinline', 'true');
      deckA.setAttribute('x-webkit-airplay', 'allow');
      deckA.crossOrigin = 'anonymous';
      deckA.style.display = 'none';
      document.body.appendChild(deckA);
    }
    deckA.preload = 'auto';
  }

  if (!deckB && typeof document !== 'undefined') {
    deckB = document.getElementById('spotify-deck-b') as HTMLAudioElement;
    if (!deckB) {
      deckB = document.createElement('audio');
      deckB.id = 'spotify-deck-b';
      deckB.setAttribute('playsinline', 'true');
      deckB.setAttribute('webkit-playsinline', 'true');
      deckB.setAttribute('x-webkit-airplay', 'allow');
      deckB.crossOrigin = 'anonymous';
      deckB.style.display = 'none';
      document.body.appendChild(deckB);
    }
    deckB.preload = 'auto';
  }

  getOrCreateKeepAliveAudio();

  return { a: deckA!, b: deckB! };
}

export function getActiveAudio(): HTMLAudioElement | null {
  ensureAudioElements();
  return activeDeck === 'A' ? deckA : deckB;
}

export function getStandbyAudio(): HTMLAudioElement | null {
  ensureAudioElements();
  return activeDeck === 'A' ? deckB : deckA;
}

function getActiveTrackId(): string | null {
  return activeDeck === 'A' ? currentLoadedTrackIdA : currentLoadedTrackIdB;
}

function setActiveTrackId(id: string | null) {
  if (activeDeck === 'A') currentLoadedTrackIdA = id;
  else currentLoadedTrackIdB = id;
}

function getStandbyTrackId(): string | null {
  return activeDeck === 'A' ? currentLoadedTrackIdB : currentLoadedTrackIdA;
}

function setStandbyTrackId(id: string | null) {
  if (activeDeck === 'A') currentLoadedTrackIdB = id;
  else currentLoadedTrackIdA = id;
}

export function primeStandbyDeck(nextTrack: Track | null) {
  if (!nextTrack || !nextTrack.id) return;
  const standby = getStandbyAudio();
  if (!standby) return;
  if (fadeOutgoing && standby === (fadeOutgoing === 'A' ? deckA : deckB)) return;

  const offline = offlineResolver?.(nextTrack.id);
  if (offline) {
    setStandbyTrackId(nextTrack.id);
    void offline.then(url => {
      if (url && getStandbyAudio() === standby && getStandbyTrackId() === nextTrack.id) { standby.src = url; standby.preload = 'auto'; standby.load(); }
    }).catch(() => {});
    return;
  }
  const nextQuery = `${nextTrack.artist_name} - ${nextTrack.title}`;
  const streamUrl = api.getStreamUrl(nextTrack.id, nextQuery, nextTrack.duration);

  if (getStandbyTrackId() === nextTrack.id && standby.src === new URL(streamUrl, window.location.origin).href) {
    return; // Already primed!
  }

  standby.src = streamUrl;
  standby.preload = 'auto';
  standby.currentTime = 0;
  standby.load();
  setStandbyTrackId(nextTrack.id);
  console.log(`[useAudioPlayer] Primed standby deck with next track: "${nextQuery}"`);
}

export async function preloadTrackBlob(_track: Track | null) {
  // Maintained for API compatibility; dual-deck handles native pre-buffering
}

/**
 * Seamlessly advances to the next track using Dual-Deck handoff.
 */
async function playWithDeadline(audio: HTMLAudioElement): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onError: () => void = () => {};
  try {
    await Promise.race([
      audio.play(),
      new Promise<never>((_, reject) => {
        onError = () => reject(new DOMException('Audio stream failed to load', 'NotSupportedError'));
        audio.addEventListener('error', onError, { once: true });
        timer = setTimeout(() => reject(new DOMException('Audio playback start timed out', 'TimeoutError')), 45000);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    audio.removeEventListener('error', onError);
  }
}

export async function playNextTrackSync(_ignored?: HTMLAudioElement | null) {
  if (isSwitchingDeck) return;
  isSwitchingDeck = true;
  hasTriggeredTransition = true;

  const state = usePlayerStore.getState();
  const { queue, queueIndex, isShuffle, repeatMode, volume, isMuted } = state;
  if (!queue || queue.length === 0) {
    isSwitchingDeck = false;
    hasTriggeredTransition = false;
    return;
  }

  ensureAudioElements();
  const fromDeck = getActiveAudio()!;
  const toDeck = getStandbyAudio()!;

  if (repeatMode === 'one') {
    fromDeck.currentTime = 0;
    try {
      await playWithDeadline(fromDeck);
      startKeepAlive();
    } catch (e) {
      console.warn('[useAudioPlayer] Could not restart current track:', e);
    } finally {
      isSwitchingDeck = false;
      hasTriggeredTransition = false;
    }
    return;
  }

  let nextIdx: number;
  if (queue[queueIndex + 1]?.queued_next) {
    nextIdx = queueIndex + 1;
  } else if (isShuffle) {
    nextIdx = Math.floor(Math.random() * queue.length);
    if (queue.length > 1 && nextIdx === queueIndex) {
      nextIdx = (nextIdx + 1) % queue.length;
    }
  } else {
    nextIdx = queueIndex + 1;
    if (nextIdx >= queue.length) {
      nextIdx = 0;
    }
  }

  const nextTrack = queue[nextIdx];
  if (!nextTrack) {
    isSwitchingDeck = false;
    hasTriggeredTransition = false;
    return;
  }

  const effVol = computeEffectiveVolume(volume, isMuted);
  toDeck.volume = effVol;

  // If standby deck is not yet primed with this track, assign it
  if (getStandbyTrackId() !== nextTrack.id || !toDeck.src) {
    const nextQuery = `${nextTrack.artist_name} - ${nextTrack.title}`;
    toDeck.src = api.getStreamUrl(nextTrack.id, nextQuery, nextTrack.duration);
    setStandbyTrackId(nextTrack.id);
  }

  toDeck.currentTime = 0;

  // Keep the current deck playing until the next deck has actually started.
  try {
    await playWithDeadline(toDeck);
  } catch (e) {
    console.warn('[useAudioPlayer] Switch deck failed to start; keeping current deck:', e);
    if (fromDeck.ended) usePlayerStore.getState().setPlaying(false);
    toDeck.pause();
    isSwitchingDeck = false;
    hasTriggeredTransition = false;
    return;
  }

  const latestState = usePlayerStore.getState();
  if (
    latestState.currentTrack?.id !== state.currentTrack?.id ||
    latestState.queueIndex !== queueIndex ||
    latestState.queue[nextIdx]?.id !== nextTrack.id ||
    latestState.playToken !== state.playToken ||
    (state.isPlaying && !latestState.isPlaying)
  ) {
    toDeck.pause();
    isSwitchingDeck = false;
    hasTriggeredTransition = false;
    if (!latestState.isPlaying) {
      fromDeck.pause();
      stopKeepAlive();
    } else if (
      latestState.currentTrack?.id !== state.currentTrack?.id ||
      latestState.playToken !== state.playToken
    ) {
      window.setTimeout(() => {
        const current = usePlayerStore.getState();
        if (current.isPlaying) usePlayerStore.setState({ playToken: Date.now() });
      }, 0);
    }
    return;
  }
  if (toDeck.paused) {
    isSwitchingDeck = false;
    hasTriggeredTransition = false;
    return;
  }

  // Gracefully stop old deck
  fromDeck.pause();
  fromDeck.currentTime = 0;

  // Flip active deck
  activeDeck = activeDeck === 'A' ? 'B' : 'A';
  setActiveTrackId(nextTrack.id);

  // Sync MediaSession with active deck
  syncMediaSession(nextTrack, true, toDeck);
  startKeepAlive();

  // Update Zustand store
  usePlayerStore.setState({
    currentTrack: { ...nextTrack, queued_next: false },
    queue: queue.map((track, index) => index === nextIdx ? { ...track, queued_next: false } : track),
    queueIndex: nextIdx,
    isPlaying: true,
    currentTime: 0,
    seekTarget: 0,
    duration: nextTrack.duration || 0,
    playToken: Date.now(),
  });

  api.recordHistory(nextTrack).catch(() => {});

  // Prime standby deck with the following track
  const nextNextIdx = (nextIdx + 1) % queue.length;
  const nextNextTrack = queue[nextNextIdx] || null;
  if (nextNextTrack) {
    primeStandbyDeck(nextNextTrack);
    api.preloadTrack(nextNextTrack.id, `${nextNextTrack.artist_name} - ${nextNextTrack.title}`, nextNextTrack.duration).catch(() => {});
  }

  isSwitchingDeck = false;
  setTimeout(() => {
    hasTriggeredTransition = false;
  }, 400);
}

export async function playPrevTrackSync(_ignored?: HTMLAudioElement | null) {
  if (isSwitchingDeck) return;
  isSwitchingDeck = true;

  const state = usePlayerStore.getState();
  const { queue, queueIndex, currentTime, volume, isMuted } = state;
  if (!queue || queue.length === 0) {
    isSwitchingDeck = false;
    return;
  }

  ensureAudioElements();
  const active = getActiveAudio()!;

  if (currentTime > 3) {
    active.currentTime = 0;
    try {
      await active.play();
      startKeepAlive();
      usePlayerStore.setState({ currentTime: 0, seekTarget: 0 });
    } catch (e) {
      console.warn('[useAudioPlayer] Could not restart current track:', e);
    } finally {
      isSwitchingDeck = false;
    }
    return;
  }

  let prevIdx = queueIndex - 1;
  if (prevIdx < 0) {
    prevIdx = queue.length - 1;
  }

  const prevTrack = queue[prevIdx];
  if (!prevTrack) {
    isSwitchingDeck = false;
    return;
  }

  const fromDeck = active;
  const toDeck = getStandbyAudio()!;
  const effVol = computeEffectiveVolume(volume, isMuted);

  const prevQuery = `${prevTrack.artist_name} - ${prevTrack.title}`;
  toDeck.src = api.getStreamUrl(prevTrack.id, prevQuery, prevTrack.duration);
  setStandbyTrackId(prevTrack.id);
  toDeck.volume = effVol;
  toDeck.currentTime = 0;

  startKeepAlive();

  try {
    await playWithDeadline(toDeck);
  } catch (e) {
    console.warn('[useAudioPlayer] Previous track failed to start; keeping current deck:', e);
    toDeck.pause();
    isSwitchingDeck = false;
    return;
  }

  const latestState = usePlayerStore.getState();
  if (
    latestState.currentTrack?.id !== state.currentTrack?.id ||
    latestState.queueIndex !== queueIndex ||
    latestState.queue[prevIdx]?.id !== prevTrack.id ||
    latestState.playToken !== state.playToken ||
    (state.isPlaying && !latestState.isPlaying)
  ) {
    toDeck.pause();
    isSwitchingDeck = false;
    if (!latestState.isPlaying) {
      fromDeck.pause();
      stopKeepAlive();
    } else if (
      latestState.currentTrack?.id !== state.currentTrack?.id ||
      latestState.playToken !== state.playToken
    ) {
      window.setTimeout(() => {
        const current = usePlayerStore.getState();
        if (current.isPlaying) usePlayerStore.setState({ playToken: Date.now() });
      }, 0);
    }
    return;
  }
  if (toDeck.paused) {
    isSwitchingDeck = false;
    return;
  }

  fromDeck.pause();
  fromDeck.currentTime = 0;

  activeDeck = activeDeck === 'A' ? 'B' : 'A';
  setActiveTrackId(prevTrack.id);

  syncMediaSession(prevTrack, true, toDeck);
  startKeepAlive();

  usePlayerStore.setState({
    currentTrack: prevTrack,
    queueIndex: prevIdx,
    isPlaying: true,
    currentTime: 0,
    seekTarget: 0,
    duration: prevTrack.duration || 0,
    playToken: Date.now(),
  });

  api.recordHistory(prevTrack).catch(() => {});
  isSwitchingDeck = false;
}

export function useAudioPlayer(enabled = true) {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const volume = usePlayerStore((state) => state.volume);
  const isMuted = usePlayerStore((state) => state.isMuted);
  const seekTarget = usePlayerStore((state) => state.seekTarget);
  const clearSeekTarget = usePlayerStore((state) => state.clearSeekTarget);
  const updateProgress = usePlayerStore((state) => state.updateProgress);
  const setPlaying = usePlayerStore((state) => state.setPlaying);
  const playToken = usePlayerStore((state) => state.playToken);
  const queue = usePlayerStore((state) => state.queue);
  const queueIndex = usePlayerStore((state) => state.queueIndex);

  const normalizeAudio = useSettingsStore(state => state.normalizeAudio);
  const equalizerEnabled = useSettingsStore((state) => state.equalizerEnabled);
  const equalizerBands = useSettingsStore((state) => state.equalizerBands);

  const hasPreloadedNextForCurrentRef = useRef<string | null>(null);
  const isInitialMountRef = useRef(true);
  const recoverySeekRef = useRef<number | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallPositionRef = useRef(0);
  const clearStall = () => {if(stallTimerRef.current!==null) clearTimeout(stallTimerRef.current);stallTimerRef.current=null;};
  const recoveryRef = useRef<ReturnType<typeof createPlaybackRecovery> | null>(null);
  if (!recoveryRef.current) recoveryRef.current=createPlaybackRecovery({get:usePlayerStore.getState,
    patch:p=>usePlayerStore.setState(p),online:()=>navigator.onLine!==false,invalidate:invalidateTelegramRecording});
  const recovery=recoveryRef.current;
  const failPlayback = (error: unknown, audio: HTMLAudioElement) => {
    const state=usePlayerStore.getState();
    clearStall();
    interruptListening('error');
    const failure=playbackFailure(error,audio);
    tracePlayback('failure',audio,state.currentTrack?.id,failure.code,audioContext?.state);
    const handled=recovery.fail(failure.code,failure.message,audio.currentTime || state.currentTime || 0,state.isPlaying);
    // Set paused before native pause dispatch so our own recovery does not cancel itself.
    if(!handled) usePlayerStore.setState({isPlaying:false,playbackNotice:null,playbackError:`${failure.message} [${failure.code}]`});
    audio.pause();stopKeepAlive();syncMediaSession(state.currentTrack,false,audio);
  };


  // Initialize dual decks and keep-alive audio listeners
  useEffect(() => {
    if (!enabled) return;
    recovery.reset();
    const { a, b } = ensureAudioElements();

    const attachDeckListeners = (deck: HTMLAudioElement, deckId: 'A' | 'B') => {
      const subscriptions: Array<() => void> = [];
      const listen = (event: string, handler: EventListener) => {
        deck.addEventListener(event, handler);
        subscriptions.push(() => deck.removeEventListener(event, handler));
      };

      listen('timeupdate', () => {
        if (activeDeck !== deckId) return;
        if (deck.paused && deck.currentTime === 0) return;

        const listeningState=usePlayerStore.getState();
        sampleListening(listeningState.currentTrack,listeningState.playToken,deck.currentTime,deck.duration || 0,!deck.paused);
        if(deck.currentTime>stallPositionRef.current+.1) clearStall();
        if(!deck.paused) recovery.healthy(listeningState.currentTrack?.id || '',deck.currentTime);
        updateProgress(deck.currentTime, deck.duration || 0);

        if (Math.floor(deck.currentTime) % 4 === 0) {
          syncMediaSession(usePlayerStore.getState().currentTrack, !deck.paused, deck);
        }


        const state = usePlayerStore.getState(), seconds = useSettingsStore.getState().crossfadeSeconds;
        const nextIndex = state.queueIndex + 1 < state.queue.length ? state.queueIndex + 1 : state.repeatMode === 'all' ? 0 : -1;
        const next = state.queue[nextIndex], standby = getStandbyAudio();
        const remaining = deck.duration - deck.currentTime;
        if (!isTelegramEnv() && seconds > 0 && state.isPlaying && state.repeatMode !== 'one'
          && (!state.isShuffle || next?.queued_next) && !fadeRequest && fadeTimer === null
          && (document.visibilityState === 'visible' || !!window.SpotyDesktop)
          && remaining > .2 && remaining <= seconds && deck.duration > seconds * 2 + 10
          && next && next.id !== state.currentTrack?.id && getStandbyTrackId() === next.id && standby && standby.readyState >= 3) {
          fadeRequest = { nextId: next.id, seconds: remaining };
          state.nextTrack('ended');
          return;
        }

        // Proactively prime standby deck and server cache 25s before end (ONCE per track)
        if (!isTelegramEnv() && deck.duration > 20 && deck.currentTime > deck.duration - 25) {
          const curId = usePlayerStore.getState().currentTrack?.id;
          if (curId && hasPreloadedNextForCurrentRef.current !== curId) {
            hasPreloadedNextForCurrentRef.current = curId;
            const state = usePlayerStore.getState();
            const nextIdx = state.queueIndex + 1 < state.queue.length ? state.queueIndex + 1 : 0;
            const nextTr = state.queue[nextIdx];
            if (nextTr && nextTr.id !== curId) {
              primeStandbyDeck(nextTr);
              api.preloadTrack(nextTr.id, `${nextTr.artist_name} - ${nextTr.title}`, nextTr.duration).catch(() => {});
            }
          }
        }


      });

      listen('loadedmetadata', () => {
        if (activeDeck !== deckId) return;
        if (deck.duration && !isNaN(deck.duration)) {
          const savedTime = recoverySeekRef.current ?? usePlayerStore.getState().currentTime;
          recoverySeekRef.current=null;
          if (savedTime > 0 && Math.abs(deck.currentTime - savedTime) > 0.5) {
            try {
              deck.currentTime = Math.min(savedTime, deck.duration);
            } catch (e) {}
          }
          updateProgress(savedTime > 0 ? savedTime : deck.currentTime, deck.duration);
          syncMediaSession(usePlayerStore.getState().currentTrack, !deck.paused, deck);
        }
      });

      for (const event of ['seeked', 'ratechange']) {
        listen(event, () => {
          if (activeDeck === deckId) syncMediaSession(usePlayerStore.getState().currentTrack, !deck.paused, deck);
        });
      }
      listen('durationchange', () => {
        if (activeDeck !== deckId) return;
        if (deck.duration && !isNaN(deck.duration)) {
          updateProgress(deck.currentTime, deck.duration);
          syncMediaSession(usePlayerStore.getState().currentTrack, !deck.paused, deck);
        }
      });

      listen('seeking', () => { if (activeDeck===deckId) {clearStall();interruptListening('seek');} });
      listen('ended', () => {
        if (activeDeck !== deckId) return;
        finishListening('ended');
        tracePlayback('ended', deck, getActiveTrackId() || undefined, 'none', audioContext?.state);
        isSwitchingDeck = false;
        hasTriggeredTransition = false;
        usePlayerStore.getState().nextTrack('ended');
      });

      listen('play', () => {
        if (activeDeck !== deckId) return;
        const listeningState=usePlayerStore.getState();
        sampleListening(listeningState.currentTrack,listeningState.playToken,deck.currentTime,deck.duration || 0,true);
        setPlaying(true);
        startKeepAlive();
        initEqualizerGraph(deck);
        syncMediaSession(usePlayerStore.getState().currentTrack, true, deck);
      });

      for (const event of ['waiting', 'stalled']) {
        listen(event, () => {
          if (activeDeck === deckId) interruptListening('waiting');
          if(activeDeck===deckId && deck.currentTime>0 && usePlayerStore.getState().isPlaying && stallTimerRef.current===null){
            const expected=usePlayerStore.getState();stallPositionRef.current=deck.currentTime;
            stallTimerRef.current=setTimeout(()=>{
              stallTimerRef.current=null;const now=usePlayerStore.getState();
              if(now.isPlaying && now.playToken===expected.playToken && now.playbackIntent===expected.playbackIntent && deck.currentTime<=stallPositionRef.current+.1)
                failPlayback({name:'TimeoutError'},deck);
            },20000);
          }
          if (activeDeck === deckId) tracePlayback(event, deck, getActiveTrackId() || undefined, 'none', audioContext?.state);
          if (activeDeck === deckId) syncMediaSession(usePlayerStore.getState().currentTrack, false, deck);
        });
      }

      listen('playing', () => {
        if (activeDeck !== deckId) return;
        clearStall();
        tracePlayback('playing', deck, getActiveTrackId() || undefined, 'none', audioContext?.state);
        setPlaying(true);
        startKeepAlive();
        initEqualizerGraph(deck);
        syncMediaSession(usePlayerStore.getState().currentTrack, true, deck);
      });

      listen('pause', () => {
        if (activeDeck !== deckId || !deck.paused) return;
        tracePlayback('pause', deck, getActiveTrackId() || undefined, 'none', audioContext?.state);
        if (hasTriggeredTransition || isSwitchingDeck || deck.ended) return;

        clearStall();
        if(usePlayerStore.getState().isPlaying) recovery.cancel();
        interruptListening('pause');
        setPlaying(false);
        stopKeepAlive();
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
        }
      });

      listen('error', () => {
        if (activeDeck !== deckId) return;
        isSwitchingDeck=false;hasTriggeredTransition=false;
        failPlayback(null,deck);
      });

      return () => subscriptions.forEach(remove => remove());
    };

    const detachA = attachDeckListeners(a, 'A');
    const detachB = attachDeckListeners(b, 'B');

    const registerMediaAction = (action: MediaSessionAction, handler: MediaSessionActionHandler) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch {}
    };
    const seekFromSystem = (position: number) => {
      const active = getActiveAudio();
      if (!active || !Number.isFinite(active.duration) || active.duration <= 0 || !Number.isFinite(position)) return;
      const target = Math.max(0, Math.min(position, active.duration));
      recovery.cancel();
      active.currentTime = target;
      usePlayerStore.setState({ currentTime: target, playbackIntent:usePlayerStore.getState().playbackIntent+1, recoveryPosition:null, playbackNotice:null });
      syncMediaSession(usePlayerStore.getState().currentTrack, !active.paused, active);
    };

    // Register lockscreen and Dynamic Island transport actions
    if ('mediaSession' in navigator) {
      registerMediaAction('play', () => {
        usePlayerStore.setState({playbackIntent:usePlayerStore.getState().playbackIntent+1});
        const active = getActiveAudio();
        if (active) {
          initEqualizerGraph(active);
          const requestedTrack = usePlayerStore.getState().currentTrack?.id;
          setPlaying(true);
          active.play().then(() => {
            const latest = usePlayerStore.getState();
            if (!latest.isPlaying || latest.currentTrack?.id !== requestedTrack || getActiveAudio() !== active) {
              if (getActiveAudio() === active) active.pause();
              return;
            }
            startKeepAlive();
            syncMediaSession(latest.currentTrack, true, active);
          }).catch((e) => {
            setPlaying(false); stopKeepAlive();
            syncMediaSession(usePlayerStore.getState().currentTrack, false, active);
            console.warn('[useAudioPlayer] MediaSession play failed:', e);
          });
        }
      });
      registerMediaAction('pause', () => {
        recovery.cancel();
        const active = getActiveAudio();
        if (active) active.pause();
        stopKeepAlive();
        setPlaying(false);
      });
      registerMediaAction('previoustrack', () => {
        usePlayerStore.getState().prevTrack();
      });
      registerMediaAction('nexttrack', () => {
        usePlayerStore.getState().nextTrack();
      });
      try {
        registerMediaAction('seekto', (details) => {
          if (details.seekTime !== undefined) seekFromSystem(details.seekTime);
        });
        registerMediaAction('seekbackward', (details) => {
          const active = getActiveAudio();
          if (active) seekFromSystem(active.currentTime - (details.seekOffset || 10));
        });
        registerMediaAction('seekforward', (details) => {
          const active = getActiveAudio();
          if (active) seekFromSystem(active.currentTime + (details.seekOffset || 10));
        });
        registerMediaAction('stop', () => {
          recovery.cancel();
          const active = getActiveAudio();
          if (active) active.pause();
          stopKeepAlive();
          setPlaying(false);
          syncMediaSession(usePlayerStore.getState().currentTrack, false, active);
        });
      } catch (e) {}
    }

    const resumeExpectedPlayback = () => {
      const { isPlaying, currentTrack, queue, queueIndex } = usePlayerStore.getState();
      if (currentTrack && isTelegramEnv()) void warmTelegramQueue(queue, queueIndex);
      const active = getActiveAudio();
      if (!active || !isPlaying || !currentTrack) return;

      initEqualizerGraph(active);
      if (active.ended) {
        usePlayerStore.getState().nextTrack();
        return;
      }

      if (active.paused) {
        active.play().then(() => {
          startKeepAlive();
          syncMediaSession(currentTrack, true, active);
        }).catch((e) => console.warn('Playback resume failed:', e));
      } else {
        startKeepAlive();
        syncMediaSession(currentTrack, true, active);
      }
    };

    const handleVisibilityChange = () => {
      const audio = getActiveAudio();
      if (audio) tracePlayback(document.visibilityState === 'visible' ? 'visible' : 'hidden', audio, getActiveTrackId() || undefined, 'none', audioContext?.state);
      if (document.visibilityState === 'visible') resumeExpectedPlayback();
      else if (isTelegramEnv()) {
        const state = usePlayerStore.getState();
        void warmTelegramQueue(state.queue, state.queueIndex);
      }
    };
    const telegramWebApp = (window as any).Telegram?.WebApp;
    const handleTelegramActivated = () => {
      if (telegramWebApp?.isActive !== false) resumeExpectedPlayback();
    };
    const handlePageShow = () => resumeExpectedPlayback();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', handlePageShow);
    window.addEventListener('online', handlePageShow);
    telegramWebApp?.onEvent?.('activated', handleTelegramActivated);

    // Global touch/tap unlocks background audio loop seamlessly
    const handleGlobalUserGesture = () => {
      if (usePlayerStore.getState().isPlaying) {
        startKeepAlive();
      }
    };
    window.addEventListener('click', handleGlobalUserGesture, { capture: true, passive: true });
    window.addEventListener('touchstart', handleGlobalUserGesture, { capture: true, passive: true });

    return () => {
      cancelCrossfade(); fadeRequest = null;
      for (const timer of gainTimers.values()) clearInterval(timer); gainTimers.clear();
      detachA();
      detachB();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', handlePageShow);
      window.removeEventListener('online', handlePageShow);
      telegramWebApp?.offEvent?.('activated', handleTelegramActivated);
      window.removeEventListener('click', handleGlobalUserGesture);
      window.removeEventListener('touchstart', handleGlobalUserGesture);
      if (deckA) {
        deckA.pause();
        deckA.src = '';
      }
      if (deckB) {
        deckB.pause();
        deckB.src = '';
      }
      stopKeepAlive();
      clearTelegramAudioBuffer();
      recovery.cancel();clearStall();
    };
  }, []);

  // Update Equalizer gains when state changes
  useEffect(() => {
    if (!enabled) return;
    if (equalizerEnabled) {
      if (deckA) initEqualizerGraph(deckA);
      if (deckB) initEqualizerGraph(deckB);
    }
    applyEqualizerGains(equalizerEnabled, equalizerBands);
  }, [equalizerEnabled, equalizerBands]);

  // Handle explicit track changes from user UI interactions
  useEffect(() => {
    if (!enabled) return;
    let active = getActiveAudio();
    if (!active || !currentTrack) return;

    clearStall();
    cancelCrossfade();
    const blend = fadeRequest?.nextId === currentTrack.id ? fadeRequest : null;
    fadeRequest = null;
    const outgoing = activeDeck;
    const request = ++playbackRequest;
    offlineLoading = false;
    usePlayerStore.setState({playbackError:null});

    hasPreloadedNextForCurrentRef.current = null;
    hasTriggeredTransition = false;



    const streamUrl = api.getStreamUrl(
      currentTrack.id,
      `${currentTrack.artist_name} - ${currentTrack.title}`,
      currentTrack.duration
    );
    const storedSource = offlineResolver?.(currentTrack.id)?.catch(() => undefined);
    const cachedStandby = getStandbyAudio();
    const offlinePrepared = !isTelegramEnv() && getStandbyTrackId() === currentTrack.id && cachedStandby?.src.startsWith('blob:') && cachedStandby.readyState >= 1;
    if (storedSource && !offlinePrepared) {
      offlineLoading = true;
      const selectedAudio = active;
      const offlineResume = usePlayerStore.getState().recoveryPosition;
      const offlinePosition = offlineResume ?? usePlayerStore.getState().currentTime;
      const preservePosition = offlineResume !== null || isInitialMountRef.current || !usePlayerStore.getState().isPlaying;
      recoverySeekRef.current = offlineResume;
      if (offlineResume !== null) usePlayerStore.setState({ recoveryPosition: null });
      hasTriggeredTransition = true; selectedAudio.pause();
      setActiveTrackId(currentTrack.id);
      void storedSource.then(url => {
        if (request !== playbackRequest) return;
        offlineLoading = false;
        selectedAudio.src = url || streamUrl;
        selectedAudio.currentTime = preservePosition ? offlinePosition : 0;
        selectedAudio.load(); applyDeckVolumes();
        hasTriggeredTransition = false;
        if (usePlayerStore.getState().isPlaying) {
          initEqualizerGraph(selectedAudio);
          void playWithDeadline(selectedAudio).catch(error => { if (request === playbackRequest) failPlayback(error, selectedAudio); });
        }
        isInitialMountRef.current = false;
      }).catch(error => { if (request === playbackRequest) { offlineLoading = false; hasTriggeredTransition = false; failPlayback(error, selectedAudio); } });
      return;
    }
    const standby = getStandbyAudio();
    const reuse = !isTelegramEnv() && getStandbyTrackId() === currentTrack.id && standby && (standby.src === new URL(streamUrl, window.location.origin).href || offlinePrepared) && standby.readyState >= 1;
    if (reuse && standby) {
      const previous = active;
      activeDeck = activeDeck === 'A' ? 'B' : 'A'; active = standby;
      if (blend && !previous.paused) { deckMix[activeDeck] = 0; fadeInitialSeek = true; fadeOutgoing = outgoing; }
      else previous.pause();
    } else active.src = (isTelegramEnv() ? bufferedTelegramSource(currentTrack.id) : undefined) || streamUrl;
    setActiveTrackId(currentTrack.id);
    applyDeckVolumes();
    tracePlayback('source', active, currentTrack.id, 'none', audioContext?.state);

    const resumePosition=usePlayerStore.getState().recoveryPosition;
    const savedTime = resumePosition ?? usePlayerStore.getState().currentTime;
    recoverySeekRef.current=resumePosition;
    if(resumePosition!==null) usePlayerStore.setState({recoveryPosition:null});
    if ((resumePosition!==null || isInitialMountRef.current) && savedTime > 0) {
      active.currentTime = savedTime;
    } else {
      active.currentTime = 0;
    }
    if (!reuse) active.load();

    syncMediaSession(currentTrack, isPlaying, active);

    if (isPlaying) {
      startKeepAlive();
      initEqualizerGraph(active);
      const playingAudio = active;
      playWithDeadline(active).then(() => {
        if (request !== playbackRequest || !usePlayerStore.getState().isPlaying) { if (blend) cancelCrossfade(); return; }
        if (blend && reuse) beginCrossfade(outgoing, blend.seconds);
      }).catch((err) => {
        if (request !== playbackRequest) return;
        cancelCrossfade();
        failPlayback(err,playingAudio);
        console.warn('Audio play deferred:', err);
      });
      if (!isInitialMountRef.current) {
        api.recordHistory(currentTrack).catch(() => {});
      }
    }

    isInitialMountRef.current = false;
  }, [currentTrack?.id, playToken]);

  // Queue edits update only upcoming preparation, never the active media source.
  useEffect(() => {
    if (!enabled || !currentTrack) return;
    if (isTelegramEnv()) {
      void warmTelegramQueue(queue, queueIndex);
    } else {
      const next = queue[(queueIndex + 1) % queue.length];
      if (next) {
        primeStandbyDeck(next);
        api.preloadTrack(next.id, `${next.artist_name} - ${next.title}`, next.duration).catch(() => {});
      }
    }
  }, [enabled, queue, queueIndex, currentTrack?.id, playToken]);

  // Handle play / pause state
  useEffect(() => {
    if (!enabled) return;
    const active = getActiveAudio();
    if (!active || !currentTrack) return;
    if (hasTriggeredTransition || isSwitchingDeck) return;

    if (isPlaying && active.paused) {
      const request = playbackRequest;
      initEqualizerGraph(active);
      playWithDeadline(active).catch((e) => {
        if (request !== playbackRequest) return;
        failPlayback(e,active);
        console.warn('Play interrupted:', e);
      });
      startKeepAlive();
      if (!isTelegramEnv() && fadeOutgoing === null) {
        const state = usePlayerStore.getState();
        const next = state.queue[state.queueIndex + 1] || (state.repeatMode === 'all' ? state.queue[0] : null);
        if (next && next.id !== currentTrack.id) primeStandbyDeck(next);
      }
    } else if (!isPlaying && !active.paused) {
      cancelCrossfade(); fadeRequest = null;
      active.pause();
      stopKeepAlive();
    }
    syncMediaSession(currentTrack, isPlaying, active);
  }, [isPlaying]);

  // Handle seeking
  useEffect(() => {
    if (!enabled) return;
    const active = getActiveAudio();
    if (!active || seekTarget === null) return;
    if (offlineLoading) { recoverySeekRef.current = seekTarget; clearSeekTarget(); return; }
    if (fadeInitialSeek && seekTarget === 0) fadeInitialSeek = false;
    else cancelCrossfade();

    try {
      if (active.duration && !isNaN(active.duration) && active.duration > 0) {
        active.currentTime = Math.min(seekTarget, active.duration);
      } else {
        active.currentTime = seekTarget;
      }
    } catch (e) {
      console.warn('Seek error:', e);
    }
    syncMediaSession(currentTrack, !active.paused, active);
    if (usePlayerStore.getState().isPlaying && active.paused) {
      const request = playbackRequest;
      active.play().catch(() => { if (request === playbackRequest) setPlaying(false); });
    }
    clearSeekTarget();
  }, [seekTarget]);

  // Handle volume & mute
  useEffect(() => {
    if (!enabled) return;
    applyDeckVolumes();
  }, [volume, isMuted, normalizeAudio]);

  return {
    audio: getActiveAudio(),
  };
}

export { syncMediaSession, computeEffectiveVolume, initEqualizerGraph, applyEqualizerGains };
