import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Loader2, FileText, Mic2, Compass } from 'lucide-react';
import { api } from '../../api/client';
import { usePlayerStore } from '../../store/playerStore';
import { parseLrc, activeLyricIndex } from './lyricsTiming';
import { useTelegram } from '../../hooks/useTelegram';

interface LyricsPanelProps {
  trackId: string;
  artist: string;
  title: string;
  duration?: number;
  className?: string;
  maxHeightClass?: string;
}

export const LyricsPanel: React.FC<LyricsPanelProps> = ({
  trackId,
  artist,
  title,
  duration = 0,
  className = '',
  maxHeightClass = 'max-h-[50vh]',
}) => {
  const [syncedRaw, setSyncedRaw] = useState<string | null>(null);
  const [plainRaw, setPlainRaw] = useState<string | null>(null);
  const [isSynced, setIsSynced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const currentTrackId=usePlayerStore(s=>s.currentTrack?.id);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const trackDuration = usePlayerStore((state) => state.duration) || duration;
  const seek = usePlayerStore((state) => state.seek);
  const { haptic } = useTelegram();

  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const manualScrollUntil=useRef(0);
  const requestDuration=Math.round((currentTrackId===trackId ? trackDuration : duration) || duration) || undefined;

  // Retry after the exact audio has started: a cold download may not exist at first lyric request.
  const recordingReady=currentTrackId===trackId && currentTime>0;

  useEffect(() => {
    let cancelled=false;
    setLoading(true);setSyncedRaw(null);setPlainRaw(null);setIsSynced(false);setError(false);
    manualScrollUntil.current=0;
    api.getLyrics(trackId,artist,title,requestDuration).then(data=>{
      if(cancelled)return;
      if(data.has_lyrics){setSyncedRaw(data.synced_lyrics);setPlainRaw(data.lyrics);setIsSynced(Boolean(data.is_synced && data.synced_lyrics));}
      setLoading(false);
    }).catch(()=>{if(!cancelled){setError(true);setLoading(false);}});
    return()=>{cancelled=true;};
  },[trackId,artist,title,requestDuration,recordingReady]);

  // Parse synchronized lines and LRC offset tag
  const { parsedLines, lrcOffset } = useMemo(() => {
    if (!isSynced || !syncedRaw) return { parsedLines: [], lrcOffset: 0 };
    const { lines, offsetSec } = parseLrc(syncedRaw);
    return { parsedLines: lines, lrcOffset: offsetSec };
  }, [isSynced, syncedRaw]);

  // Split plain text lines for non-synced fallback
  const plainLines = useMemo(() => {
    if (!plainRaw) return [];
    return plainRaw.split('\n');
  }, [plainRaw]);

  const timedLines=useMemo(()=>parsedLines.map(line=>({...line,time:line.time-lrcOffset})),[parsedLines,lrcOffset]);
  const activeIndex=isSynced ? activeLyricIndex(timedLines,currentTime) : -1;

  // Auto-scroll active line into view smoothly
  useEffect(() => {
    if (Date.now()<manualScrollUntil.current) return;
    if (activeIndex >= 0 && lineRefs.current[activeIndex] && containerRef.current) {
      const lineEl = lineRefs.current[activeIndex];
      const container = containerRef.current;
      if (!lineEl) return;
      // getBoundingClientRect gives position relative to viewport
      // We compare the line's position against the container's position
      const lineRect = lineEl.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      // Current position of the line relative to container top
      const lineRelativeTop = lineRect.top - containerRect.top;
      // We want to place the active line at ~30% from the container top
      const targetOffset = container.clientHeight * 0.30;
      // Adjust scroll by the difference
      const scrollAdjust = lineRelativeTop - targetOffset;
      container.scrollTo({
        top: container.scrollTop + scrollAdjust,
        behavior: 'smooth',
      });
    }
  }, [activeIndex]);

  const handleLineClick = (index:number) => {
    haptic.selection();
    seek(Math.max(0,timedLines[index].time));
  };

  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center h-48 gap-3 text-zinc-500 ${className}`}>
        <Loader2 size={26} className="animate-spin text-[#1DB954]" />
        <span className="text-xs font-medium text-zinc-400">Загружаем текст песни…</span>
      </div>
    );
  }

  if (error || (!syncedRaw && !plainRaw)) {
    return (
      <div className={`flex flex-col items-center justify-center h-48 gap-2 text-zinc-500 text-center px-4 ${className}`}>
        <FileText size={32} className="text-zinc-600 mb-1" />
        <span className="text-sm font-bold text-zinc-300">Текст песни недоступен</span>
        <span className="text-xs text-zinc-500">
          Для {title} слова пока не добавлены
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full w-full select-none ${className}`}>
      {/* ── Lyrics Header ── */}
      <div className="flex flex-wrap items-center justify-between pb-2 mb-1 px-1 border-b border-white/5 flex-shrink-0 gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#1DB954]">
          {isSynced ? (
            <>
              <Mic2 size={13} className="flex-shrink-0" />
              <span>ТЕКСТ ПЕСНИ</span>
            </>
          ) : (
            <>
              <Compass size={13} className="text-amber-400 flex-shrink-0" />
              <span className="text-amber-400">ТЕКСТ ПЕСНИ</span>
            </>
          )}
        </div>

      </div>
      {!isSynced && <p className="text-xs text-zinc-400 mb-3">Точная синхронизация пока недоступна. Текст можно прокручивать вручную.</p>}

      {/* ── Synchronized Karaoke Lyrics List ── */}
      {isSynced && parsedLines.length > 0 ? (
        <div
          ref={containerRef}
          onWheel={()=>{manualScrollUntil.current=Date.now()+6000;}}
          onTouchMove={()=>{manualScrollUntil.current=Date.now()+6000;}}
          style={{
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, black 10%, black 90%, rgba(0,0,0,0.6) 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, black 10%, black 90%, rgba(0,0,0,0.6) 100%)',
          }}
          className={`flex-1 min-h-0 overflow-y-auto no-scrollbar px-1 py-8 ${maxHeightClass}`}
        >
          <div className="flex flex-col gap-4">
            {parsedLines.map((line, idx) => {
              const isActive = idx === activeIndex;
              const isPast = idx < activeIndex;
              const distance = Math.abs(idx - activeIndex);

              if (!line.text) {
                return <div key={idx} className="h-2" />;
              }

              // Opacity based on distance from active line
              let opacity = 1;
              if (isPast) {
                opacity = Math.max(0.55, 0.8 - distance * 0.04);
              } else if (!isActive) {
                opacity = Math.max(0.65, 0.9 - distance * 0.04);
              }

              return (
                <p
                  key={idx}
                  ref={(el) => (lineRefs.current[idx] = el)}
                  onClick={() => handleLineClick(idx)}
                  style={{
                    opacity: isActive ? 1 : opacity,
                    transform: isActive ? 'scale(1.04) translateX(4px)' : 'scale(1) translateX(0px)',
                    transition: 'opacity 600ms cubic-bezier(0.4, 0, 0.2, 1), transform 500ms cubic-bezier(0.4, 0, 0.2, 1), color 500ms ease, text-shadow 500ms ease',
                    textShadow: isActive ? '0 0 20px rgba(29,185,84,0.4)' : 'none',
                    color: isActive ? '#ffffff' : isPast ? '#d4d4d8' : '#e4e4e7',
                    fontSize: '1.1rem',
                    fontWeight: isActive ? 700 : isPast ? 400 : 500,
                    lineHeight: '1.5',
                    cursor: 'pointer',
                    textAlign: 'left',
                    borderLeft: isActive ? '2px solid #1DB954' : '2px solid transparent',
                    paddingLeft: '10px',
                    borderRadius: '6px',
                    paddingTop: '2px',
                    paddingBottom: '2px',
                    background: isActive ? 'rgba(29,185,84,0.07)' : 'transparent',
                  }}
                >
                  {line.text}
                </p>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={`flex-1 min-h-0 overflow-y-auto px-1 py-4 ${maxHeightClass}`}>
          <div className="flex flex-col gap-3">{plainLines.map((line,i)=><p key={i} className="text-base text-zinc-200 leading-relaxed whitespace-pre-wrap">{line || '\u00A0'}</p>)}</div>
        </div>
      )}
    </div>
  );
};
