const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { newer } = { newer: (a,b) => { const x=a.split('.').map(Number), y=b.split('.').map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i];return false; } };
function createUpdater({ directory, version, fetch, launch, quit }) {
  let state={phase:'idle',progress:0}, file=null, digest=null;
  const status=()=>({...state});
  const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  async function download(v) {
    try {
      const response=await fetch(`https://api.github.com/repos/kabachok-hub/spoty-app/releases/tags/v${v}`, {credentials:'omit',headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error();
      const text=await response.text();if(text.length>2e6)throw Error();
      const release=JSON.parse(text), asset=release.assets?.find(a=>a.name==='Spoty-Setup.exe'&&a.state==='uploaded');
      if(release.draft||release.tag_name!==`v${v}`||!asset||!/^sha256:[a-f0-9]{64}$/.test(asset.digest)||asset.size<1||asset.size>300e6)throw Error();
      const url=`https://github.com/kabachok-hub/spoty-app/releases/download/v${v}/Spoty-Setup.exe`;
      if(asset.browser_download_url!==url)throw Error();
      digest=asset.digest.slice(7);
      fs.mkdirSync(directory,{recursive:true});file=path.join(directory,`Spoty-${v}.exe`);
      const out=await fs.promises.open(file+'.part','w');
      try {
        const result=await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(600000)});
        if(!result.ok||!result.body)throw Error();
        let size=0;const check=crypto.createHash('sha256');
        for await(const chunk of result.body){size+=chunk.length;if(size>asset.size)throw Error();check.update(chunk);await out.writeFile(chunk);state={phase:'downloading',progress:Math.floor(size/asset.size*100)};}
        if(size!==asset.size||check.digest('hex')!==digest)throw Error();
      } finally { await out.close(); }
      fs.renameSync(file+'.part',file);state={phase:'downloaded',progress:100};
    } catch { state={phase:'error',progress:0}; }
  }
  return { status, start(v) {
    if(state.phase==='downloading'||state.phase==='installing')return status();
    if(typeof v!=='string'||!/^\d+\.\d+\.\d+$/.test(v)||!newer(v,version))throw Error('Invalid version');
    state={phase:'downloading',progress:0};void download(v);return status();
  }, async install() {
    if(state.phase!=='downloaded'||!file||hash(file)!==digest)throw Error('Update not verified');
    state={phase:'installing',progress:100};
    try {const error=await launch(file);if(error)throw Error();quit();}catch{state={phase:'error',progress:0};throw Error('Installer failed');}
    return status();
  }};
}
module.exports={createUpdater};
