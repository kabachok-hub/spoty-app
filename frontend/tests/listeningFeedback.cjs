const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const ctx={exports:{},Date,Math};vm.createContext(ctx);vm.runInContext(ts.transpileModule(fs.readFileSync('src/hooks/listeningFeedback.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,ctx);
const f=ctx.exports,track={id:'song'},events=[];let clock=0;
const reset=()=>{events.length=0;clock=0;f.configureListeningFeedback(e=>events.push(e));};
const sample=(p,r=true,seconds=1)=>{clock+=seconds*1000;f.sampleListening(track,1,p,100,r,clock);};
const hear=n=>{sample(0);for(let i=1;i<=n;i++)sample(i);};
reset();hear(90);f.finishListening('ended');f.finishListening('manual');assert.equal(events.length,1);assert.equal(events[0].outcome,'completed');
reset();hear(5);f.finishListening('manual');assert.equal(events[0].outcome,'early_skip');
reset();hear(1);f.finishListening('manual');assert.equal(events.length,0,'Accidental taps are neutral');
for(const kind of ['pause','waiting','error','seek']){reset();hear(5);f.interruptListening(kind);f.finishListening('manual');assert.equal(events.length,0,kind+' must not be a dislike');}
reset();hear(5);sample(95,true);f.finishListening('ended');assert.equal(events.length,0,'Seeking to the end is not completion');
reset();hear(40);f.interruptListening('seek');sample(0);for(let i=1;i<=60;i++)sample(i);f.finishListening('ended');assert.equal(events.length,0,'Repeated sections count once');
reset();hear(5);f.interruptListening('pause');sample(5,false,300);sample(5,true);for(let i=6;i<=90;i++)sample(i);f.finishListening('ended');assert.equal(events[0].outcome,'completed','Pause time excluded; resumed listening still counts');
reset();hear(5);f.configureListeningFeedback(null);f.finishListening('manual');assert.equal(events.length,0,'Account switch drops old session');
reset();sample(0);sample(90,true,90);f.finishListening('ended');assert.equal(events[0].outcome,'completed','Sparse background progress can count real media advancement');
console.log('Listening feedback passed: completion, voluntary skip, neutral taps/pause/stall/error/seek, unique coverage, resume, sparse background progress, dedup and account reset.');
function create(factory){let state;const get=()=>state,set=p=>{state={...state,...(typeof p==='function'?p(state):p)};};state=factory(set,get);const hook=f=>f(state);hook.getState=get;hook.setState=set;return hook;}
const modules={'zustand':{create},'../hooks/listeningFeedback':f,'../services/autoplay':{planContinuation:async()=>[]},'../api/client':{api:{}},'./recommendationPreferences':{isHiddenTrack:()=>false,isAutomaticMix:()=>false}};
const storeCtx={exports:{},require:n=>modules[n],console,Date,Map,Set,localStorage:{getItem:()=>null,setItem(){}},window:{innerWidth:400,addEventListener(){}},document:{visibilityState:'visible'},setTimeout:()=>0};
vm.createContext(storeCtx);vm.runInContext(ts.transpileModule(fs.readFileSync('src/store/playerStore.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,storeCtx);
const store=storeCtx.exports.usePlayerStore;
const queue=[{id:'song',duration:100},{id:'next',duration:100}];
store.getState().setQueue(queue);reset();hear(5);store.getState().nextTrack({type:'click'});assert.equal(events[0].outcome,'early_skip','Button click maps to voluntary next');
store.getState().setQueue(queue);reset();hear(5);store.getState().nextTrack('ended');assert.equal(events.length,0,'Automatic advance is not a skip');
store.getState().setQueue(queue);reset();hear(5);store.getState().pause();store.getState().nextTrack();assert.equal(events.length,0,'Paused next is neutral');
store.getState().setQueue(queue);reset();hear(5);store.getState().playTrack(queue[1],queue);assert.equal(events[0].outcome,'early_skip','Selecting a different song records voluntary skip');
console.log('Store + real feedback integration passed: click/manual selection versus automatic transition and pause.');
