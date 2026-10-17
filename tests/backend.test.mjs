import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/app.mjs';
import {firestoreRepository} from '../server/repository.mjs';
import {emptySchool} from '../server/validation.mjs';
function fakeFirestore(){
 const store=new Map([['edulearnAdmins/admin',{enabled:true}]]);let queue=Promise.resolve(),audit=0;
 const snap=key=>({exists:store.has(key),data:()=>structuredClone(store.get(key))});
 const reference=key=>({key,get:async()=>snap(key)});
 return {store,doc:reference,collection:collection=>({doc:()=>reference(`${collection}/audit-${++audit}`)}),runTransaction:fn=>{
  const result=queue.then(async()=>{const writes=[];const value=await fn({get:async ref=>snap(ref.key),set:(ref,data)=>writes.push([ref.key,data]),create:(ref,data)=>writes.push([ref.key,data])});for(const [key,data] of writes)store.set(key,structuredClone(data));return value});queue=result.catch(()=>{});return result;
 }};
}
function fixture(){const data=emptySchool('admin@example.com');data.classes.push({id:'c1',name:'Grade 4 – Rizal',grade:4,teacher:'',count:0,code:'RZL-4A7',completion:0,score:0,attendance:0,status:'Active'});return data}
async function start(t,{db=fakeFirestore(),verifyToken}={}){
 const repository=firestoreRepository(db);
 const app=createApp({repository,verifyToken:verifyToken||(async(token)=>{if(token==='revoked')throw Object.assign(Error('secret'),{code:'auth/id-token-revoked'});if(!['admin','member'].includes(token))throw Object.assign(Error('invalid'),{code:'auth/argument-error'});return {uid:token,email:`${token}@example.com`}})});
 const server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance))});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 const request=async(path,method='GET',body,token='admin',headers={})=>{const response=await fetch(base+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,body:await response.json()}};
 return {request,db,repository};
}
test('health does not expose data; every school endpoint requires verified administrator access',async t=>{
 const {request}=await start(t);
 assert.equal((await request('/api/health','GET',undefined,null)).status,200);
 assert.equal((await request('/api/school','GET',undefined,null)).status,401);
 assert.equal((await request('/api/school','GET',undefined,'revoked')).status,401);
 assert.equal((await request('/api/school','GET',undefined,'member')).status,403);
 assert.equal((await request('/api/me')).body.role,'administrator');
});
test('new projects receive empty school records and no sample people',async t=>{
 const {request}=await start(t);const result=await request('/api/school');assert.equal(result.status,200);assert.equal(result.body.revision,0);assert.equal(result.body.data.students.length,0);assert.equal(result.body.data.classes.length,0);
});
test('server preserves audit history, uses verified actor and ignores forged client logs',async t=>{
 const {request,db}=await start(t);const data=fixture();data.logs=[{date:'2000',who:'FORGED',type:'Settings',action:'FORGED'}];
 const result=await request('/api/school','PUT',{data,revision:0});assert.equal(result.status,200);assert.equal(result.body.revision,1);assert.equal(result.body.data.logs[0].who,'admin@example.com');assert.ok(!JSON.stringify(result.body).includes('FORGED'));assert.equal([...db.store.keys()].filter(k=>k.startsWith('edulearnAudit/')).length,1);
});
test('concurrent writes cannot overwrite a newer revision',async t=>{
 const {request}=await start(t);const results=await Promise.all([request('/api/school','PUT',{data:fixture(),revision:0}),request('/api/school','PUT',{data:fixture(),revision:0})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((await request('/api/school')).body.revision,1);
});
test('invalid foreign keys, duplicate IDs, negative revisions and direct passcode injection are rejected',async t=>{
 const {request}=await start(t);
 const bad=fixture();bad.students=[{id:'s1',name:'Test',classId:'unknown',status:'No passcode',passcode:'',last:'Never'}];assert.equal((await request('/api/school','PUT',{data:bad,revision:0})).status,400);
 const duplicate=fixture();duplicate.classes.push({...duplicate.classes[0]});assert.equal((await request('/api/school','PUT',{data:duplicate,revision:0})).status,400);
 assert.equal((await request('/api/school','PUT',{data:fixture(),revision:-1})).status,400);
 const forged=fixture();forged.students=[{id:'s1',name:'Test',classId:'c1',status:'Active',passcode:'FORGED1!',last:'Never'}];assert.equal((await request('/api/school','PUT',{data:forged,revision:0})).status,400);
 assert.equal((await request('/api/school')).body.revision,0);
});
test('roster import skips duplicates and server generates unique student passcodes',async t=>{
 const {request}=await start(t);await request('/api/school','PUT',{data:fixture(),revision:0});
 const imported=await request('/api/rosters/import','POST',{revision:1,classId:'c1',file:'roster.csv',rows:[{name:'Student A',guardianName:'Guardian A',email:'parent@example.com'},{name:'Student A'},{name:'Student B'}]});
 assert.equal(imported.status,200);assert.deepEqual(imported.body.summary,{added:2,skipped:1});assert.equal(imported.body.data.classes[0].count,2);
 const generated=await request('/api/passcodes','POST',{revision:2,classId:'c1'});assert.equal(generated.status,200);assert.equal(generated.body.summary.generated,2);const codes=generated.body.data.students.map(s=>s.passcode);assert.equal(new Set(codes).size,2);assert.ok(codes.every(code=>/^[A-Z2-9]{7}!$/.test(code)));
 const invalidEmail=await request('/api/rosters/import','POST',{revision:3,classId:'c1',file:'bad.csv',rows:[{name:'Student C',email:'not-an-email'}]});assert.equal(invalidEmail.status,400);
});
test('record CRUD renames linked guardians, prevents unsafe class deletion and removes linked contacts',async t=>{
 const {request}=await start(t);await request('/api/school','PUT',{data:fixture(),revision:0});
 const created=await request('/api/records/students','POST',{revision:1,record:{name:'Student A',classId:'c1'}});assert.equal(created.status,201);const student=created.body.data.students[0];
 const guardian=await request('/api/records/guardians','POST',{revision:2,record:{name:'Parent',student:'Student A',classId:'c1',email:'parent@example.com',report:'Not sent',consent:'Pending'}});assert.equal(guardian.status,201);
 const renamed=await request(`/api/records/students/${student.id}`,'PATCH',{revision:3,record:{name:'Updated Student'}});assert.equal(renamed.body.data.guardians[0].student,'Updated Student');
 assert.equal((await request('/api/records/classes/c1','DELETE',{revision:4})).status,409);
 const removed=await request(`/api/records/students/${student.id}`,'DELETE',{revision:4});assert.equal(removed.body.data.guardians.length,0);assert.equal(removed.body.data.classes[0].count,0);
 assert.equal((await request('/api/records/classes/c1','DELETE',{revision:5})).status,200);
});
test('membership revoked during a write is checked again inside its transaction',async t=>{
 const {db,repository}=await start(t);db.store.set('edulearnAdmins/admin',{enabled:false});await assert.rejects(repository.change(0,{uid:'admin'},data=>({data,action:'Unauthorized write'})),error=>error.status===403);assert.equal(db.store.has('edulearnSchool/main'),false);
});
test('cross-origin writes and oversized records cannot reach storage',async t=>{
 const {request}=await start(t);assert.equal((await request('/api/school','PUT',{data:fixture(),revision:0},'admin',{Origin:'https://unrelated.example'})).status,403);
 const data=fixture();data.settings.school='x'.repeat(200);assert.equal((await request('/api/school','PUT',{data,revision:0})).status,400);
 assert.equal((await request('/api/school','PUT',{data:'x'.repeat(950000),revision:0})).status,413);
});
test('unexpected verification failures return a recoverable error without leaking details',async t=>{
 const {request}=await start(t,{verifyToken:async()=>{throw Object.assign(Error('PRIVATE KEY DETAIL'),{code:'network-failure'})}});const result=await request('/api/school');assert.equal(result.status,503);assert.ok(!JSON.stringify(result).includes('PRIVATE KEY'));
});



test('production serves the built app but never source files or credentials',async t=>{
 const db=fakeFirestore(),app=createApp({repository:firestoreRepository(db),verifyToken:async()=>({uid:'admin',email:'admin@example.com'}),production:true,origin:'https://school.example'});
 const server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance))});t.after(()=>new Promise(resolve=>server.close(resolve)));const base=`http://127.0.0.1:${server.address().port}`;
 const page=await fetch(base+'/');assert.equal(page.status,200);assert.ok((await page.text()).includes('EduLearn'));
 assert.equal((await fetch(base+'/server/.env')).status,404);assert.equal((await fetch(base+'/.secrets/service-account.json')).status,404);
 const locked=await fetch(base+'/api/school');assert.equal(locked.status,401);assert.match(locked.headers.get('cache-control'),/no-store/);
});
