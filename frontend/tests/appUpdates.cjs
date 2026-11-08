const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(path,modules={},globals={}) { const context={exports:{},require:n=>{if(!(n in modules))throw Error(n);return modules[n];},URL,Date,JSON,Number,Error,Map,Promise,AbortController,setTimeout,clearTimeout,...globals};vm.createContext(context);vm.runInContext(ts.transpileModule(fs.readFileSync(path,'utf8').replace('import.meta.env.VITE_APP_VERSION',"'0.2.4'"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);return context.exports; }
const core=load('src/platform/releases.ts');
const release=(tag,android=false)=>({tag_name:tag,assets:[{name:android?`Spoty-Android-${tag.slice(1)}.apk`:'Spoty-Setup.exe',state:'uploaded',size:100,browser_download_url:`https://github.com/kabachok-hub/spoty-app/releases/download/${tag}/${android?`Spoty-Android-${tag.slice(1)}.apk`:'Spoty-Setup.exe'}`}]});
assert.equal(core.newerVersion('v0.10.0','0.9.9'),true);assert.equal(core.newerVersion('0.2.4','0.2.4'),false);assert.equal(core.newerVersion('v0.2.5-beta','0.2.4'),false);
const latest=release('v0.2.6'),older=release('v0.2.5');assert.equal(core.selectRelease([latest,older],'0.2.4',false).version,'0.2.6');
assert.equal(core.selectRelease([latest],'0.2.4',true),null);assert.equal(core.selectRelease([release('v0.2.5',true)],'0.2.4',true).version,'0.2.5');
assert.equal(core.selectRelease([{...latest,draft:true}],'0.2.4',false),null);
for(const url of ['https://evil.test/Spoty-Setup.exe','http://github.com/kabachok-hub/spoty-app/releases/download/v0.2.6/Spoty-Setup.exe','https://github.com/other/repo/releases/download/v0.2.6/Spoty-Setup.exe','https://user:password@github.com/kabachok-hub/spoty-app/releases/download/v0.2.6/Spoty-Setup.exe','https://github.com/kabachok-hub/spoty-app/releases/download/v0.2.6/Spoty-Setup.exe?token=example']) {
 const bad=JSON.parse(JSON.stringify(latest));bad.assets[0].browser_download_url=url;assert.equal(core.selectRelease([bad],'0.2.4',false),null,url);
}
(async()=>{
 let state,calls=[],opened=[],fail=false,native=true,resolve;
 const store=load('src/platform/appUpdates.ts',{'zustand':{create:init=>{let value;const set=patch=>Object.assign(value,patch);value=init(set,()=>value);if(value.check)state=value;return{getState:()=>value,setState:set};}},'./nativeBridge':{isNativeAndroid:()=>false,isNativeClient:()=>native,nativeCall:async(...args)=>{opened.push(args);return{phase:'downloaded',progress:100}}},'./releases':core},{fetch:async(url,options)=>{calls.push(options);if(fail)throw Error('offline');return{ok:true,text:async()=>JSON.stringify([older])};}});
 await state.check();assert.equal(state.release.version,'0.2.5');assert.equal(calls[0].credentials,'omit');assert.equal(calls[0].referrerPolicy,'no-referrer');assert.equal(Object.keys(calls[0].headers).length,1);
 await state.check();assert.equal(calls.length,1);await state.check(true);assert.equal(calls.length,2);
 await store.openAppUpdate();assert.equal(opened[0][0],'updateStart');assert.equal(opened[0][1].version,'0.2.5');assert.equal(store.useUpdateTransfer.getState().phase,'downloaded');await store.openAppUpdate();assert.equal(opened.at(-1)[0],'updateInstall');
 fail=true;await state.check(true);assert.equal(state.status,'error');assert.equal(state.release.version,'0.2.5');native=false;await state.check(true);assert.equal(calls.length,3);
 console.log('App updates passed: semantic versions, platform assets, trusted URLs, drafts, credential-free requests, throttling, retry and native download and explicit installation.');
})().catch(e=>{console.error(e);process.exitCode=1});
