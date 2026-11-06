const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const track=(id)=>({id,title:id,artist_name:'Artist',duration:20});
let state={currentTrack:track('1'),queue:[track('1'),track('2'),track('3')],queueIndex:0,isPlaying:true,currentTime:0,seekTarget:null,volume:1,isMuted:false,repeatMode:'all',isShuffle:false,playToken:1,duration:20};
const listeners=new Set(),actions=new Map(),requests=[];
const store={getState:()=>state,setState:patch=>{const prev=state;state={...state,...patch};listeners.forEach(fn=>fn(state,prev));},subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
class Audio {
 constructor(){this.events=new Map();this.paused=true;this.ended=false;this.currentTime=0;this.duration=Infinity;this.playbackRate=1;this.readyState=4;}
 addEventListener(n,fn){this.events.set(n,fn);}
 setAttribute(){}
 removeAttribute(){}
 remove(){}
 load(){}
 pause(){const was=this.paused;this.paused=true;if(!was)this.events.get('pause')?.();}
 play(){this.paused=false;this.events.get('playing')?.();return Promise.resolve();}
}
const audio=new Audio();
let posts=0,cleanup;
const apiClient={
 post:async(url,payload)=>{requests.push(payload);return {data:{token:'token'+(++posts),stream_url:'/stream/'+posts}};},
 get:async()=>({data:{timeline:[{id:'1',index:0,start:0,duration:20,offset:0},{id:'2',index:1,start:20,duration:20,offset:0},{id:'3',index:2,start:40,duration:20,offset:0}],failed:[],done:false}}),
};
const modules={
 react:{useEffect:fn=>{cleanup=fn();}},
 '../store/playerStore':{usePlayerStore:store},
 '../store/settingsStore':{useSettingsStore:{subscribe:()=>()=>{}}},
 '../api/client':{apiClient,api:{recordHistory:async()=>{}}},
 './useAudioPlayer':{syncMediaSession:()=>{},computeEffectiveVolume:()=>.5,initEqualizerGraph:()=>{},applyEqualizerGains:()=>{}},
};
const context={exports:{},require:n=>{if(!modules[n])throw Error(n);return modules[n];},
 document:{createElement:()=>audio,body:{appendChild:()=>{}},addEventListener:()=>{},removeEventListener:()=>{},visibilityState:'visible'},
 window:{setInterval:()=>1,clearInterval:()=>{}},navigator:{mediaSession:{setActionHandler:(n,fn)=>actions.set(n,fn)}},console,Math};
vm.createContext(context);
vm.runInContext(ts.transpileModule(fs.readFileSync('src/hooks/useContinuousPlayer.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
const flush=()=>new Promise(setImmediate);
(async()=>{
 context.exports.useContinuousPlayer(true);await flush();await flush();
 assert.equal(posts,1);assert.equal(audio.paused,false);
 const source=audio.src;
 audio.currentTime=25;audio.events.get('timeupdate')();await flush();
 assert.equal(state.currentTrack.id,'2');assert.equal(state.queueIndex,1);assert.equal(state.currentTime,5);
 assert.equal(audio.src,source);assert.equal(posts,1,'automatic boundary must never reload source');
 actions.get('pause')();assert.equal(state.isPlaying,false);assert.equal(audio.paused,true);
 actions.get('play')();await flush();assert.equal(audio.paused,false);assert.equal(posts,1);
 actions.get('seekto')({seekTime:10});await flush();await flush();
 assert.equal(posts,2);assert.equal(requests.at(-1).offset,10);assert.equal(requests.at(-1).tracks[0].id,'2');
 audio.error={code:2};
 actions.get('play')();await flush();await flush();
 assert.equal(posts,3,'resuming a broken stream must create a new session');
 cleanup();assert.equal(listeners.size,0);
 console.log('Continuous player checks passed: 3-track timeline, no source switch, pause/resume, seek and cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1;});
