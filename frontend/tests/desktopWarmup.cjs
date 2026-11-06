const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
let native=false,effects=[],calls=[],state={queue:[1,2,3,4].map(id=>({id:String(id),title:'Track',artist_name:'Artist',duration:120})),queueIndex:0,isPlaying:true,repeatMode:'off'};
const context={exports:{},require:n=>({'react':{useEffect:fn=>effects.push(fn)},'../store/playerStore':{usePlayerStore:fn=>fn(state)},'../api/client':{api:{preloadTrack:async id=>calls.push(id)}},'./nativeBridge':{isNativeClient:()=>native}}[n]),Map,Date};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/platform/DesktopWarmup.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
function render(){effects=[];context.exports.DesktopWarmup();effects.forEach(fn=>fn());}
render();assert.equal(calls.length,0,'website transport must remain untouched');
native=true;render();assert.deepEqual(calls,['2','3']);render();assert.equal(calls.length,2,'rerender coalesces existing preparation');
state={...state,queueIndex:1};render();assert.deepEqual(calls,['2','3','4']);
state={...state,isPlaying:false,queueIndex:2};render();assert.equal(calls.length,3);
state={...state,isPlaying:true,repeatMode:'one'};render();assert.equal(calls.length,3);
console.log('Desktop warmup checks passed: native-only, two upcoming tracks, coalescing, queue edits, pause and repeat-one.');
