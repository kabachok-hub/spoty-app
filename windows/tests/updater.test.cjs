const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createUpdater}=require('../updater.cjs');
const payload=Buffer.from('synthetic installer; never execute'),digest='sha256:'+crypto.createHash('sha256').update(payload).digest('hex');
async function fixture(change={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'spoty-updater-test-'));let launched=0,quit=0,calls=[];
 const asset={name:'Spoty-Setup.exe',state:'uploaded',size:payload.length,digest,browser_download_url:'https://github.com/kabachok-hub/spoty-app/releases/download/v0.2.7/Spoty-Setup.exe',...change};
 const updater=createUpdater({directory,version:'0.2.6',fetch:async(url,options)=>{calls.push(options);return url.includes('api.github.com')?{ok:true,text:async()=>JSON.stringify({tag_name:'v0.2.7',assets:[asset]})}:{ok:true,body:(async function*(){yield payload;})()};},launch:async()=>{launched++;return''},quit:()=>quit++});
 updater.start('0.2.7');for(let i=0;i<100&&updater.status().phase==='downloading';i++)await new Promise(r=>setTimeout(r,5));
 return{updater,directory,calls,get launched(){return launched},get quit(){return quit}};
}
test('verified download remains idle until explicit install, then launches only the checked private file',async()=>{
 const f=await fixture();assert.equal(f.updater.status().phase,'downloaded');assert.equal(f.launched,0);assert(f.calls.every(o=>o.credentials==='omit'));await f.updater.install();assert.equal(f.launched,1);assert.equal(f.quit,1);
});
test('hash mismatch, wrong length, absent digest and foreign asset cannot launch',async()=>{
 for(const change of [{digest:'sha256:'+'0'.repeat(64)},{size:payload.length+1},{digest:null},{browser_download_url:'https://evil.test/Spoty-Setup.exe'}]){const f=await fixture(change);assert.equal(f.updater.status().phase,'error');await assert.rejects(f.updater.install());assert.equal(f.launched,0);}
});
test('tampered downloaded file and downgrade are rejected',async()=>{
 const f=await fixture();fs.writeFileSync(path.join(f.directory,'Spoty-0.2.7.exe'),'changed');await assert.rejects(f.updater.install());assert.equal(f.launched,0);assert.throws(()=>f.updater.start('0.2.5'));assert.throws(()=>f.updater.start('../0.2.7'));
});
