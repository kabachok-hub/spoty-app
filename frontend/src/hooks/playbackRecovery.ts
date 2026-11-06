import type { Track } from '../api/types';
export type RecoveryState = {currentTrack: Track | null; queue: Track[]; queueIndex: number; playToken: number; playbackIntent: number; repeatMode: string; playedTrackIds: string[]; isShuffle: boolean};
export function createPlaybackRecovery(deps: {get:()=>RecoveryState; patch:(p:any)=>void; online:()=>boolean; invalidate:(id:string)=>void; schedule?:(fn:()=>void,ms:number)=>any; cancelTimer?:(id:any)=>void}) {
  let timer:any, intent=-1, cancelled=false;
  const retries=new Set<string>(),failed=new Set<string>(),handled=new Set<string>();
  let healthy: {id:string;position:number;at:number}|null=null;
  const clear=()=>{if(timer!==undefined)(deps.cancelTimer || clearTimeout)(timer);timer=undefined;};
  const sync=()=>{const value=deps.get().playbackIntent;if(value!==intent){clear();intent=value;cancelled=false;retries.clear();failed.clear();handled.clear();healthy=null;}};
  return {
    cancel(){clear();cancelled=true;},
    reset(){clear();intent=-1;cancelled=false;},
    healthy(id:string,position:number,at=Date.now()){
      sync();
      if(!healthy || healthy.id!==id || position<healthy.position){healthy={id,position,at};return;}
      if(position-healthy.position>=5 && at-healthy.at>=4000) failed.clear();
    },
    fail(code:string,message:string,position:number,wasPlaying:boolean){
      sync();const state=deps.get(), track=state.currentTrack;
      if(!track) return false;
      const key=track.id+':'+state.playToken;
      if(handled.has(key)) return true;
      if(!wasPlaying || cancelled || !deps.online() || !['source','network','decode','timeout'].includes(code)) return false; // Native error + rejected play promise are one failure.
      handled.add(key);if(handled.size>40)handled.delete(handled.values().next().value!);
      const retry=!retries.has(track.id);
      const expectedIntent=intent, token=state.playToken;
      const notice=retry ? `Повторяем загрузку «${track.title}»…` : `«${track.title}» недоступен — включаем следующий трек.`;
      if(!retry && failed.size>=2){deps.patch({isPlaying:false,playbackNotice:null,playbackError:'Не удалось загрузить три трека подряд. Воспроизведение остановлено: проверьте соединение или выберите другую подборку.'});return true;}
      if(!retry && state.repeatMode==='one') return false;
      deps.patch({isPlaying:false,playbackError:null,playbackNotice:notice});
      clear();timer=(deps.schedule || setTimeout)(()=>{
        timer=undefined;const latest=deps.get();
        if(cancelled || latest.playbackIntent!==expectedIntent || latest.currentTrack?.id!==track.id || latest.playToken!==token) return;
        if(!deps.online()){deps.patch({isPlaying:false,playbackNotice:null,playbackError:'Нет соединения. Воспроизведение остановлено; повторите после восстановления сети.'});return;}
        if(retry){
          retries.add(track.id);if(retries.size>50)retries.delete(retries.values().next().value!);deps.invalidate(track.id);
          deps.patch({isPlaying:true,playbackError:null,currentTime:Math.max(0,position),recoveryPosition:Math.max(0,position),playToken:Math.max(Date.now(),token+1)});
          return;
        }
        failed.add(track.id);
        const played=new Set(latest.playedTrackIds || []);
        const choices=latest.queue.map((t,i)=>({t,i})).filter(({t,i})=>!failed.has(t.id) && t.id!==track.id && (latest.isShuffle ? !played.has(t.id) : i>latest.queueIndex));
        const next=choices[0];
        if(!next){deps.patch({isPlaying:false,playbackNotice:null,playbackError:'Не удалось загрузить оставшиеся треки. Выберите другую подборку или повторите позже.'});return;}
        deps.patch({currentTrack:{...next.t,queued_next:false},queueIndex:next.i,isPlaying:true,currentTime:0,seekTarget:0,recoveryPosition:null,
          duration:next.t.duration || 0,playToken:Math.max(Date.now(),token+1),playbackError:null,
          playedTrackIds:[...new Set([...played,track.id,next.t.id])].slice(-300),
          ...(next.t.playback_context ? {activeMix:next.t.playback_context,activeContextUri:next.t.playback_context.id}: {})});
      },retry ? 600 : 250);
      return true;
    }
  };
}
