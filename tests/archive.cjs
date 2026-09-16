const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx={TextEncoder};ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../result-archive.js'),'utf8'),ctx);
const api=ctx.ExamResultArchive;
(async()=>{
 const small=[{question:'हिंदी / English',media:['data:image/png;base64,small'],options:['x','X']}];
 const inline=api.prepare(small,'attempt1');assert.equal(inline.chunks.length,0);assert.equal(inline.fields.answerDetailsJson,JSON.stringify(small));
 const details=[{question:'हिंदी 🧪 x + y '.repeat(70000),media:['data:image/png;base64,'+'a'.repeat(1300000)],optionMedia:[[{src:'data:image/png;base64,'+'b'.repeat(50000)}]],table:{rows:[['A','α']]}}];
 const big=api.prepare(details,'attempt1');assert(big.chunks.length>10);
 for(const chunk of big.chunks){assert(new TextEncoder().encode(JSON.stringify(chunk.data)).length<400000);assert(!/[\uD800-\uDBFF]$/.test(chunk.data.content));}
 const store=new Map();let groups=0;
 await api.save(big,async entries=>{assert(entries.length<=10);groups++;entries.forEach(e=>store.set(e.id,e.data));});assert(groups>1);
 const loaded=await api.load(big.fields,async id=>store.get(id));assert.equal(JSON.stringify(loaded),JSON.stringify(details));
 await assert.rejects(()=>api.load(big.fields,async()=>null),/incomplete/);
 const first=big.chunks[0];store.set(first.id,{...first.data,index:999});await assert.rejects(()=>api.load(big.fields,async id=>store.get(id)),/incomplete/);
 await api.save(big,async entries=>entries.forEach(e=>store.set(e.id,e.data)));
 assert.equal(store.size,big.chunks.length,'retry reuses part IDs');
 assert.deepEqual([...api.archiveIds(big.fields)],[...big.chunks.map(e=>e.id)]);
 let called=0;await assert.rejects(()=>api.save(big,async()=>{called++;throw Error('offline');}),/offline/);assert.equal(called,1);
 await assert.rejects(()=>api.load({answerDetailsArchive:{version:1,attemptId:'../bad',count:1,length:1}},()=>{}),/metadata/);
 assert.equal(JSON.stringify(await api.load({answerDetails:small},()=>{})),JSON.stringify(small));
 console.log('PASS: full embedded images, Unicode, multi-megabyte archive round trip, bounded batches, missing/corrupt parts, idempotent retry and legacy reports');
})().catch(e=>{console.error(e);process.exitCode=1;});
