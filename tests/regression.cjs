/* No network or live database calls. Run: node tests/regression.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
class Element {
  constructor() { this.children=[]; this.style={}; this.dataset={}; this.value=''; this.innerHTML=''; this.textContent=''; this.options=[]; this.files=[]; this.listeners={}; this.classList={add(){},remove(){},toggle(){}}; }
  appendChild(el){ this.children.push(el); return el; }
  prepend(el){this.children.unshift(el);}
  replaceChildren(...els){ this.children=els; this.innerHTML=''; }
  querySelector(){ return new Element(); }
  querySelectorAll(){ return []; }
  addEventListener(name,fn){this.listeners[name]=fn;}
  setAttribute(){}
  remove(){}
  closest(){return new Element();}
}
function environment(){
  const nodes=new Map(), listeners={},writes=[];
  const document={visibilityState:'visible',hidden:false,documentElement:new Element(),body:new Element(),
    getElementById(id){if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},
    createElement(){return new Element();},querySelectorAll(){return [];},querySelector(){return new Element();},
    addEventListener(name,fn){(listeners[name]??=[]).push(fn);}, hasFocus(){return true;}};
  const session=new Map();
  const ctx={document,console,navigator:{},Element,URL,Blob,Date,Math,Set,Promise,TextEncoder,
    setTimeout,clearTimeout,setInterval:()=>0,clearInterval(){},
    sessionStorage:{getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)},
    location:{href:'https://example.test',reload(){}},addEventListener(){},alert(){},confirm:()=>true,
    initializeApp:()=>({}),getFirestore:()=>({}),doc:(_db,...parts)=>({id:parts.at(-1)||'result',path:parts.join('/')}),
    collection:(_db,name)=>({id:name}),getDoc:async()=>({exists:()=>true,data:()=>({showStudentReport:true})}),
    getDocs:async()=>({docs:[]}),setDoc:async(ref,payload)=>{writes.push({ref,payload});},updateDoc:async()=>{},
    documentId:()=> '__name__',
    writeBatch:()=>{ const ops=[]; return {set:(ref,payload)=>ops.push({ref,payload}),delete:ref=>ops.push({ref,deleted:true}),commit:async()=>{writes.push(...ops);}}; },
    onSnapshot:(ref,cb,error)=>{ctx.policy=cb;ctx.policyError=error;},query(){},where(){}};
  ctx.window=ctx;vm.createContext(ctx);
  return {ctx,nodes,writes,listeners,run:code=>vm.runInContext(code,ctx)};
}
function loadApp(env,file){
  for(const name of ['question-bank.js','exam-report.js','result-archive.js','admin-report.js','screen-awake.js'])env.run(read(name));
  const script=[...read(file).matchAll(/<script\b[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/g)][0][1];
  env.run(script.replace(/import\s+[\s\S]*?\s+from\s+"[^"]+";/g,''));
}
async function main(){
  const e=environment();loadApp(e,'index.html');
  e.run(`questionsList = [
    {q:'Select lowercase',options:['velocity','Velocity'],a:'velocity'},
    {q:'Hindi / English',options:['वेग / velocity','Force'],a:'Force'},
    {q:'Unattempted',options:['x','X'],a:'X'}
  ].map((q,i)=>({...QuestionBank.normalizeQuestionRecord(q,i,'fixture'),__subject:'physics'}));
  selectedAnswers={0:0,1:0}; currentStudentName='Test Student'; currentStudentEmail='test@example.invalid';
  examSessionId='fixture-attempt'; isExamActive=true; examStartTime=Date.now()-60000;
  securityEvents=[{reason:'PAGE_HIDDEN_OR_APP_SWITCH',time:Date.now()},{reason:'QUESTION_REPLACED',time:Date.now()}]; tabSwitches=1;`);
  e.ctx.policy({exists:()=>true,data:()=>({showStudentReport:false})});
  e.run('calculateAndShowResults()');
  await e.run('savePerformanceDraft()');
  assert.equal(e.nodes.get('student-report-content').hidden,true);
  assert.equal(e.nodes.get('download-report-btn').hidden,true);
  assert.equal(e.nodes.get('review-ledger-container').children.length,0);
  assert.equal(e.nodes.get('result-page-title').textContent,'Test Completed');
  const saved=e.writes.find(x=>x.ref.path==='results/fixture-attempt').payload;
  const details=JSON.parse(saved.answerDetailsJson);
  assert.equal(details.length,3);assert.equal(saved.correct,1);assert.equal(saved.wrong,1);
  assert.equal(details[0].selectedAnswer,'velocity');assert.equal(details[1].isCorrect,false);assert.equal(details[2].attempted,false);
  assert.equal(saved.securityEvents.length,2);assert.equal(saved.submissionStatus,'submitted');
  e.run('calculateAndShowResults();');await e.run('savePerformanceDraft()');
  assert.equal(e.writes.filter(x=>x.ref.path.startsWith('results/')).length,1,'one saved result per attempt');
  e.ctx.policy({exists:()=>true,data:()=>({showStudentReport:true})});
  assert.equal(e.nodes.get('student-report-content').hidden,false);assert.equal(e.nodes.get('review-ledger-container').children.length,3);
  e.ctx.policy({exists:()=>true,data:()=>({showStudentReport:false})});
  assert.equal(e.nodes.get('review-ledger-container').children.length,0,'live OFF removes answer content');
  e.ctx.policy({exists:()=>true,data:()=>({})});assert.equal(e.nodes.get('student-report-content').hidden,false,'legacy config preserves report');
  e.ctx.policyError();assert.equal(e.nodes.get('student-report-content').hidden,true,'permission error hides report');
  assert.match(read('index.html'),/\.option-label\s*\{\s*text-transform:\s*none/);
  assert.match(e.ctx.ExamReport.physicsToHTML('velocity / Velocity / x / X / वेग'),/velocity \/ Velocity \/ x \/ X \/ वेग/);
  assert.match(e.ctx.ExamReport.physicsToHTML('<img onerror=alert(1)>'),/&lt;img/);
  assert.match(e.ctx.ExamReport.renderQuestionTable({headers:['x','X'],rows:[['small','CAPITAL']]}),/<th>.*x/);
  const caseQuestion=e.ctx.QuestionBank.normalizeQuestionRecord({q:'Case-sensitive option',options:['x','X'],a:'X'},0,'case');
  assert.equal(caseQuestion.__correctIndex,1);
  const bracketQuestion=e.ctx.QuestionBank.normalizeQuestionRecord({q:'Chargaff',options:['[A] + [G] = [T] + [C]','Other'],a:'[A] + [G] = [T] + [C]'},0,'bracket');
  assert.equal(bracketQuestion.__correctIndex,0);
  assert.equal(e.ctx.QuestionBank.normalizeQuestionRecord({q:'Label',options:['one','two'],a:'B)'},0,'label').__correctIndex,1);
  let total=0;
  for(const file of fs.readdirSync(path.join(root,'question')).filter(file=>fs.statSync(path.join(root,'question',file)).isFile())) {
    const bank=e.ctx.QuestionBank.validateBank(JSON.parse(read('question/'+file)),file);
    assert.equal(bank.filter(q=>q.__answerMode!=='text'&&!q.__correctIndices.length).length,0,file+' unresolved answer keys');
    total+=bank.length;
  }
  assert.equal(total,235);
  console.log('PASS: all 235 active bundled questions have resolvable answer keys; case, bracket and legacy-label regressions');
  console.log('PASS: report OFF/ON/live update/error, unchanged saved answers, score, duplicate submission and case preservation');

  assert(!read('index.html').includes('Retry Result Save'));
  assert.match(e.nodes.get('result-page-description').textContent,/^Thank you for attempting the test/);
  const retry=environment();loadApp(retry,'index.html');
  const scheduled=new Map();let timerId=0,calls=0;
  retry.ctx.setTimeout=(fn,ms)=>{scheduled.set(++timerId,{fn,ms});return timerId;};
  retry.ctx.clearTimeout=id=>scheduled.delete(id);
  retry.ctx.setDoc=async()=>{calls++;if(calls===1)throw Error('simulated offline');};
  retry.run("examFinishedAt=Date.now();examSessionId='retry-fixture';");
  const first=retry.run('savePerformanceDraft()');
  assert.equal(first,retry.run('savePerformanceDraft()'),'concurrent saves share promise');
  assert.equal(await first,false);
  assert.equal(scheduled.size,1);assert.equal([...scheduled.values()][0].ms,2000);
  assert.match(retry.nodes.get('result-save-status').textContent,/retry automatically/);
  const task=[...scheduled.values()][0];scheduled.clear();task.fn();
  await retry.run('resultSavePromise');
  assert.equal(retry.run('resultSaved'),true);assert.equal(scheduled.size,0);
  assert.match(retry.nodes.get('result-save-status').textContent,/submitted successfully/);
  const expired=environment();loadApp(expired,'index.html');let intervals=0;
  expired.ctx.setInterval=()=>{intervals++;};
  expired.run("isExamActive=true;sessionStorage.setItem('examEndTime',String(Date.now()-1000));startExamTimer(60);");
  await expired.run('savePerformanceDraft()');
  assert.equal(expired.run('isExamActive'),false);assert.equal(intervals,0);
  assert.equal(expired.run('frozenResultPayload.submissionReason'),'time_up');
  console.log('PASS: automatic retry, concurrent-save deduplication, success cancels retry; expired timer cannot restart');

  const a=environment();loadApp(a,'admin.html');
  a.ctx.document.getElementById('config-show-student-report').checked=false;
  await a.nodes.get('save-report-visibility-btn').listeners.click();
  assert.equal(a.writes.at(-1).payload.showStudentReport,false);
  assert.equal(a.writes.at(-1).ref.path,'exam_config/current_test');
  a.ctx.fixture=saved;
  a.run(`allStudentResults=[normalizeResult({id:'fixture-attempt',data:()=>fixture})]; openDetails('fixture-attempt');`);
  assert.equal(a.nodes.get('admin-answer-ledger').children.length,3);
  assert.deepEqual(a.nodes.get('admin-answer-ledger').children.map(c=>c.dataset.answerStatus),['correct','wrong','unattempted']);
  const security=a.nodes.get('detail-content').children.at(-1);
  assert.equal(security.children[0].textContent,'Security Timeline');
  assert.equal(security.children.filter(c=>c.className==='security-event').length,2);
  a.run(`allStudentResults=[normalizeResult({id:'old',data:()=>({name:'Older student',score:'0/0'})})];openDetails('old');`);
  assert.match(a.nodes.get('admin-answer-ledger').children[0].textContent,/not stored/);
  console.log('PASS: admin complete stored ledger, security timeline and old-record compatibility');

  const large=environment();loadApp(large,'index.html');
  large.run(`questionsList=[{...QuestionBank.normalizeQuestionRecord({q:'Image question',options:['x','X'],a:'X',image:'data:image/png;base64,'+'a'.repeat(400000)},0,'image'),__subject:'physics'}];
    selectedAnswers={0:1}; examSessionId='large-attempt'; isExamActive=true; examStartTime=Date.now(); calculateAndShowResults();`);
  await large.run('savePerformanceDraft()');
  const largeRecord=large.writes.find(x=>x.ref.path==='results/large-attempt').payload;
  assert(largeRecord.answerDetailsArchive.count>1);
  assert.equal(largeRecord.answerDetailsJson,'');
  const parts=new Map(large.writes.filter(x=>x.payload?.recordType==='report_chunk').map(x=>[x.ref.id,x.payload]));
  const viewer=environment();loadApp(viewer,'admin.html');viewer.ctx.fixture=largeRecord;
  viewer.ctx.getDoc=async ref=>({exists:()=>parts.has(ref.id),data:()=>parts.get(ref.id)});
  await viewer.run(`allStudentResults=[normalizeResult({id:'large-attempt',data:()=>fixture})];openDetails('large-attempt');`);
  assert.equal(viewer.nodes.get('print-report-btn').disabled,false);
  assert.equal(viewer.run('allStudentResults[0].answerDetails[0].media[0].length'),400022);
  parts.clear();
  await viewer.run(`allStudentResults[0].archiveLoaded=false;openDetails('large-attempt');`);
  assert.equal(viewer.nodes.get('print-report-btn').disabled,true);
  assert.match(viewer.nodes.get('detail-content').textContent,/could not be loaded/);
  const optionImage=e.ctx.QuestionBank.normalizeQuestionRecord({q:'Diagram options',options:[{text:'One',image:'one.png'},{text:'Two',image:'two.png'}],a:'Two'},0,'images');
  assert.equal(optionImage.__optionMedia[1][0].src,'two.png');
  console.log('PASS: full student large-image save to admin View; incomplete archive blocks export; image options retain media');

  const w=environment();let requests=0,locks=[];
  w.ctx.navigator.wakeLock={request:async()=>{requests++;const lock={released:false,addEventListener(name,cb){this.onRelease=cb;},async release(){this.released=true;this.onRelease?.();}};locks.push(lock);return lock;}};
  w.run(read('screen-awake.js'));await w.ctx.ExamScreenAwake.start();await w.ctx.ExamScreenAwake.start();
  assert.equal(requests,1);assert.match(w.nodes.get('screen-awake-status').textContent,/stay on/);
  w.ctx.document.visibilityState='hidden';await locks[0].release();
  w.ctx.document.visibilityState='visible';await w.listeners.visibilitychange[0]();assert.equal(requests,2);
  w.ctx.ExamScreenAwake.stop();assert.equal(locks[1].released,true);
  await w.listeners.visibilitychange[0]();assert.equal(requests,2,'no reacquire after submit');
  let resolve;w.ctx.navigator.wakeLock.request=()=>new Promise(r=>resolve=r);
  const inFlight=w.ctx.ExamScreenAwake.start();w.ctx.ExamScreenAwake.stop();
  const late={released:false,async release(){this.released=true;}};resolve(late);await inFlight;assert.equal(late.released,true);
  w.ctx.navigator.wakeLock.request=async()=>{throw Error('denied');};await w.ctx.ExamScreenAwake.start();assert.match(w.nodes.get('screen-awake-status').textContent,/unavailable/);w.ctx.ExamScreenAwake.stop();
  delete w.ctx.navigator.wakeLock;await w.ctx.ExamScreenAwake.start();assert.match(w.nodes.get('screen-awake-status').textContent,/timeout/);w.ctx.ExamScreenAwake.stop();
  console.log('PASS: wake-lock acquire, deduplication, visibility recovery, release, late resolution, rejection and unsupported browser');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
