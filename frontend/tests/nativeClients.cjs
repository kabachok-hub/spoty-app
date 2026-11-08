const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
function load(path, modules, globals={}) {
  const context = {exports:{},require:name=>{if(!(name in modules))throw Error('Missing '+name);return modules[name];},console,Map,Set,Date,Math,Promise,JSON,setTimeout,clearTimeout,Event,...globals};
  vm.createContext(context);vm.runInContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React}}).outputText,context);return context.exports;
}
const flush=()=>new Promise(setImmediate);
(async()=>{
  const stored=new Map(),local={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)};
  let native=false,vault=null,changed=false;
  const auth=load('src/platform/authStorage.ts',{'./nativeBridge':{isNativeClient:()=>native,nativeCall:async(command,data)=>{
    if(command==='vaultSet'){vault=data.token;return {accountChanged:changed};}if(command==='vaultGet')return {token:vault};if(command==='vaultClear')vault=null;return {};
  }}},{localStorage:local,window:{dispatchEvent(){}}});
  await auth.writeAuthToken('browser');assert.equal(await auth.readAuthToken(),'browser');
  native=true;await auth.writeAuthToken('native');assert.equal(stored.has('spotify_auth_token'),false);assert.equal(await auth.readAuthToken(),'native');
  stored.set('spotify_player_state_v1','old queue');changed=true;await auth.writeAuthToken('different account');assert.equal(stored.has('spotify_player_state_v1'),false);
  await auth.clearAuthToken();assert.equal(vault,null);

  // Use the actual bridge to verify error handling, out-of-order replies and native events.
  const messages=[],host={postMessage:raw=>messages.push(JSON.parse(raw))},events=[];
  const bridge=load('src/platform/nativeBridge.ts',{}, {window:{SpotyAndroid:host,dispatchEvent:e=>events.push(e.type)}});
  const first=bridge.nativeCall('vaultGet'),second=bridge.nativeCall('vaultSet');
  host.onmessage({data:JSON.stringify({id:messages[1].id,result:{ok:2}})});
  host.onmessage({data:JSON.stringify({id:messages[0].id,result:{ok:1}})});
  assert.equal((await first).ok,1);assert.equal((await second).ok,2);
  const failed=bridge.nativeCall('sync');host.onmessage({data:JSON.stringify({id:messages[2].id,error:true})});await assert.rejects(failed);
  host.onmessage({data:'malformed'});host.onmessage({data:JSON.stringify({event:'toggle-play'})});assert.deepEqual(events,['spoty-toggle-play']);
  host.onmessage({data:JSON.stringify({event:'visibility',hidden:true})});assert.equal(bridge.isHostHidden(),true);
  host.onmessage({data:JSON.stringify({event:'visibility',hidden:false})});assert.equal(bridge.isHostHidden(),false);
  assert.equal(events.filter(name=>name==='spoty-host-visibility').length,2);

  let effect,receive,subscribeResolve,cleanup;const commands=[],subscribers=new Set();
  const a={id:'a',title:'A',artist_name:'Artist',duration:120},b={id:'b',title:'B',artist_name:'Artist',duration:130};
  let state={queue:[a,b],queueIndex:0,currentTrack:a,currentTime:0,duration:120,isPlaying:false,playToken:0,seekTarget:null,repeatMode:'off',isShuffle:false,volume:.5,isMuted:false,playedTrackIds:[]};
  const store={getState:()=>state,setState:patch=>{const before=state;state={...state,...patch};for(const fn of subscribers)fn(state,before);},subscribe:fn=>{subscribers.add(fn);return()=>subscribers.delete(fn);}};
  const runtime=load('src/platform/NativeAudioRuntime.tsx',{'../store/mixTuning':{useMixTuning:{getState:()=>({novelty:70,diversity:50}),subscribe:()=>()=>{}}},'react':{useEffect:fn=>effect=fn},'../api/client':{api:{getStreamUrl:id=>'https://audio/'+id}},'../store/playerStore':{usePlayerStore:store},'../store/settingsStore':{useSettingsStore:{getState:()=>({equalizerEnabled:false,equalizerBands:[0,0,0,0,0]}),subscribe:()=>()=>{}}},'./nativeBridge':{
    listenNativeState:fn=>{receive=fn;return()=>{};},nativeCall:(command,data)=>{commands.push({command,data});if(command==='subscribe')return new Promise(r=>subscribeResolve=r);return Promise.resolve({});}
  }});
  runtime.NativeAudioRuntime();cleanup=effect();
  const nativeQueue=[{occurrenceId:'one',track:a,url:'https://audio/a'},{occurrenceId:'two',track:b,url:'https://audio/b'}];
  subscribeResolve({queue:nativeQueue,occurrenceId:'two',position:37,duration:130,playWhenReady:true,playToken:42});await flush();
  assert.equal(state.currentTrack.id,'b');assert.equal(state.currentTime,37);assert.equal(state.playToken,42);
  let sync=commands.filter(c=>c.command==='sync').at(-1).data;assert.equal(sync.index,1);assert.equal(sync.playing,true);assert.equal(sync.position,37);
  const before=commands.length;
  receive({clientId:sync.clientId,revision:sync.revision,occurrenceId:'two',position:40,playWhenReady:true,playToken:42});
  assert.equal(commands.length,before,'native progress must not echo back into a restart');
  store.setState({isPlaying:false});sync=commands.filter(c=>c.command==='sync').at(-1).data;
  receive({clientId:sync.clientId,revision:sync.revision-1,occurrenceId:'one',position:0,playWhenReady:true,playToken:41});
  assert.equal(state.isPlaying,false,'late native state must not undo manual pause');assert.equal(state.currentTrack.id,'b');
  store.setState({queue:[a,{...a},b],queueIndex:2});sync=commands.filter(c=>c.command==='sync').at(-1).data;
  assert.equal(new Set(sync.queue.map(e=>e.occurrenceId)).size,3,'duplicate recordings need distinct occurrences');
  assert.equal(sync.queue[2].occurrenceId,'two','upcoming edits keep active occurrence');assert.equal(sync.playToken,42);
  const count=commands.length;cleanup();store.setState({isPlaying:true});assert.equal(commands.length,count,'cleanup detaches UI without stopping native service');
  console.log('Native client checks passed: encrypted-host token routing, account reset, bridge correlation/errors, native hydration, no progress echo, pause race, duplicates, queue edits and cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1;});
