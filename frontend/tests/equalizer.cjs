const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const source=fs.readFileSync('src/hooks/useAudioPlayer.ts','utf8');
let created=0,connections=0;const filters=[];
class Context {
  constructor(){this.currentTime=0;this.state='running';this.destination={};}
  createBiquadFilter(){const filter={frequency:{value:0},Q:{value:0},gain:{value:0,setTargetAtTime(v){this.value=v}},connect(){connections++}};filters.push(filter);return filter;}
  createMediaElementSource(){created++;return{connect(){connections++}};}
}
let state={equalizerEnabled:false,equalizerBands:[0,0,0,0,0]};
const sandbox={window:{AudioContext:Context},WeakMap,console,useSettingsStore:{getState:()=>state}};
vm.createContext(sandbox);vm.runInContext(ts.transpileModule(source.slice(source.indexOf('let audioContext:'),source.indexOf('let lastMediaMetadataKey')),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,sandbox);
const a={},b={};sandbox.initEqualizerGraph(a);assert.equal(created,0);
state={equalizerEnabled:true,equalizerBands:[7,5,0,-1,-2]};sandbox.initEqualizerGraph(a);sandbox.initEqualizerGraph(b);sandbox.initEqualizerGraph(a);
assert.equal(created,2);assert.equal(filters.length,5);assert.equal(connections,7);assert.deepEqual(filters.map(f=>f.gain.value),state.equalizerBands);
sandbox.applyEqualizerGains(false,state.equalizerBands);assert.deepEqual(filters.map(f=>f.gain.value),[0,0,0,0,0]);
sandbox.applyEqualizerGains(true,[-12,0,3,6,12]);assert.deepEqual(filters.map(f=>f.gain.value),[-12,0,3,6,12]);
console.log('EQ passed: opt-in routing, both decks, source reuse, presets, live gain update and bypass.');
