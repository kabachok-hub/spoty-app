const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
let native=true,hostHidden=false,now=0,id=0,draws=0;const frames=new Map(),events=new Map(),saved=new Map();
function eventTarget(prefix){return{addEventListener:(name,fn)=>{const k=prefix+name;if(!events.has(k))events.set(k,new Set());events.get(k).add(fn);},removeEventListener:(name,fn)=>events.get(prefix+name)?.delete(fn)}}
const doc={...eventTarget('d:'),hidden:false,documentElement:{dataset:{}}};
const globals={exports:{},require:n=>({'react':{useEffect(){},useSyncExternalStore:(_s,get)=>get()},'./nativeBridge':{isNativeClient:()=>native,isHostHidden:()=>hostHidden}}[n]),
 document:doc,window:eventTarget('w:'),localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},
 requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:n=>frames.delete(n),Map,Set,Math,Number,Infinity};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/platform/visualPerformance.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,globals);
const api=globals.exports;
function tick(count,hz=60){for(let i=0;i<count;i++){now+=1000/hz;const list=[...frames.values()];frames.clear();list.forEach(fn=>fn(now));}}
function emit(key){for(const fn of events.get(key)||[])fn();}
assert.equal(api.getVisualMode(),'balanced');assert.equal(api.visualBudget().fps,30);
const size=api.decorativeSize(3840,2160);assert(size.width<=1280&&size.height<=720);assert.equal(size.width/size.height,16/9);
const stop=api.startDecorativeLoop(()=>draws++);tick(60);assert(draws>=29&&draws<=31,`balanced drew ${draws} frames`);
hostHidden=true;emit('w:spoty-host-visibility');assert.equal(frames.size,0,'hidden window must have no pending RAF');const before=draws;tick(120);assert.equal(draws,before);
hostHidden=false;emit('w:spoty-host-visibility');tick(1);assert.equal(draws,before+1,'restore draws once without accumulated catch-up');
doc.hidden=true;emit('d:visibilitychange');assert.equal(frames.size,0);stop();
doc.hidden=false;api.setVisualMode('economy');assert.equal(api.visualBudget().freezeVideo,true);assert.equal(api.visualBudget().blur,0);assert.equal(saved.get('spoty_visual_performance_v1'),'economy');
draws=0;const low=api.startDecorativeLoop(()=>draws++);tick(60);assert(draws>=14&&draws<=16);low();assert.equal(frames.size,0);
native=false;assert.equal(api.getVisualMode(),'quality');assert.equal(api.visualBudget().freezeVideo,false);assert.equal(api.decorativeSize(3840,2160).width,3840);
draws=0;const web=api.startDecorativeLoop(()=>draws++);tick(144,144);assert.equal(draws,144,'ordinary website keeps original display-rate animation');web();
assert([...events.values()].every(set=>set.size===0),'cleanup must remove all visual loop listeners');
console.log('Visual performance passed: native FPS/resolution budgets, economy video policy, no RAF while hidden, immediate restore, persistence, cleanup and unchanged website refresh rate.');
