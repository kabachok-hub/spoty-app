const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const tracks=[1,2,3].map(id=>({id:String(id),title:'Track '+id,artist_name:'Test',duration:10}));
const telegram = process.argv.includes('--telegram');
const warmed=[];
const lifecycle=new Map();
function listen(name,fn){if(!lifecycle.has(name))lifecycle.set(name,new Set());lifecycle.get(name).add(fn);}
function unlisten(name,fn){lifecycle.get(name)?.delete(fn);}
const source = id => telegram && id !== '1' ? 'blob:prepared-'+id : 'https://audio.test/'+id;
let state={queue:tracks,queueIndex:0,currentTrack:tracks[0],currentTime:0,duration:10,isPlaying:true,playToken:1,volume:1,isMuted:false,seekTarget:null,repeatMode:'all',isShuffle:false,playbackIntent:0,recoveryPosition:null,playedTrackIds:[]};
let effects=[],refs=[],pending=[],effectIndex=0,refIndex=0,scheduled=false;
function change(patch){state={...state,...patch};if(!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;render();});}}
Object.assign(state,{
 setPlaying:v=>change({isPlaying:v}),
 updateProgress:(time,duration)=>change({currentTime:time,duration}),
 clearSeekTarget:()=>change({seekTarget:null}),
 nextTrack:()=>{
  if(state.repeatMode==='one'){change({seekTarget:0,currentTime:0,isPlaying:true});return;}
  const index=(state.queueIndex+1)%tracks.length;
  change({currentTrack:tracks[index],queueIndex:index,currentTime:0,seekTarget:0,isPlaying:true,playToken:state.playToken+1});
 },
});
const store=selector=>selector(state);store.getState=()=>state;store.setState=change;
const registry=new Map();
class Audio{
 constructor(){this.listeners=new Map();this.style={};this.paused=true;this.ended=false;this.currentTime=0;this.duration=10;this.readyState=4;this.playbackRate=1;this.src='';}
 addEventListener(n,f){if(!this.listeners.has(n))this.listeners.set(n,new Set());this.listeners.get(n).add(f);}
 removeEventListener(n,f){this.listeners.get(n)?.delete(f);}
 emit(n){for(const f of [...(this.listeners.get(n)||[])])f({});}
 setAttribute(){}
 play(){this.paused=false;this.ended=false;this.emit('play');this.emit('playing');return Promise.resolve();}
 pause(){const was=this.paused;this.paused=true;if(!was)this.emit('pause');}
 load(){this.currentTime=0;this.ended=false;queueMicrotask(()=>this.emit('loadedmetadata'));}
 finish(){this.currentTime=10;this.paused=true;this.ended=true;this.emit('timeupdate');this.emit('ended');}
}
const document={getElementById:id=>registry.get(id),createElement:()=>new Audio(),body:{appendChild:a=>registry.set(a.id,a)},visibilityState:'visible',addEventListener:(n,f)=>listen('document:'+n,f),removeEventListener:(n,f)=>unlisten('document:'+n,f)};
const settings=selector=>selector({equalizerEnabled:false,equalizerBands:[0,0,0,0,0]});settings.getState=()=>({equalizerEnabled:false});
const recoveryContext={exports:{},setTimeout,clearTimeout,Date,Set};vm.createContext(recoveryContext);vm.runInContext(ts.transpileModule(fs.readFileSync('src/hooks/playbackRecovery.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,recoveryContext);
const modules={
 './playbackRecovery':recoveryContext.exports,
 './listeningFeedback':{sampleListening(){},interruptListening(){},finishListening(){}},
 react:{useRef:value=>{const i=refIndex++;return refs[i]||(refs[i]={current:value});},
 useEffect:(fn,deps)=>{const i=effectIndex++;const old=effects[i];if(!old || deps.some((d,j)=>d!==old.deps[j]))pending.push(()=>{old?.cleanup?.();effects[i]={fn,deps,cleanup:fn()};});}},
 '../store/playerStore':{usePlayerStore:store},'../store/settingsStore':{useSettingsStore:settings},
 '../api/client':{api:{getStreamUrl:id=>'https://audio.test/'+id,preloadTrack:async()=>{},recordHistory:async()=>{}}},
 './silent_uri':{SILENT_MP3_URI:'data:audio/mpeg;base64,'},
 './playbackDiagnostics':{tracePlayback(){},playbackFailure:()=>({code:'source',message:'Полная запись недоступна'})},
 './telegramAudioBuffer':{bufferedTelegramSource:id=>id!=='1'?source(id):undefined,warmTelegramQueue:async(queue,index)=>{warmed.push({queue,index});},clearTelegramAudioBuffer(){},invalidateTelegramRecording(){}},
};
const context={exports:{},require:n=>modules[n]||{},document,navigator:{userAgent:telegram?'Telegram Android':'Browser'},window:{location:{origin:'https://audio.test',search:''},addEventListener:(n,f)=>listen('window:'+n,f),removeEventListener:(n,f)=>unlisten('window:'+n,f),setTimeout},console,setTimeout,clearTimeout,URL,WeakMap,DOMException};
vm.createContext(context);
vm.runInContext(ts.transpileModule(fs.readFileSync('src/hooks/useAudioPlayer.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
function render(){effectIndex=0;refIndex=0;context.exports.useAudioPlayer();const tasks=pending;pending=[];tasks.forEach(fn=>fn());}
const flush=()=>new Promise(setImmediate);
(async()=>{
 render();await flush();await flush();
 const audio=registry.get('spotify-deck-a');
 assert.equal(state.currentTrack.id,'1');assert.equal(audio.paused,false);
 if(process.argv.includes('--recovery')){
  audio.currentTime=4;audio.emit('timeupdate');audio.emit('error');await flush();
  assert.equal(state.isPlaying,false);assert(state.playbackNotice);
  await new Promise(r=>setTimeout(r,750));await flush();await flush();
  assert.equal(state.currentTrack.id,'1');assert.equal(audio.paused,false);assert.equal(audio.currentTime,4,'Retry restores media position');
  audio.emit('error');await flush();await new Promise(r=>setTimeout(r,350));await flush();await flush();
  assert.equal(state.currentTrack.id,'2');assert.equal(audio.paused,false);
  effects.forEach(e=>e?.cleanup?.());console.log('Real audio hook recovery passed: native error → retry at4s → next queue song, no permanent stall.');return;
 }

 audio.finish();await flush();await flush();
 assert.equal(state.currentTrack.id,'2');assert.equal(audio.src,source('2'));assert.equal(audio.paused,false);
 audio.finish();await flush();await flush();
 assert.equal(state.currentTrack.id,'3');assert.equal(audio.src,source('3'));assert.equal(audio.paused,false);
 change({repeatMode:'one'});await flush();
 audio.finish();await flush();await flush();
 assert.equal(state.currentTrack.id,'3');assert.equal(audio.currentTime,0);assert.equal(audio.paused,false);
 audio.currentTime=4;change({isPlaying:false});await flush();assert.equal(audio.paused,true);
 change({isPlaying:true});await flush();assert.equal(audio.paused,false);assert.equal(audio.currentTime,4);
 const originalSource=audio.src;
 change({queue:[...state.queue.slice(0,state.queueIndex+1),{id:'new',title:'Next',artist_name:'Test',duration:10},...state.queue.slice(state.queueIndex+1)]});
 await flush();await flush();
 assert.equal(audio.src,originalSource,'queue edits must not reload the active source');
 assert.equal(audio.currentTime,4,'queue edits must retain playback position');
 if(telegram) assert.equal(warmed.at(-1).queue[warmed.at(-1).index+1].id,'new','new next track must enter background preparation');
 if(telegram){
  const beforeOnline=warmed.length;
  for(const handler of lifecycle.get('window:online')||[])handler();await flush();
  assert.equal(warmed.length,beforeOnline+1,'connectivity recovery must retry preparation');
  document.visibilityState='hidden';
  for(const handler of lifecycle.get('document:visibilitychange')||[])handler();await flush();
  assert.equal(warmed.length,beforeOnline+2,'screen locking must recheck upcoming buffers');
  assert.equal(audio.src,originalSource);assert.equal(audio.currentTime,4);
  document.visibilityState='visible';
 }
 // React StrictMode runs cleanup/setup twice. It must not accumulate native listeners.
 const setups=effects.map(e=>e?.fn);
 effects.forEach(e=>e?.cleanup?.());
 effects=effects.map((e,i)=>({...e,cleanup:setups[i]?.()}));
 await flush();await flush();
 assert.equal(audio.listeners.get('ended').size,1);
 assert.equal(audio.listeners.get('playing').size,1);
 audio.emit('error');await flush();assert.equal(state.isPlaying,false);assert(state.playbackNotice || state.playbackError);
 const app=fs.readFileSync('src/App.tsx','utf8');
 assert(!app.includes('useContinuousPlayer('),'experimental transport must be disabled');
 console.log('Playback regression checks passed: 1 -> 2 -> 3, repeat-one, pause/resume, StrictMode cleanup and Mini App rollback.');
 effects.forEach(e=>e?.cleanup?.());
})().catch(e=>{console.error(e);process.exitCode=1;});
