const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function create(factory){let state;const get=()=>state;const set=patch=>{state={...state,...(typeof patch==='function'?patch(state):patch)};};state=factory(set,get);const hook=selector=>selector(state);hook.getState=get;hook.setState=set;return hook;}
function load(path,modules){const context={exports:{},require:name=>{if(!(name in modules))throw Error('Missing module '+name);return modules[name];},
 localStorage:{getItem:()=>null,setItem(){}},window:{innerWidth:1280,addEventListener(){},location:{search:'',pathname:'/',hash:''},history:{}},document:{visibilityState:'visible'},console,Set,Map,Date,URLSearchParams,setTimeout:()=>0};
 vm.createContext(context);vm.runInContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);return context.exports;}
const preferences=load('src/store/recommendationPreferences.ts',{});
let fail=false,adds=0,removes=0,resolvePending;
const api={addDislike:async()=>{if(fail)throw Error('network');adds++;},removeDislike:async()=>{if(fail)throw Error('network');removes++;},addFavorite:async()=>{},removeFavorite:async()=>{}};
const {usePlayerStore:player}=load('src/store/playerStore.ts',{'zustand':{create},'../hooks/listeningFeedback':{finishListening(){},interruptListening(){}},'../api/client':{api},'../services/autoplay':{planContinuation:async()=>[]},'./recommendationPreferences':preferences});
const {useUserStore:user}=load('src/store/userStore.ts',{'../platform/authStorage':{writeAuthToken:async()=>{},clearAuthToken:async()=>{}},'zustand':{create},'../hooks/listeningFeedback':{finishListening(){},interruptListening(){}},'../api/client':{api},'./playerStore':{usePlayerStore:player},'./recommendationPreferences':preferences});
const tracks=[{id:'1',title:'Цветы',artist_name:'Тёмный принц',duration:98},{id:'2',title:'Other',artist_name:'Artist',duration:120},{id:'3',title:'New',artist_name:'Artist',duration:150}];
(async()=>{
 user.setState({user:{telegram_id:123}});
 player.getState().setQueue(tracks,0,{id:'mix',query:'Seed',type:'mix'});
 await user.getState().toggleDislike(tracks[0]);
 assert.equal(adds,1);assert.equal(preferences.isHiddenTrack(tracks[0]),true);
 assert.equal(preferences.isHiddenTrack({...tracks[0],id:'alias',artist_name:'темный принц'}),true);
 assert.equal(player.getState().currentTrack.id,'2');assert.equal(player.getState().queue.length,2);
 assert(user.getState().preferenceNotice.undoTrack);
 await user.getState().toggleDislike(tracks[0]);assert.equal(removes,1);assert.equal(preferences.isHiddenTrack(tracks[0]),false);
 // Manual albums remain intact, while automatic additions are filtered.
 player.getState().setQueue(tracks,0,{id:'album',query:'',type:'album'});
 await user.getState().toggleDislike(tracks[0]);
 assert.equal(player.getState().currentTrack.id,'1');assert.equal(player.getState().queue.length,3);
 player.getState().addToQueue({...tracks[0],recommended_automatically:true});assert.equal(player.getState().queue.length,3);
 await user.getState().toggleLike(tracks[0]);assert.equal(preferences.isHiddenTrack(tracks[0]),false);assert.equal(user.getState().isLiked('1'),true);
 // Failed persistence must not hide anything or move the queue.
 fail=true;await user.getState().toggleDislike(tracks[1]);assert.equal(preferences.isHiddenTrack(tracks[1]),false);
 assert(user.getState().preferenceNotice.message.includes('Не удалось'));fail=false;
 // Single remaining recommendation stops native playback via normal paused state.
 player.getState().setQueue([tracks[0]],0,{id:'mix',query:'Seed',type:'mix'});
 await user.getState().toggleDislike(tracks[0]);assert.equal(player.getState().isPlaying,false);assert.equal(player.getState().queue.length,0);
 assert.equal(player.getState().currentTrack.id,'1');
 // Rapid repeated taps share a request instead of racing writes.
 api.addDislike=()=>{adds++;return new Promise(resolve=>resolvePending=resolve);};
 const pending=user.getState().toggleDislike(tracks[2]);const before=adds;
 await user.getState().toggleDislike(tracks[2]);assert.equal(adds,before);resolvePending();await pending;
 console.log('Preference checks passed: hide/undo/aliases, live mix queue, manual albums, like conflict, persistence failure, empty queue and rapid taps.');
})().catch(error=>{console.error(error);process.exitCode=1;});
