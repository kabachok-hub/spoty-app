import { useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useSettingsStore } from '../store/settingsStore';
import { api, apiClient } from '../api/client';
import { Track } from '../api/types';
import { syncMediaSession, computeEffectiveVolume, initEqualizerGraph, applyEqualizerGains } from './useAudioPlayer';

type Segment = {id:string; index:number; start:number; end?:number; duration:number; offset:number};

export function useContinuousPlayer(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const audio = document.createElement('audio');
    audio.id = 'spoty-continuous-audio';
    audio.setAttribute('playsinline', 'true');
    audio.preload = 'auto';
    document.body.appendChild(audio);
    let version = 0;
    let token = '';
    let preparing = false;
    let internal = false;
    let timeline: Segment[] = [];
    let tracks: Track[] = [];
    let polling = false;
    let disposed = false;

    const update = (patch: Parameters<typeof usePlayerStore.setState>[0]) => {
      internal = true;
      usePlayerStore.setState(patch);
      internal = false;
    };
    const synchronize = () => {
      const segment = [...timeline].reverse().find(item => item.start <= audio.currentTime);
      if (!segment) return;
      const track = tracks[segment.index];
      if (!track) return;
      const position = Math.min(segment.duration, Math.max(0, segment.offset + audio.currentTime - segment.start));
      const state = usePlayerStore.getState();
      const index = state.queue.findIndex(item => item.id === track.id);
      const changed = state.currentTrack?.id !== track.id;
      update({currentTrack: track, queueIndex: index >= 0 ? index : state.queueIndex,
        currentTime: position, duration: segment.duration});
      const media = {duration:segment.duration,currentTime:position,playbackRate:audio.playbackRate,
        paused:audio.paused,ended:audio.ended,readyState:audio.readyState} as HTMLAudioElement;
      syncMediaSession(track, !audio.paused && !audio.ended, media);
      if (changed) api.recordHistory(track).catch(() => {});
    };
    const refreshTimeline = async () => {
      if (!token || polling || disposed) return;
      const requested = token;
      polling = true;
      try {
        const {data} = await apiClient.get('/stream/session/' + requested + '/status');
        if (token === requested && !disposed) { timeline = data.timeline; synchronize(); }
      } catch {} finally { polling = false; }
    };
    const play = () => {
      initEqualizerGraph(audio);
      const request = version;
      audio.play().then(() => {
        if (request !== version) return;
        if (!usePlayerStore.getState().isPlaying) { audio.pause(); return; }
        synchronize();
      }).catch(() => {
        if (request === version) { update({isPlaying:false}); synchronize(); }
      });
    };
    const start = async (offset = 0) => {
      const state = usePlayerStore.getState();
      if (!state.currentTrack) return;
      const request = ++version;
      preparing = true;
      update({playbackError:null});
      audio.pause();
      token = ''; timeline = [];
      const index = Math.max(0,state.queue.findIndex(item => item.id === state.currentTrack!.id));
      let ordered = state.queue.length ? state.queue.slice(index) : [state.currentTrack];
      if (state.repeatMode === 'all') ordered = ordered.concat(state.queue.slice(0,index));
      if (state.repeatMode === 'one') ordered = Array.from({length:30},() => state.currentTrack!);
      if (state.isShuffle && ordered.length > 1) {
        const rest = ordered.slice(1);
        for (let i=rest.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [rest[i],rest[j]]=[rest[j],rest[i]]; }
        ordered = [ordered[0],...rest];
      }
      try {
        const {data} = await apiClient.post('/stream/session', {
          tracks: ordered.slice(0,50).map(t=>({id:t.id,title:t.title,artist_name:t.artist_name,duration:t.duration || 0})),
          offset,
        });
        if (request !== version || disposed) return;
        tracks = ordered.slice(0,50); token = data.token;
        audio.src = data.stream_url;
        preparing = false;
        audio.load();
        if (usePlayerStore.getState().isPlaying) play();
        void refreshTimeline();
      } catch (error) {
        if (request === version) {
          preparing = false; update({isPlaying:false,playbackError:'Не удалось подготовить музыку. Проверьте подключение и повторите запуск.'});
          syncMediaSession(state.currentTrack,false);
          console.warn('Continuous playback could not start:',error);
        }
      }
    };
    const onPlaying = () => { if (!usePlayerStore.getState().isPlaying) {audio.pause();return;} synchronize(); };
    const onPause = () => { if (!preparing) { update({isPlaying:false}); synchronize(); } };
    const onEnded = () => { synchronize(); usePlayerStore.getState().nextTrack(); };
    const onError = () => {
      if (preparing) return;
      update({isPlaying:false,playbackError:'Аудиопоток прерван. Нажмите «Повторить», чтобы продолжить.'});
      syncMediaSession(usePlayerStore.getState().currentTrack,false);
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshTimeline(); };
    audio.addEventListener('timeupdate',synchronize);
    audio.addEventListener('playing',onPlaying);
    audio.addEventListener('pause',onPause);
    audio.addEventListener('ended',onEnded);
    audio.addEventListener('error',onError);
    document.addEventListener('visibilitychange',onVisible);
    const tg = (window as any).Telegram?.WebApp;
    tg?.onEvent?.('activated',refreshTimeline);

    const register = (name:MediaSessionAction, handler:MediaSessionActionHandler) => {
      try { navigator.mediaSession?.setActionHandler(name,handler); } catch {}
    };
    const seek = (position:number) => {
      const state = usePlayerStore.getState();
      update({currentTime:Math.max(0,Math.min(position,state.duration)),seekTarget:null});
      void start(Math.max(0,Math.min(position,state.duration)));
    };
    register('play',()=>{update({isPlaying:true});if(token && !audio.error) play();else void start(usePlayerStore.getState().currentTime);});
    register('pause',()=>{update({isPlaying:false});audio.pause();synchronize();});
    register('nexttrack',()=>usePlayerStore.getState().nextTrack());
    register('previoustrack',()=>usePlayerStore.getState().prevTrack());
    register('seekto',d=>{if(d.seekTime !== undefined) seek(d.seekTime);});
    register('seekbackward',d=>seek(usePlayerStore.getState().currentTime-(d.seekOffset||10)));
    register('seekforward',d=>seek(usePlayerStore.getState().currentTime+(d.seekOffset||10)));
    register('stop',()=>{update({isPlaying:false});audio.pause();synchronize();});

    const unsubscribe = usePlayerStore.subscribe((state,previous) => {
      if (internal) return;
      audio.volume = computeEffectiveVolume(state.volume,state.isMuted);
      if (state.currentTrack?.id !== previous.currentTrack?.id || state.playToken !== previous.playToken ||
          state.isShuffle !== previous.isShuffle || state.repeatMode !== previous.repeatMode) {
        update({seekTarget:null});
        void start(state.currentTime);
      } else if (state.seekTarget !== null && state.seekTarget !== previous.seekTarget) {
        seek(state.seekTarget);
      } else if (state.isPlaying !== previous.isPlaying) {
        if (state.isPlaying) { if (!preparing) {if(token && !audio.error) play();else void start(state.currentTime);} }
        else {audio.pause();synchronize();}
      }
    });
    const settingsUnsubscribe = useSettingsStore.subscribe(state=>{
      initEqualizerGraph(audio);
      applyEqualizerGains(state.equalizerEnabled,state.equalizerBands);
    });
    const initial = usePlayerStore.getState();
    audio.volume = computeEffectiveVolume(initial.volume,initial.isMuted);
    if (initial.currentTrack && initial.isPlaying) void start(initial.currentTime);
    const interval = window.setInterval(()=>{if(document.visibilityState==='visible') void refreshTimeline();},2000);
    return () => {
      disposed = true; version++; preparing=true;
      unsubscribe();settingsUnsubscribe();window.clearInterval(interval);
      document.removeEventListener('visibilitychange',onVisible);tg?.offEvent?.('activated',refreshTimeline);
      audio.pause();audio.removeAttribute('src');audio.load();audio.remove();
      for (const action of ['play','pause','nexttrack','previoustrack','seekto','seekbackward','seekforward','stop'] as MediaSessionAction[]) {
        try {navigator.mediaSession?.setActionHandler(action,null);} catch {}
      }
    };
  },[enabled]);
}
