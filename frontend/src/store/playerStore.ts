import { finishListening, interruptListening } from '../hooks/listeningFeedback';
import { create } from 'zustand';
import { planContinuation } from '../services/autoplay';
import { Track } from '../api/types';
import { api } from '../api/client';
import { isHiddenTrack, isAutomaticMix } from './recommendationPreferences';

// Shared by the prefetch hook and the exhausted-queue recovery path.
let queueGeneration = 0;
const continuationJobs = new Map<number, Promise<void>>();
export function ensureAutoplay(): Promise<void> {
  const initial = usePlayerStore.getState();
  if (!initial.currentTrack || initial.repeatMode !== 'off') return Promise.resolve();
  const generation = queueGeneration;
  const existing = continuationJobs.get(generation);
  if (existing) return existing;
  const job = (async () => {
    try {
      const result = await planContinuation(initial.currentTrack!, initial.queue, initial.activeMix);
      const state = usePlayerStore.getState();
      if (generation !== queueGeneration || state.repeatMode !== 'off') return;
      const ids = new Set(state.queue.map(t => t.id));
      const fresh = result.filter(t => !ids.has(t.id) && !isHiddenTrack(t) && ids.add(t.id));
      if (fresh.length) {
        const trim = Math.max(0, state.queueIndex - 200);
        usePlayerStore.setState({ queue: [...state.queue.slice(trim), ...fresh], queueIndex: state.queueIndex - trim });
        if (state.autoplayPending) {
          usePlayerStore.setState({ autoplayPending: false });
          usePlayerStore.getState().nextTrack('neutral');
        }
        savePlayerState(usePlayerStore.getState());
      } else if (state.autoplayPending) {
        usePlayerStore.setState({ autoplayPending: false, playbackError: 'Пока не удалось подобрать продолжение. Выберите другой микс или повторите запуск.' });
      }
    } catch {
      if (generation === queueGeneration && usePlayerStore.getState().autoplayPending) {
        usePlayerStore.setState({ autoplayPending: false, playbackError: 'Не удалось загрузить продолжение. Проверьте соединение и выберите следующий микс.' });
      }
    }
  })().finally(() => continuationJobs.delete(generation));
  continuationJobs.set(generation, job);
  return job;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface ActiveMixContext {
  id: string;
  title: string;
  title_en?: string;
  query: string;
  type?: string;
  fallbackQuery?: string;
  subqueryIndex?: number;
  visitedMixIds?: string[];
  nextMix?: {
    id: string;
    title: string;
    title_en?: string;
    subtitle?: string;
    cover_url?: string;
    query?: string;
    banner_color?: string;
    banner_text?: string;
  } | null;
}

interface PlayerState {
  playbackIntent: number;
  playbackNotice: string | null;
  recoveryPosition: number | null;
  playedTrackIds: string[];
  autoplayPending: boolean;
  playbackError: string | null;
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  queue: Track[];
  queueIndex: number;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  isFullscreen: boolean;
  isQueueOpen: boolean;
  isNowPlayingOpen: boolean;
  seekTarget: number | null; // Trigger for audio element to seek
  activeContextUri: string | null;
  activeMix: ActiveMixContext | null;
  playToken: number;

  // Actions
  playTrack: (
    track: Track,
    newQueue?: Track[],
    contextUri?: string,
    mixContext?: ActiveMixContext | null
  ) => void;
  setActiveContextUri: (uri: string | null) => void;
  setActiveMix: (mix: ActiveMixContext | null) => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  pause: () => void;
  seek: (seconds: number) => void;
  clearSeekTarget: () => void;
  nextTrack: (reason?: unknown) => void;
  prevTrack: () => void;
  setQueue: (
    queue: Track[],
    startIndex?: number,
    mixContext?: ActiveMixContext | null
  ) => void;
  addToQueue: (track: Track) => void;
  playNext: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  pruneDislikedRecommendations: () => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  setFullscreen: (open: boolean) => void;
  setQueueOpen: (open: boolean) => void;
  setNowPlayingOpen: (open: boolean) => void;
  toggleNowPlaying: () => void;
  updateProgress: (currentTime: number, duration: number) => void;
}

const STORAGE_KEY = 'spotify_player_state_v1';

interface SavedPlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  activeContextUri: string | null;
  activeMix?: ActiveMixContext | null;
}

const getInitialVolume = (): number => {
  try {
    const saved = localStorage.getItem('spotify_volume');
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1.5) {
        return parsed;
      }
    }
  } catch (e) {}
  return 0.5; // 50% comfortable default
};

const loadSavedState = (): Partial<SavedPlayerState> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        return data;
      }
    }
  } catch (e) {
    console.warn('Failed to load saved player state:', e);
  }
  return {};
};

const savePlayerState = (state: PlayerState) => {
  try {
    const toSave: SavedPlayerState = {
      currentTrack: state.currentTrack,
      queue: state.queue,
      queueIndex: state.queueIndex,
      currentTime: state.currentTime,
      duration: state.duration,
      volume: state.volume,
      isMuted: state.isMuted,
      repeatMode: state.repeatMode,
      isShuffle: state.isShuffle,
      activeContextUri: state.activeContextUri,
      activeMix: state.activeMix,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    localStorage.setItem('spotify_volume', String(state.volume));
  } catch (e) {}
};

const savedState = loadSavedState();
let lastProgressSaveTs = 0;

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: savedState.currentTrack || null,
  isPlaying: false, // Always start paused on reopen
  currentTime: savedState.currentTime || 0,
  duration: savedState.duration || 0,
  volume: typeof savedState.volume === 'number' ? savedState.volume : getInitialVolume(),
  isMuted: savedState.isMuted || false,
  queue: Array.isArray(savedState.queue) ? savedState.queue : [],
  queueIndex: typeof savedState.queueIndex === 'number' ? savedState.queueIndex : -1,
  isShuffle: savedState.isShuffle || false,
  repeatMode: savedState.repeatMode || 'off',
  isFullscreen: false,
  activeContextUri: savedState.activeContextUri || null,
  activeMix: savedState.activeMix || null,
  isQueueOpen: false,
  isNowPlayingOpen: typeof window !== 'undefined' && window.innerWidth >= 768 && !!savedState.currentTrack,
  seekTarget: savedState.currentTime && savedState.currentTime > 0 ? savedState.currentTime : null,
  playToken: 0,
  playbackError: null,
  playbackIntent: 0, playbackNotice: null, recoveryPosition: null,
  autoplayPending: false,
  playedTrackIds: savedState.currentTrack ? [savedState.currentTrack.id] : [],

  setActiveContextUri: (uri: string | null) => {
    set({ activeContextUri: uri });
    savePlayerState(get());
  },

  setActiveMix: (mix: ActiveMixContext | null) => {
    set({ activeMix: mix });
    savePlayerState(get());
  },

  playTrack: (
    track: Track,
    newQueue?: Track[],
    contextUri?: string,
    mixContext?: ActiveMixContext | null
  ) => {
    const state = get();
    set({playbackIntent:state.playbackIntent+1,recoveryPosition:null,playbackNotice:null});
    queueGeneration++;
    if (isAutomaticMix(mixContext)) {
      if (isHiddenTrack(track)) return;
      newQueue = newQueue?.filter(t => !isHiddenTrack(t));
    }
    let queue = state.queue;
    let queueIndex = state.queueIndex;

    if (newQueue && newQueue.length > 0) {
      queue = newQueue;
      queueIndex = queue.findIndex((t) => t.id === track.id);
      if (queueIndex === -1) queueIndex = 0;
    } else {
      // Find or append in current queue
      const existingIdx = queue.findIndex((t) => t.id === track.id);
      if (existingIdx !== -1) {
        queueIndex = existingIdx;
      } else {
        queue = [...queue, track];
        queueIndex = queue.length - 1;
      }
    }

    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

    let nextMixContext = state.activeMix;
    if (mixContext !== undefined) {
      nextMixContext = mixContext;
    } else if (newQueue && newQueue.length > 0) {
      if (contextUri && state.activeMix && contextUri === state.activeMix.id) {
        nextMixContext = state.activeMix;
      } else {
        nextMixContext = null;
      }
    }

    finishListening(state.isPlaying && !state.playbackError && track.id !== state.currentTrack?.id ? 'manual' : 'neutral');
    if (newQueue && nextMixContext) queue = queue.map(t => ({ ...t, playback_context: nextMixContext! }));
    set({
      autoplayPending: false, playbackError: null,
      playedTrackIds: [track.id],
      currentTrack: { ...track, ...(nextMixContext ? { playback_context: nextMixContext } : {}) },
      queue,
      queueIndex,
      activeContextUri: contextUri !== undefined ? contextUri : state.activeContextUri,
      activeMix: nextMixContext,
      isPlaying: true,
      currentTime: 0,
      seekTarget: 0,
      duration: track.duration || 0,
      playToken: Date.now(),
      // Automatically slide out Now Playing card on desktop
      ...(isDesktop ? { isNowPlayingOpen: true } : {}),
    });
    savePlayerState(get());

    // Proactively fill queue if 4 or fewer tracks so mobile background playback never runs dry
    if (queue.length <= 4) {
      setTimeout(() => {
        void ensureAutoplay();
      }, 50);
    }
  },

  togglePlay: () => {
    set({playbackIntent:get().playbackIntent+1,recoveryPosition:null,playbackNotice:null});
    const { isPlaying, currentTrack, queue } = get();
    if (!currentTrack && queue.length > 0) {
      get().playTrack(queue[0]);
      return;
    }
    const nextPlaying = !isPlaying;
    if (!nextPlaying) interruptListening('pause');
    set({ isPlaying: nextPlaying, autoplayPending: false });
    savePlayerState(get());
  },

  setPlaying: (playing: boolean) => {
    if (!playing) interruptListening('pause');
    set({ isPlaying: playing, ...(playing ? {} : { autoplayPending: false }) });
    savePlayerState(get());
  },

  pause: () => {
    interruptListening('pause');
    set({playbackIntent:get().playbackIntent+1,recoveryPosition:null,playbackNotice:null});
    set({ isPlaying: false, autoplayPending: false });
    savePlayerState(get());
  },

  seek: (seconds: number) => {
    interruptListening('seek');
    set({playbackIntent:get().playbackIntent+1,recoveryPosition:null,playbackNotice:null});
    set({ seekTarget: seconds, currentTime: seconds });
    savePlayerState(get());
  },

  clearSeekTarget: () => set({ seekTarget: null }),

  nextTrack: (reason = 'manual') => {
    if(reason!=='ended' && reason!=='neutral') set({playbackIntent:get().playbackIntent+1,recoveryPosition:null,playbackNotice:null});
    const { queue, queueIndex, isShuffle, repeatMode } = get();
    if (queue.length === 0) return;

    if (repeatMode === 'one') {
      // Repeat current track from start
      set({ seekTarget: 0, currentTime: 0, isPlaying: true });
      savePlayerState(get());
      return;
    }

    finishListening(reason === 'ended' ? 'ended' : reason === 'neutral' || !get().isPlaying ? 'neutral' : 'manual');
    let nextIndex: number;
    if (queue[queueIndex + 1]?.queued_next) {
      nextIndex = queueIndex + 1;
    } else if (isShuffle) {
      const state = get();
      const played = new Set([...state.playedTrackIds, state.currentTrack?.id]);
      let candidates = queue.map((t, i) => ({t, i})).filter(({t}) => !played.has(t.id));
      // Finish the current mix before shuffling inside the prepared next mix.
      const sameContext = candidates.filter(({t}) => (t.playback_context?.id || state.activeMix?.id) === state.activeMix?.id);
      if (sameContext.length) candidates = sameContext;
      else if (candidates.length) {
        const nextContext = candidates[0].t.playback_context?.id;
        candidates = candidates.filter(({t}) => t.playback_context?.id === nextContext);
      }
      if (!candidates.length) {
        if (repeatMode === 'all') {
          set({ playedTrackIds: [] });
          candidates = queue.map((t, i) => ({t, i}));
        } else {
          set({ isPlaying: false, autoplayPending: true });
          void ensureAutoplay();
          return;
        }
      }
      nextIndex = candidates[Math.floor(Math.random() * candidates.length)].i;
    } else {
      nextIndex = queueIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeatMode === 'all') {
          nextIndex = 0;
        } else {
          // Never replay the queue implicitly. Resume only if the listener has not paused.
          set({ isPlaying: false, autoplayPending: true });
          void ensureAutoplay();
          return;
        }
      }
    }

    const nextTrack = queue[nextIndex];
    if (nextTrack) {
      const selected = { ...nextTrack, queued_next: false };
      set({
        autoplayPending: false, playbackError: null,
        ...(nextTrack.playback_context ? { activeMix: nextTrack.playback_context, activeContextUri: nextTrack.playback_context.id } : {}),
        playedTrackIds: [...new Set([...get().playedTrackIds, selected.id])].slice(-300),
        currentTrack: selected,
        queue: queue.map((track, index) => index === nextIndex ? selected : track),
        queueIndex: nextIndex,
        isPlaying: true,
        currentTime: 0,
        seekTarget: 0,
        duration: nextTrack.duration || 0,
        playToken: Date.now(),
      });
      savePlayerState(get());
    }
  },

  prevTrack: () => {
    set({playbackIntent:get().playbackIntent+1,recoveryPosition:null,playbackNotice:null});
    const { queue, queueIndex, currentTime } = get();
    if (queue.length === 0) return;

    // If more than 3 seconds into the track, restart it
    if (currentTime > 3) {
      set({ seekTarget: 0, currentTime: 0 });
      savePlayerState(get());
      return;
    }

    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }

    const prevTrack = queue[prevIndex];
    if (prevTrack) {
      finishListening('neutral');
      set({
        autoplayPending: false,
        ...(prevTrack.playback_context ? { activeMix: prevTrack.playback_context, activeContextUri: prevTrack.playback_context.id } : {}),
        currentTrack: prevTrack,
        queueIndex: prevIndex,
        isPlaying: true,
        currentTime: 0,
        seekTarget: 0,
        duration: prevTrack.duration || 0,
        playToken: Date.now(),
      });
      savePlayerState(get());
    }
  },

  setQueue: (
    queue: Track[],
    startIndex: number = 0,
    mixContext?: ActiveMixContext | null
  ) => {
    set({playbackIntent:get().playbackIntent+1,recoveryPosition:null,playbackNotice:null});
    queueGeneration++;
    if (isAutomaticMix(mixContext)) {
      const preceding = queue.slice(0, startIndex).filter(t => !isHiddenTrack(t)).length;
      queue = queue.filter(t => !isHiddenTrack(t));
      startIndex = Math.max(0, Math.min(preceding, queue.length - 1));
    }
    if (queue[startIndex]?.queued_next) {
      queue = queue.map((track, index) => index === startIndex ? { ...track, queued_next: false } : track);
    }
    const nextMixContext = mixContext !== undefined ? mixContext : null;
    if (nextMixContext) queue = queue.map(t => ({ ...t, playback_context: nextMixContext }));
    const track = queue[startIndex] || null;
    if (track) finishListening(get().isPlaying && !get().playbackError && track.id !== get().currentTrack?.id ? 'manual' : 'neutral');
    set({
      autoplayPending: false, playbackError: null,
      queue,
      playedTrackIds: track ? [track.id] : [],
      queueIndex: startIndex,
      currentTrack: track ? { ...track } : null,
      activeMix: nextMixContext,
      isPlaying: track !== null,
      currentTime: 0,
      seekTarget: 0,
      duration: track?.duration || 0,
      playToken: Date.now(),
    });
    savePlayerState(get());

    if (queue.length <= 4 && track) {
      setTimeout(() => {
        void ensureAutoplay();
      }, 50);
    }
  },

  addToQueue: (track: Track) => {
    if (track.recommended_automatically && isHiddenTrack(track)) return;
    const { queue } = get();
    set({ queue: [...queue, track] });
    savePlayerState(get());
  },

  playNext: (track: Track) => {
    if (track.recommended_automatically && isHiddenTrack(track)) return;
    const state = get();
    if (!state.currentTrack) {
      get().playTrack(track, [track]);
      return;
    }
    const queue = [...state.queue];
    let index = state.queueIndex;
    if (queue[index]?.id !== state.currentTrack.id) index = queue.findIndex(t => t.id === state.currentTrack!.id);
    if (index < 0 || queue.length === 0) {
      queue.unshift(state.currentTrack);
      index = 0;
    }
    queue.splice(index + 1, 0, { ...track, queued_next: true });
    set({ queue, queueIndex: index });
    savePlayerState(get());
  },

  pruneDislikedRecommendations: () => {
    const state = get();
    const automatic = isAutomaticMix(state.activeMix);
    const queue = state.queue.filter(t => !(automatic || t.recommended_automatically) || !isHiddenTrack(t));
    if (queue.length === state.queue.length) return;
    const currentIndex = queue.findIndex(t => t.id === state.currentTrack?.id);
    if (currentIndex >= 0) {
      set({ queue, queueIndex: currentIndex });
    } else {
      const next = state.queue.slice(state.queueIndex + 1).find(t => queue.some(q => q.id === t.id)) || queue[0] || null;
      if (!next) {
        // Keep paused metadata so the existing audio hook can stop the native element.
        set({ queue: [], queueIndex: 0, isPlaying: false });
      } else set({ queue, currentTrack: next, queueIndex: Math.max(0, queue.findIndex(t => t.id === next.id)),
        isPlaying: state.isPlaying, currentTime: 0, seekTarget: 0,
        duration: next.duration || 0, playToken: Date.now() });
    }
    savePlayerState(get());
  },

  removeFromQueue: (index: number) => {
    set({playbackIntent:get().playbackIntent+1,recoveryPosition:null,playbackNotice:null});
    queueGeneration++;
    const { queue, queueIndex } = get();
    const newQueue = queue.filter((_, i) => i !== index);
    let newIndex = queueIndex;
    if (index < queueIndex) {
      newIndex--;
    } else if (index === queueIndex && newQueue.length > 0) {
      newIndex = Math.min(queueIndex, newQueue.length - 1);
    }
    set({
      autoplayPending: false,
      queue: newQueue,
      queueIndex: newIndex,
      currentTrack: newQueue[newIndex] || null,
    });
    savePlayerState(get());
  },

  toggleShuffle: () => {
    set((state) => ({ isShuffle: !state.isShuffle }));
    savePlayerState(get());
  },

  cycleRepeatMode: () => {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const currentMode = get().repeatMode;
    const nextIdx = (modes.indexOf(currentMode) + 1) % modes.length;
    set({ repeatMode: modes[nextIdx] });
    savePlayerState(get());
  },

  setVolume: (vol: number) => {
    const normalized = Math.max(0, Math.min(1.5, Math.round(vol * 100) / 100));
    try {
      localStorage.setItem('spotify_volume', String(normalized));
    } catch (e) {}
    set({ volume: normalized, isMuted: normalized === 0 });
    savePlayerState(get());
  },

  toggleMute: () => {
    set((state) => ({ isMuted: !state.isMuted }));
    savePlayerState(get());
  },

  setFullscreen: (open: boolean) => set({ isFullscreen: open }),

  setQueueOpen: (open: boolean) => set({ isQueueOpen: open }),

  setNowPlayingOpen: (open: boolean) => set({ isNowPlayingOpen: open }),

  toggleNowPlaying: () => set((state) => ({ isNowPlayingOpen: !state.isNowPlayingOpen })),

  updateProgress: (currentTime: number, duration: number) => {
    set({ currentTime, duration: duration || get().duration });
    const now = Date.now();
    if (now - lastProgressSaveTs > 2000) {
      lastProgressSaveTs = now;
      savePlayerState(get());
    }
  },
}));

// Automatic sync on window close / page hide / tab switch
if (typeof window !== 'undefined') {
  const syncNow = () => {
    try {
      savePlayerState(usePlayerStore.getState());
    } catch (e) {}
  };
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      syncNow();
    }
  });
  window.addEventListener('pagehide', syncNow);
  window.addEventListener('beforeunload', syncNow);
}
