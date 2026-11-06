const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function setup({platform='android',hidden=true,src='https://audio.test/song'}={}) {
 let now=100000;
 const document={visibilityState:hidden?'hidden':'visible'};
 const context={exports:{},require:()=>({apiClient:{post:()=>Promise.resolve()}}),
  window:{Telegram:{WebApp:{initData:'test-only',platform}}},document,navigator:{onLine:false},
  localStorage:{getItem:()=>null},setTimeout:()=>1,clearTimeout(){},Date:{now:()=>now},console};
 vm.createContext(context);
 vm.runInContext(ts.transpileModule(fs.readFileSync('src/hooks/playbackDiagnostics.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
 return {api:context.exports,document,audio:{src,error:{code:4}},advance:ms=>now+=ms,now:()=>now};
}
for (const test of [
 {expected:'network'},
 {platform:'ios',expected:'source'},
 {hidden:false,expected:'source'},
 {src:'blob:prepared',expected:'source'},
 {bufferFailure:'source',expected:'source'},
 {age:11000,expected:'source'},
 {elapsed:2000,expected:'source'},
 {mediaError:3,expected:'decode'},
]) {
 const s=setup(test);
 s.api.traceBufferPreparation('buffer_failed','next-track',s.now()-(test.elapsed||33),test.bufferFailure||'network');
 s.advance(test.age||0);s.audio.error.code=test.mediaError||4;
 const result=s.api.playbackFailure(null,s.audio);
 assert.equal(result.code,test.expected,JSON.stringify(test));
 assert.equal(result.message===s.api.BACKGROUND_PLAYBACK_MESSAGE,test.expected==='network');
}
const ordinary=setup();
assert.equal(ordinary.api.playbackFailure(null,ordinary.audio).code,'source','Hidden native error alone is not proof of background restriction');
for (const platform of ['android','ios','tdesktop','macos','unknown']) {
 const s=setup({platform});
 assert.equal(s.api.mobileMiniAppPlatform(),['android','ios'].includes(platform)?platform:null);
}
console.log('Background help checks passed: corroborated hidden failure, foreground/source/Blob/decode separation, platform, expiry and slow network.');
