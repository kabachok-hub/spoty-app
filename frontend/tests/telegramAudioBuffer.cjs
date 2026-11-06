const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const requests=[],created=[],revoked=[];
const timers=new Map(),traces=[];let timerId=0;
let mode='audio',pendingResolve;
const context={exports:{},require:name=>name==='../api/client'?({api:{getStreamUrl:id=>'https://audio.test/'+id}}):name==='./playbackDiagnostics'?({traceBufferPreparation:(...args)=>traces.push(args)}):({isRecordingRefreshing:()=>false}),AbortController,Blob,Uint8Array,Map,Set,
 setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),URL:{createObjectURL:blob=>{const url='blob:test-'+created.length;created.push({url,blob});return url;},revokeObjectURL:url=>revoked.push(url)},
 fetch:async(url,options)=>{
  requests.push({url,options});
  if(mode==='deferred')await new Promise(resolve=>pendingResolve=resolve);
  const type=mode==='bad'||(mode==='partial'&&url.endsWith('/2'))?'application/json':'audio/mpeg';
  return {ok:true,headers:{get:key=>key==='Content-Type'?type:mode==='large'?String(13*1024*1024):'3'},body:{
   cancel:async()=>{},getReader:()=>{let done=false;return{read:async()=>done?{done:true}:(done=true,{done:false,value:new Uint8Array([1,2,3])}),releaseLock(){}}}
  }};
 }};
vm.createContext(context);
vm.runInContext(ts.transpileModule(fs.readFileSync('src/hooks/telegramAudioBuffer.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
const {warmTelegramQueue,bufferedTelegramSource,clearTelegramAudioBuffer,invalidateTelegramRecording}=context.exports;
const tracks=[1,2,3,4,5].map(id=>({id:String(id),title:'Song',artist_name:'Artist',duration:100}));
const flush=()=>new Promise(setImmediate);
function runTimer(ms){const pair=[...timers].find(([,t])=>t.ms===ms);assert(pair,'missing timer '+ms);timers.delete(pair[0]);pair[1].fn();}
(async()=>{
 await warmTelegramQueue(tracks,0);
 assert.equal(requests.length,2);assert(bufferedTelegramSource('2').startsWith('blob:'));assert(bufferedTelegramSource('3'));
 const second=bufferedTelegramSource('2');
 await warmTelegramQueue(tracks,1);
 assert.equal(bufferedTelegramSource('2'),second,'currently playing URL must remain valid');
 assert.equal(requests.length,3,'refill just one next track');
 await warmTelegramQueue(tracks,2);
 assert(revoked.includes(second),'old track must release memory');
 assert.equal(bufferedTelegramSource('2'),undefined);
 clearTelegramAudioBuffer();assert.equal(revoked.length,created.length);
 mode='audio';await warmTelegramQueue(tracks,0);
 const oldNext=bufferedTelegramSource('2'),unrelated=bufferedTelegramSource('3');
 invalidateTelegramRecording('2');assert.equal(bufferedTelegramSource('2'),undefined);
 assert.equal(bufferedTelegramSource('3'),unrelated);assert(revoked.includes(oldNext));
 await warmTelegramQueue(tracks,0);assert.notEqual(bufferedTelegramSource('2'),oldNext);
 clearTelegramAudioBuffer();
 mode='partial';await warmTelegramQueue(tracks,0);
 assert.equal(bufferedTelegramSource('2'),undefined);assert(bufferedTelegramSource('3'),'failed first prefetch must not block second');
 mode='audio';runTimer(1500);await flush();await flush();
 assert(bufferedTelegramSource('2'),'transient failure must recover on retry');
 assert(traces.some(t=>t[0]==='buffer_failed'&&t[1]==='2'));
 clearTelegramAudioBuffer();mode='bad';const retryStart=requests.length;
 await warmTelegramQueue(tracks,0);runTimer(1500);await flush();runTimer(4000);await flush();
 assert.equal(requests.length-retryStart,6,'two recordings with at most three total attempts each');
 assert.equal(timers.size,0,'no endless retry loop');
 await warmTelegramQueue(tracks,0);const cancelled=[...timers.values()].find(t=>t.ms===1500).fn;
 clearTelegramAudioBuffer();const beforeCancel=requests.length;cancelled();await flush();assert.equal(requests.length,beforeCancel,'cancelled queue cannot restart retries');
 mode='bad';await warmTelegramQueue(tracks,0);assert.equal(bufferedTelegramSource('2'),undefined);
 mode='large';await warmTelegramQueue(tracks,0);assert.equal(bufferedTelegramSource('2'),undefined);
 mode='deferred';const warming=warmTelegramQueue(tracks,0);
 clearTelegramAudioBuffer();const before=created.length;pendingResolve();await warming;
 assert.equal(created.length,before,'late completion must not leak/recreate object URLs');
 assert.equal(requests.at(-1).options.signal.aborted,true);
 console.log('Telegram buffer checks passed: two-track prefetch/refill, active URL retention, revocation, MIME/size guards, cancelled queue.');
})().catch(error=>{console.error(error);process.exitCode=1;});
