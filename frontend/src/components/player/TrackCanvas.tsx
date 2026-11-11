import React, { useEffect, useRef, useState } from 'react';
import { useUserStore } from '../../store/userStore';
import { useCanvasStore, readCanvas } from '../../store/trackCanvas';
import { useDecorativeHidden, useVisualMode } from '../../platform/visualPerformance';
import { useSettingsStore } from '../../store/settingsStore';
import { usePlayerStore } from '../../store/playerStore';
import { clearRemoteCanvas, remoteCanvas } from '../../services/remoteCanvas';

export function useTrackCanvas(trackId: string | undefined, active: boolean) {
  const owner = useUserStore(s => s.user?.telegram_id), enabled = useCanvasStore(s => s.enabled);
  const revision = useCanvasStore(s => s.revision), settingsOpen = useSettingsStore(s => s.isSettingsOpen);
  const hidden = useDecorativeHidden(), mode = useVisualMode();
  const [source, setSource] = useState<{ owner: number; trackId: string; url: string }>();
  useEffect(() => { clearRemoteCanvas(owner); }, [owner]);
  useEffect(() => {
    if (!owner || owner === 999999999 || !trackId || !active || !enabled || settingsOpen) return;
    let cancelled = false, url: string | undefined, timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    let ready = false, loading = false;
    const show = (blob: Blob) => {
      if (cancelled) return;
      url = URL.createObjectURL(blob); setSource({ owner, trackId, url });
    };
    const maybeLoad = () => {
      const state = usePlayerStore.getState();
      if (!state.isPlaying || state.currentTime <= 0) { clearTimeout(timer); timer = undefined; return; }
      if (!ready || cancelled || url || loading || timer || hidden || mode === 'economy') return;
      timer = setTimeout(() => {
        timer = undefined; loading = true;
        void remoteCanvas(owner, trackId, controller.signal).then(blob => { if (blob) show(blob); });
      }, 1500);
    };
    const unsubscribe = usePlayerStore.subscribe(maybeLoad);
    void (async () => {
      const clip = await readCanvas(String(owner), trackId).catch(() => undefined);
      if (cancelled) return;
      if (clip) { show(clip.blob); return; }
      ready = true; maybeLoad();
    })();
    return () => { cancelled = true; unsubscribe(); clearTimeout(timer); controller.abort(); if (url) URL.revokeObjectURL(url); setSource(undefined); };
  }, [owner, trackId, active, enabled, revision, settingsOpen, hidden, mode]);
  return enabled && active && !settingsOpen && source && source.owner === owner && source.trackId === trackId ? source.url : undefined;
}

export function TrackCanvas({ src, cover, title, playing, fullscreen = false, children }: { src: string; cover: string; title: string; playing: boolean; fullscreen?: boolean; children?: React.ReactNode }) {
  const video = useRef<HTMLVideoElement>(null), root = useRef<HTMLDivElement>(null);
  const hidden = useDecorativeHidden(), mode = useVisualMode();
  const [visible, setVisible] = useState(true), [failed, setFailed] = useState(false);
  const animate = visible && !hidden && mode !== 'economy' && !failed;
  useEffect(() => { setFailed(false); }, [src]);
  useEffect(() => {
    if (!root.current) return;
    const observer = new IntersectionObserver(entries => setVisible(entries[0]?.isIntersecting || false));
    observer.observe(root.current); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = video.current;
    if (!element || !animate) return;
    let cancelled = false;
    element.muted = true; element.volume = 0;
    if (playing) void element.play().catch(error => {
      if (!cancelled && error?.name !== 'AbortError') setFailed(true);
    }); else element.pause();
    return () => { cancelled = true; element.pause(); };
  }, [src, playing, animate]);
  return <div ref={root} data-testid="track-canvas" className={`relative isolate overflow-hidden bg-[#141414] ${fullscreen ? 'aspect-[9/16] mx-auto rounded-2xl shadow-xl w-[min(230px,22vh)] max-h-[39vh]' : 'w-full h-[clamp(280px,58dvh,560px)]'}`}>
    <img src={cover || '/placeholder.png'} alt={title} className="absolute inset-0 w-full h-full object-cover" />
    {animate && <video key={src} ref={video} src={src} muted loop playsInline preload="metadata" poster={cover} onLoadedMetadata={e => {
      const v = e.currentTarget;
      if (!Number.isFinite(v.duration) || v.duration < 2.8 || v.duration > 8.5 || v.videoWidth > 1920 || v.videoHeight > 1920) setFailed(true);
    }} onError={() => setFailed(true)} disablePictureInPicture className="absolute inset-0 w-full h-full object-cover" aria-label={`Canvas: ${title}`} />}
    {children}
  </div>;
}
