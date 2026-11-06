const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const ctx={exports:{}};vm.createContext(ctx);vm.runInContext(ts.transpileModule(fs.readFileSync('src/components/player/lyricsTiming.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,ctx);
const {parseLrc,activeLyricIndex}=ctx.exports;
let parsed=parseLrc('[offset:500]\n[0:05.5][01:07.250]Repeat\n[00:10,125]Verse\n[00:11.00]<00:11.1>Word <00:11.5>two\n[00:99]Invalid');
assert.equal(parsed.offsetSec,.5);assert.deepEqual(Array.from(parsed.lines,x=>x.time),[5.5,10.125,11,67.25]);assert.equal(parsed.lines[3].text,'Repeat');assert.equal(parsed.lines[2].text,'Word two');
assert.equal(activeLyricIndex(parsed.lines,0),-1);assert.equal(activeLyricIndex(parsed.lines,10.125),1);assert.equal(activeLyricIndex(parsed.lines,6),0);assert.equal(activeLyricIndex(parsed.lines,80),3);
const source=fs.readFileSync('src/components/player/LyricsPanel.tsx','utf8');assert(!source.includes('ratio * plainLines.length'));assert(!source.includes('handlePlainLineClick'));assert(source.includes('if(cancelled)return;'),'Late requests cannot replace another song');
assert(!source.includes('Подстроить по вокалу'));assert(!source.includes('userOffset'));
console.log('Lyrics timing passed: repeated LRC tags/fractions/word markers/offset, gaps/seeks, static plain text and request guard.');
