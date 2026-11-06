const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events');
function setup(){
 const calls=[],handlers={},ipc={},views=[],windows=[];
 class Contents extends EventEmitter{constructor(){super();this.mainFrame={url:''};this.sent=[];this.session={setPermissionRequestHandler(){}};}send(...args){this.sent.push(args);}setWindowOpenHandler(){}loadURL(url){this.mainFrame.url=url;return Promise.resolve();}close(){}}
 class View{constructor(options){this.options=options;this.webContents=new Contents();views.push(this);}setBackgroundColor(){}setBounds(bounds){this.bounds=bounds;}setBorderRadius(){}}
 class Window extends EventEmitter{constructor(options){super();windows.push(this);this.options=options;this.visible=true;this.minimized=false;this.contentView={addChildView(){}};this.bounds={x:100,y:100,width:1400,height:900};}getContentSize(){return[this.bounds.width,this.bounds.height];}getBounds(){return this.bounds;}isVisible(){return this.visible;}isMinimized(){return this.minimized;}isMaximized(){return false;}isFullScreen(){return false;}setBounds(b){this.bounds=b;calls.push(['bounds',b]);}show(){}focus(){}on(...args){return super.on(...args);}}
 const app=new EventEmitter();Object.assign(app,{requestSingleInstanceLock:()=>true,whenReady:()=>Promise.resolve(),getVersion:()=> '0.2.2',getPath:()=>'/unused-test-profile',quit(){}});
 const electron={app,BaseWindow:Window,WebContentsView:View,ipcMain:{on:(name,fn)=>ipc[name]=fn,handle:(name,fn)=>ipc[name]=fn},
 protocol:{registerSchemesAsPrivileged(){},handle:(name,fn)=>handlers[name]=fn},nativeTheme:{},screen:{getCursorScreenPoint:()=>({x:120,y:130})},
 net:{fetch:(url,options)=>{calls.push(['fetch',url,options]);return Promise.resolve({});}},shell:{openExternal(){}},safeStorage:{},
 Tray:class{setToolTip(){}setContextMenu(){}on(){}},Menu:{buildFromTemplate:()=>({})},nativeImage:{createFromPath:()=>({resize:()=>({})})}};
 const context={require:name=>name==='electron'?electron:name==='./server-config.json'?{apiOrigin:'https://api.example.test'}:require(name.startsWith('./')?path.resolve(__dirname,'..',name):name),__dirname:path.resolve(__dirname,'..'),Response,URL,Promise,Date,console};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.cjs'),'utf8'),context);
 return{calls,handlers,ipc,views,windows};
}
test('public background forwarding retains ranges and never forwards session credentials',async()=>{
 const s=setup();await new Promise(setImmediate);
 await s.handlers.spoty(new Request('spoty://app/videos/example.mp4',{headers:{Range:'bytes=0-1023',Authorization:'Bearer synthetic-not-a-real-token'}}));
 const call=s.calls.find(x=>x[0]==='fetch'&&x[1].startsWith('https://'));
 assert.equal(call[1],'https://api.example.test/videos/example.mp4');assert.equal(call[2].headers.range,'bytes=0-1023');assert.equal(call[2].headers.authorization,undefined);
 const denied=await s.handlers.spoty(new Request('spoty://evil/videos/example.mp4'));assert.equal(denied.status,403);
});
test('isolated chrome cannot read session vault and iframe cannot resize window',async()=>{
 const s=setup();await new Promise(setImmediate);const[chrome,page]=s.views;
 const command=JSON.stringify({id:1,command:'vaultGet'});
 assert.throws(()=>s.ipc['spoty:command']({sender:chrome.webContents,senderFrame:chrome.webContents.mainFrame},command));
 assert.throws(()=>s.ipc['spoty:command']({sender:page.webContents,senderFrame:{url:'spoty://app/index.html'}},command));
 assert.equal(s.ipc['spoty:command']({sender:page.webContents,senderFrame:page.webContents.mainFrame},command).result.token,null);
 s.ipc['spoty:window']({sender:page.webContents,senderFrame:page.webContents.mainFrame},{action:'resize',phase:'start',edge:'e'});
 s.ipc['spoty:window']({sender:page.webContents,senderFrame:page.webContents.mainFrame},{action:'resize',phase:'move',edge:'e'});
 assert.equal(s.calls.filter(x=>x[0]==='bounds').length,0);
});
test('host visibility reaches decorations without throttling the music renderer',async()=>{
 const s=setup();await new Promise(setImmediate);const window=s.windows[0],page=s.views[1],wc=page.webContents;
 const event={sender:wc,senderFrame:wc.mainFrame};
 assert.equal(page.options.webPreferences.backgroundThrottling,false);
 assert.equal(s.ipc['spoty:visibility-state'](event),false);
 window.minimized=true;window.emit('minimize');assert.equal(wc.sent.at(-1)[0],'spoty:visibility');assert.equal(wc.sent.at(-1)[1],true);
 window.minimized=false;window.emit('restore');assert.equal(wc.sent.at(-1)[1],false);
 window.visible=false;window.emit('hide');assert.equal(wc.sent.at(-1)[1],true);
 window.visible=true;window.emit('show');assert.equal(wc.sent.at(-1)[1],false);
 assert.throws(()=>s.ipc['spoty:visibility-state']({sender:s.views[0].webContents,senderFrame:s.views[0].webContents.mainFrame}));
});
