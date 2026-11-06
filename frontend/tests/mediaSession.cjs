const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const src = fs.readFileSync('src/hooks/useAudioPlayer.ts', 'utf8');
const from = src.indexOf("let lastMediaMetadataKey");
const to = src.indexOf('\n/**', from);
const code = ts.transpileModule(src.slice(from, to), {compilerOptions: {target: ts.ScriptTarget.ES2020}}).outputText;
let metadataWrites = 0;
let positions = [];
const session = {metadata: null, playbackState: 'none', setPositionState: s => positions.push(s)};
const context = {
  navigator: {mediaSession: session}, window: {location: {origin: 'https://example.com'}},
  URL, console, MediaMetadata: function(value) { metadataWrites++; Object.assign(this, value); },
};
vm.createContext(context); vm.runInContext(code, context);
const track = {id:'1', title:'Song', artist_name:'Artist', cover_url:'/cover.jpg'};
const audio = {duration:180, currentTime:20, playbackRate:1, paused:false, ended:false, readyState:4};
context.syncMediaSession(track,true,audio);
for(let i=0;i<20;i++) context.syncMediaSession(track,true,audio);
assert.equal(metadataWrites,1);
assert.equal(session.metadata.artwork.length,1);
assert.equal(session.metadata.artwork[0].src,'https://example.com/cover.jpg');
assert.equal(session.playbackState,'playing');
context.syncMediaSession(track,true,{...audio,paused:true});
assert.equal(session.playbackState,'paused');
context.syncMediaSession(track,true,{...audio,readyState:1});
assert.equal(session.playbackState,'paused');
context.syncMediaSession({...track,id:'2',title:'Next'},true,{...audio,currentTime:999});
assert.equal(metadataWrites,2);
assert.equal(positions.at(-1).position,180);
context.syncMediaSession(track,true,{...audio,duration:NaN});
assert.equal(positions.at(-1),undefined);
session.setPositionState = undefined;
context.syncMediaSession(track,false,audio);
assert.equal(session.playbackState,'paused');
context.syncMediaSession(null,false);
assert.equal(session.metadata,null);
assert.equal(session.playbackState,'none');
// One unsupported action must not prevent the remaining controls from registering.
const begin = src.indexOf('    const registerMediaAction =');
const end = src.indexOf('    const resumeExpectedPlayback',begin);
const handlers = new Map();
let playing = false;
let recoveryCancels=0;
let current = {...audio};
Object.assign(context, {
  recovery:{cancel(){recoveryCancels++;}},
  getActiveAudio:()=>current, initEqualizerGraph:()=>{}, startKeepAlive:()=>{},stopKeepAlive:()=>{},
  setPlaying:value=>{playing=value;},playNextTrackSync:()=>{},playPrevTrackSync:()=>{},
  usePlayerStore:{getState:()=>({currentTrack:track,isPlaying:playing}),setState:()=>{}},
});
session.setActionHandler=(name,handler)=>{ if(name==='previoustrack') throw Error('unsupported');handlers.set(name,handler); };
vm.runInContext(ts.transpileModule(src.slice(begin,end),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
assert(handlers.has('play') && handlers.has('pause') && handlers.has('seekto') && handlers.has('stop'));
handlers.get('seekto')({seekTime:-10});
assert.equal(current.currentTime,0);
handlers.get('seekforward')({seekOffset:999});
assert.equal(current.currentTime,180);
assert.equal(recoveryCancels,2,'System seeks cancel pending recovery');
(async()=>{
 current = {...audio,play:()=>Promise.resolve(),pause:()=>{current.paused=true;}};
 handlers.get('play')(); await new Promise(setImmediate);
 assert.equal(playing,true);
 handlers.get('pause')();assert.equal(playing,false);assert.equal(current.paused,true);
 current.play=()=>Promise.reject(new Error('blocked'));
 handlers.get('play')();await new Promise(setImmediate);
 assert.equal(playing,false);assert.equal(session.playbackState,'paused');
 let resolvePlay;
 current = {...audio,play:()=>new Promise(resolve=>{resolvePlay=resolve;}),pause:()=>{current.paused=true;}};
 handlers.get('play')();
 handlers.get('pause')();
 resolvePlay();await new Promise(setImmediate);
 assert.equal(playing,false);assert.equal(current.paused,true);
 console.log('MediaSession checks passed: metadata, position, unsupported actions, pause/resume, failed play and rapid pause.');
})().catch(error=>{console.error(error);process.exitCode=1;});
