/* Isolated navigation behavior; no live records or browser calls. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
class Target {
  constructor(){this.events={};this.open=false;}
  addEventListener(k,fn){(this.events[k]??=new Set()).add(fn);}
  removeEventListener(k,fn){this.events[k]?.delete(fn);}
  async emit(k,e={}){e.preventDefault??=()=>{e.prevented=true;};for(const f of this.events[k]||[])await f(e);return e;}
  showModal(){this.open=true;}close(){this.open=false;}focus(){}click(){return this.emit('click');}
}
(async()=>{
  const win=new Target(),doc=new Target(),nodes=new Map();let active=true,unsaved=false,exits=0,reloads=0,pushes=0,backs=0,awake=0;
  doc.hidden=false;doc.getElementById=id=>{if(!nodes.has(id))nodes.set(id,new Target());return nodes.get(id);};
  const ctx={window:win,document:doc,history:{state:null,pushState(){pushes++;},back(){backs++;}},location:{href:'https://test.invalid',reload(){reloads++;}},Date,setTimeout:()=>0};
  win.ExamScreenAwake={start:()=>awake++};win.ExamSecurityGuard={requestFullscreen:async()=>{}};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../exam-navigation.js'),'utf8'),ctx);
  const g=win.ExamNavigationGuard,d=doc.getElementById('exam-navigation-dialog');
  g.start({active:()=>active,unsaved:()=>unsaved,exit:async()=>{exits++;active=false;unsaved=true;g.stop();}});
  g.start();assert.equal(pushes,1);
  await win.emit('popstate');assert(d.open);assert.equal(pushes,2);
  assert.equal(doc.getElementById('navigation-title').textContent,'Exit this test?');
  await doc.getElementById('navigation-no').click();assert(!d.open);assert(active);assert.equal(exits,0);assert.equal(awake,1);
  let e=await win.emit('beforeunload');assert(e.prevented);assert.equal(exits,0,'cancelled native refresh cannot submit');
  e=await doc.emit('keydown',{key:'F5'});assert(e.prevented);assert(d.open);
  assert.equal(doc.getElementById('navigation-title').textContent,'Refresh this page?');
  await doc.getElementById('navigation-no').click();assert.equal(reloads,0);
  await doc.emit('keydown',{key:'r',ctrlKey:true});await doc.getElementById('navigation-yes').click();assert.equal(reloads,1);
  assert(!(await win.emit('beforeunload')).prevented,'confirmed keyboard reload bypasses duplicate prompt once');
  assert((await win.emit('beforeunload')).prevented,'future reload remains protected');
  assert(g.handleFullscreenExit());assert(d.open);await d.emit('cancel');assert(!d.open);assert(active);
  doc.hidden=true;assert.equal(g.handleFullscreenExit(),false);doc.hidden=false;
  await win.emit('popstate');await doc.getElementById('navigation-yes').click();await doc.getElementById('navigation-yes').click();
  assert.equal(exits,1);assert(!active);assert(!d.open);
  assert((await win.emit('beforeunload')).prevented,'pending results remain protected');
  unsaved=false;g.update();assert(!(await win.emit('beforeunload')).prevented);
  await win.emit('popstate');assert.equal(backs,1,'completed attempt skips duplicate history');
  console.log('PASS: Back/No, Back/Yes, fullscreen exit, Escape, keyboard refresh, native unload, pending save and completion cleanup');
})().catch(e=>{console.error(e);process.exitCode=1;});
