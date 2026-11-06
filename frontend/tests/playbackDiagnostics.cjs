const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const reports=[];
const context={exports:{},require:()=>({apiClient:{post:async(path,data)=>reports.push({path,data})}}),
 window:{Telegram:{WebApp:{initData:'NEVER_SEND_THIS',platform:'android',version:'8.0'}}},
 navigator:{onLine:true},document:{visibilityState:'hidden'},localStorage:{getItem:()=>null},Date,Number,setTimeout:()=>1};
vm.createContext(context);
vm.runInContext(ts.transpileModule(fs.readFileSync('src/hooks/playbackDiagnostics.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
const {playbackFailure,tracePlayback}=context.exports;
const audio={readyState:0,networkState:2,paused:true,ended:false,currentTime:0};
assert.equal(playbackFailure({name:'NotAllowedError'},audio).code,'blocked');
assert.equal(playbackFailure({name:'AbortError'},audio).code,'interrupted');
assert.equal(playbackFailure({name:'TimeoutError'},audio).code,'timeout');
assert.equal(playbackFailure({name:'NotSupportedError'},{...audio,error:{code:2}}).code,'network');
assert.equal(playbackFailure(null,{...audio,error:{code:3}}).code,'decode');
assert.equal(playbackFailure(null,{...audio,error:{code:4}}).code,'source');
for(let i=0;i<50;i++)tracePlayback('source',audio,String(i));
tracePlayback('failure',audio,'50','blocked');
assert.equal(reports.length,1);
assert.equal(reports[0].data.events.length,20);
assert.equal(reports[0].data.events.at(-1).hidden,true);
assert.equal(reports[0].data.events.at(-1).failure,'blocked');
assert(!JSON.stringify(reports).includes('NEVER_SEND_THIS'));
tracePlayback('visible',audio,'50');assert.equal(reports.length,1);
console.log('Playback diagnostics: failure classification, bounded trace, credentials excluded, upload throttling passed.');
