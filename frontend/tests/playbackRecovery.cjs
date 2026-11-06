const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const ctx={exports:{},setTimeout,clearTimeout,Date,Set};vm.createContext(ctx);vm.runInContext(ts.transpileModule(fs.readFileSync('src/hooks/playbackRecovery.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,ctx);
const track=id=>({id,title:'Song '+id,duration:100});
let state,jobs,online=true,invalidated;
function init(extra={}){state={currentTrack:track('1'),queue:['1','2','3','4'].map(track),queueIndex:0,playToken:1,playbackIntent:0,repeatMode:'off',playedTrackIds:['1'],isShuffle:false,isPlaying:true,...extra};jobs=new Map();invalidated=[];online=true;let id=0;return ctx.exports.createPlaybackRecovery({get:()=>state,patch:p=>{state={...state,...p};},online:()=>online,invalidate:id=>invalidated.push(id),schedule:fn=>{jobs.set(++id,fn);return id;},cancelTimer:id=>jobs.delete(id)});}
const tick=()=>{const f=[...jobs.values()];jobs.clear();f.forEach(fn=>fn());};
const fail=(r,position=0)=>r.fail('source','source',position,state.isPlaying);
let r=init();assert(fail(r,33));assert.equal(state.isPlaying,false);assert(r.fail('source','source',33,false),'Duplicate callback shares recovery');assert.equal(jobs.size,1);tick();assert.equal(state.currentTrack.id,'1');assert.equal(state.currentTime,33);assert.equal(state.recoveryPosition,33);assert.equal(state.isPlaying,true);assert.deepEqual(invalidated,['1']);assert(fail(r,33));tick();assert.equal(state.currentTrack.id,'2');assert.equal(state.isPlaying,true);
fail(r);tick();fail(r);tick();assert.equal(state.currentTrack.id,'3');fail(r);tick();assert(r.fail('source','source',0,true));assert.equal(jobs.size,0);assert(state.playbackError.includes('три трека'));assert.equal(state.currentTrack.id,'3');
r=init();fail(r);state.playbackIntent++;state.isPlaying=false;tick();assert.equal(state.isPlaying,false,'Pause during pending recovery wins');
r=init();fail(r);state={...state,currentTrack:track('manual'),playToken:2,playbackIntent:1};tick();assert.equal(state.currentTrack.id,'manual');assert.equal(state.playToken,2);
r=init();online=false;assert.equal(fail(r),false);assert.equal(jobs.size,0);
r=init();assert.equal(r.fail('blocked','blocked',0,true),false);assert.equal(r.fail('interrupted','interrupted',0,true),false);
r=init({queue:[track('1')]});fail(r);tick();fail(r);tick();assert.equal(state.currentTrack.id,'1');assert.equal(state.isPlaying,false);assert(state.playbackError);
r=init({repeatMode:'one'});fail(r);tick();assert.equal(fail(r),false,'Repeat-one does not advance to a different song');
r=init();fail(r);r.cancel();tick();assert.equal(state.isPlaying,false);r.reset();state.isPlaying=true;assert(fail(r),'StrictMode setup can use recovery after cleanup');
r=init();fail(r);tick();fail(r);tick();r.healthy('2',0,1000);r.healthy('2',6,7000);fail(r);tick();fail(r);tick();assert.equal(state.currentTrack.id,'3');
console.log('Playback recovery passed: duplicate errors, one retry/resume, next available, three-failure circuit, pause/manual override, offline/blocked, repeat-one, end-of-queue and cleanup.');
