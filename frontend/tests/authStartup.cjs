const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function create(factory){let state;const get=()=>state,set=p=>state={...state,...(typeof p==='function'?p(state):p)};
 state=factory(set,get);const hook=s=>s(state);hook.getState=get;hook.setState=set;return hook;}
function setup(mini=false){
 const stored=new Map(),api={pingPresence(){},getMyFavoriteIds:async()=>[],getMyFavorites:async()=>[],getMyPlaylists:async()=>[],getMyFollowing:async()=>[],getMyDislikes:async()=>[]};
 const context={exports:{},require:n=>({'../platform/authStorage':{writeAuthToken:async token=>stored.set('spotify_auth_token',token),clearAuthToken:async()=>stored.delete('spotify_auth_token')},'zustand':{create},'../api/client':{api},'./playerStore':{usePlayerStore:{getState:()=>({pruneDislikedRecommendations(){}})}},
 './recommendationPreferences':{syncHiddenTracks(){},trackSignature:t=>t.id,isHiddenTrack:()=>false}}[n]),console:{error(){}},Set,Map,URLSearchParams,
 localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)},
 window:{Telegram:mini?{WebApp:{initData:'test-init-data'}}:undefined,location:{search:'',pathname:'/',hash:''},history:{replaceState(){}}}};
 vm.createContext(context);vm.runInContext(ts.transpileModule(fs.readFileSync('src/store/userStore.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
 return {store:context.exports.useUserStore,api};
}
const profile={telegram_id:42,first_name:'Test'};
(async()=>{
 const {store,api}=setup(true);let resolveAuth,resolveData;
 api.authTelegram=()=>new Promise(r=>resolveAuth=r);api.getMe=()=>{throw Error('Mini App must use Telegram authentication');};
 api.getMyDislikes=()=>new Promise(r=>resolveData=r);
 assert.equal(store.getState().authStatus,'checking','first render must never imply guest');
 const request=store.getState().initUser();assert.equal(store.getState().authStatus,'checking');
 resolveAuth(profile);await new Promise(setImmediate);
 assert.equal(store.getState().user.telegram_id,42);assert.equal(store.getState().authStatus,'ready');
 assert.equal(store.getState().isLoading,true,'profile is available before collections finish');
 resolveData([]);await request;assert.equal(store.getState().isLoading,false);
 for(const status of [undefined,500,401,403]){
  const test=setup();test.api.getMe=async()=>{throw {response:{status}};};await test.store.getState().initUser();
  assert.equal(test.store.getState().authStatus,status===401||status===403?'ready':'error');
  assert.equal(test.store.getState().user,null);
  test.api.getMe=async()=>profile;await test.store.getState().initUser();assert.equal(test.store.getState().authStatus,'ready');
 }
 const guest=setup();guest.api.getMe=async()=>({telegram_id:999999999});await guest.store.getState().initUser();
 assert.equal(guest.store.getState().authStatus,'ready');assert.equal(guest.store.getState().user.telegram_id,999999999);
 const dataFailure=setup();dataFailure.api.getMe=async()=>profile;dataFailure.api.getMyDislikes=async()=>{throw Error('network');};
 await dataFailure.store.getState().initUser();assert.equal(dataFailure.store.getState().authStatus,'ready');assert.equal(dataFailure.store.getState().user.telegram_id,42);
 console.log('Auth startup checks passed: initial/deferred Telegram login, early profile readiness, guest, expired auth, network failure/retry and collection failure.');
})().catch(error=>{console.error(error);process.exitCode=1;});
