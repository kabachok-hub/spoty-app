import type { Track } from '../api/types';
export type ListeningEvent = { event_id: string; track_id: string; outcome: 'completed' | 'early_skip'; heard_seconds: number; duration: number };
let report: ((event: ListeningEvent) => void) | null = null;
let session: { key: string; id: string; eventId: string; heard: number; ranges: [number,number][]; duration: number; position: number; at: number; running: boolean; negative: boolean; failed: boolean; sent: boolean } | null = null;
let sequence = 0;
export function configureListeningFeedback(reporter: typeof report) { report=reporter; session=null; }
export function sampleListening(track: Track | null, token: number, position: number, duration: number, running: boolean, at=Date.now()) {
  if (!report || !track || !Number.isFinite(position) || !Number.isFinite(duration)) return;
  const key=track.id+':'+token;
  if (!session || session.key!==key) session={key,id:track.id,eventId:Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)+'_'+sequence++,heard:0,ranges:[],duration,position,at,running,negative:true,failed:false,sent:false};
  const s=session, delta=position-s.position, elapsed=Math.max(0,(at-s.at)/1000);
  if (s.running && delta>0 && delta<=elapsed+1) {
    const ranges=[...s.ranges,[Math.max(0,s.position),position] as [number,number]].sort((a,b)=>a[0]-b[0]);
    const merged: [number,number][]=[];
    for (const range of ranges) {
      const last=merged[merged.length-1];
      if (last && range[0]<=last[1]) last[1]=Math.max(last[1],range[1]);
      else merged.push([...range]);
    }
    s.ranges=merged.slice(0,128);
    s.heard=s.ranges.reduce((total,[a,b])=>total+b-a,0);
  }
  else if (delta<0 || delta>elapsed+1) s.negative=false; // A seek is not an early rejection.
  s.position=position; s.at=at; s.running=running; s.duration=duration;
}
export function interruptListening(kind: 'pause' | 'seek' | 'waiting' | 'error') {
  if (!session) return;
  session.negative=false; session.running=false;
  if (kind==='error') session.failed=true;
}
export function finishListening(reason: 'manual' | 'ended' | 'neutral') {
  const s=session;
  if (!s || s.sent || s.failed || s.duration<45 || s.duration>7200) return;
  const completed=s.heard>=s.duration*.85;
  const early=reason==='manual' && s.running && s.negative && s.heard>=3 && s.heard<=Math.min(20,s.duration*.2);
  s.sent=true; s.running=false;
  if (!completed && !early) return;
  try { report?.({event_id:s.eventId,track_id:s.id,outcome:completed?'completed':'early_skip',heard_seconds:Math.min(s.heard,s.duration),duration:s.duration}); } catch { /* Feedback never blocks audio. */ }
}
