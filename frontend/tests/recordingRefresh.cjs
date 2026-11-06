const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(path,modules={}){const c={exports:{},require:n=>{if(!(n in modules))throw Error(n);return modules[n];},console,Date,Map,Set,
 localStorage:{getItem:()=>null,setItem(){}},window:{innerWidth:1280,addEventListener(){}},document:{visibilityState:'visible'},setTimeout:()=>0};vm.createContext(c);
 vm.runInContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,c);return c.exports;}
function create(factory){let state;const get=()=>state,set=p=>{state={...state,...(typeof p==='function'?p(state):p)};};
 state=factory(set,get);const hook=s=>s(state);hook.getState=get;hook.setState=set;return hook;}
const preferences=load('src/store/recommendationPreferences.ts');
let resolve,calls=0;const api={refreshTrack:()=>{calls++;return new Promise(r=>resolve=r);}};
const {usePlayerStore:store}=load('src/store/playerStore.ts',{'zustand':{create},'../hooks/listeningFeedback':{finishListening(){},interruptListening(){}},'../services/autoplay':{planContinuation:async()=>[]},'../api/client':{api},'./recommendationPreferences':preferences});
const versions=load('src/hooks/recordingVersions.ts');const invalidated=[];
const {refreshRecording}=load('src/hooks/refreshRecording.ts',{'../api/client':{api},'../store/playerStore':{usePlayerStore:store},
 './telegramAudioBuffer':{invalidateTelegramRecording:id=>invalidated.push(id)},'./recordingVersions':versions});
const tracks=[1,2,3,4,5].map(id=>({id:String(id),title:'Song '+id,artist_name:'Artist',duration:100}));
const reset=()=>store.setState({queue:tracks,currentTrack:tracks[1],queueIndex:1,currentTime:22,playToken:7,isPlaying:true,
 isShuffle:false,repeatMode:'off',seekTarget:null,activeMix:null,playbackError:null});
(async()=>{
 reset();const first=refreshRecording(tracks[1]);assert.equal(refreshRecording(tracks[1]),first);assert.equal(calls,1);
 assert(versions.isRecordingRefreshing('2'));store.setState({isPlaying:false});resolve({status:'ok'});await first;
 assert.equal(store.getState().isPlaying,false,'refresh must respect a pause during the request');
 assert.equal(store.getState().currentTime,0);assert(store.getState().playToken>7);assert(versions.recordingVersion('2')>0);
 assert.equal(versions.recordingVersion('3'),0);assert(!versions.isRecordingRefreshing('2'));
 assert.deepEqual(invalidated,['2','2']);
 reset();const next=refreshRecording(tracks[1]);store.setState({currentTrack:tracks[2],queueIndex:2,playToken:8,currentTime:31});
 resolve({status:'ok'});await next;assert.equal(store.getState().currentTrack.id,'3');assert.equal(store.getState().playToken,8);assert.equal(store.getState().currentTime,31);
 reset();const returned=refreshRecording(tracks[1]);store.setState({playToken:9,currentTime:44});resolve({status:'ok'});await returned;
 assert.equal(store.getState().currentTime,44,'leaving and returning to the same track must invalidate the old request');
 reset();const failed=refreshRecording(tracks[1]);resolve({status:'error'});await assert.rejects(failed,/Не удалось/);
 assert.equal(store.getState().playToken,7);assert.equal(store.getState().currentTime,22);assert(store.getState().playbackError);
 assert(!versions.isRecordingRefreshing('2'));
 // Insertion keeps the active element's trigger/time and honours explicit order even in shuffle.
 reset();store.setState({isShuffle:true});store.getState().playNext(tracks[4]);
 assert.deepEqual(Array.from(store.getState().queue,t=>t.id),['1','2','5','3','4','5']);
 assert.equal(store.getState().currentTrack.id,'2');assert.equal(store.getState().currentTime,22);assert.equal(store.getState().playToken,7);
 store.getState().nextTrack();assert.equal(store.getState().currentTrack.id,'5');assert.equal(store.getState().queueIndex,2);
 assert.equal(store.getState().queue[2].queued_next,false);
 reset();store.setState({queueIndex:4,currentTrack:tracks[4]});store.getState().playNext(tracks[0]);store.getState().nextTrack();assert.equal(store.getState().queueIndex,5);
 reset();store.setState({repeatMode:'one'});store.getState().playNext(tracks[4]);store.getState().nextTrack();
 assert.equal(store.getState().currentTrack.id,'2');assert(store.getState().queue[2].queued_next);
 reset();store.getState().playNext(tracks[1]);store.getState().nextTrack();assert.equal(store.getState().queueIndex,2,'duplicate IDs are valid queue occurrences');
 store.getState().setQueue(store.getState().queue,2,{id:'mix',query:'Seed',type:'mix'});
 assert.equal(store.getState().queueIndex,2,'clicking a repeated occurrence must not jump to the first matching ID');
 reset();store.getState().addToQueue(tracks[0]);assert.equal(store.getState().queue.at(-1).id,'1','append remains a separate action');
 store.setState({queue:[],currentTrack:null});store.getState().playNext(tracks[0]);assert.equal(store.getState().currentTrack.id,'1');
 console.log('Recording refresh and play-next checks passed: shared request, pause, stale completions, failure, revisions, queue position, shuffle, repeat and duplicate IDs.');
})().catch(e=>{console.error(e);process.exitCode=1;});
