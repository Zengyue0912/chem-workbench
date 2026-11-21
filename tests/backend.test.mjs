import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp,hashPassword,CONSENT,dayOf,validateEvent} from '../server/core.mjs';
import {openSQLite} from '../server/sqlite.mjs';
import {randomBytes} from 'node:crypto';
function setup(){const store=openSQLite(':memory:'),password=randomBytes(20).toString('hex'),config={mode:'local',secret:randomBytes(48).toString('hex'),adminSalt:'test-salt',adminHash:hashPassword(password,'test-salt'),collectionCode:'CLASS-TEST',siteUrl:'http://127.0.0.1:8890'};return {store,password,app:createApp({store,config})};}
async function req(app,path,data,cookie='',origin='http://127.0.0.1:8890'){const r=await app.handle(new Request('http://127.0.0.1:8890/api/data/'+path,{method:data===undefined?'GET':'POST',headers:{...(data===undefined?{}:{'Content-Type':'application/json','Origin':origin}),...(cookie?{Cookie:cookie}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}));const d=await r.json();return {status:r.status,data:d,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
const usage=id=>({id,occurredAt:new Date().toISOString(),type:'usage',data:{action:'visit',view:'home',activeSeconds:0}});

test('清除需教师身份和有效预览；跨站与学生请求不能清除',async()=>{
 const {app,password,store}=setup();
 const student=await req(app,'join',{code:'CLASS-TEST',consent:true,consentVersion:CONSENT});
 for(const path of ['records/clear-preview','records/clear','records/restore'])assert.equal((await req(app,path,{},student.cookie)).status,401);
 const teacher=await req(app,'login',{password});
 assert.equal((await req(app,'records/clear',{planId:'missing'},teacher.cookie)).status,404);
 assert.equal((await req(app,'records/clear-preview',{},teacher.cookie,'https://untrusted.example')).status,403);
 const preview=await req(app,'records/clear-preview',{},teacher.cookie);assert.equal(preview.data.total,0);
 store.close();
});

test('按班级清除全部分页；保留其他班、预览后新记录和登录；重复上传不复活；可撤销',async()=>{
 const {app,password,store}=setup(),join=className=>req(app,'join',{code:'CLASS-TEST',className,consent:true,consentVersion:CONSENT});
 const a=await join('演示一班'),b=await join('演示二班'),teacher=await req(app,'login',{password});
 for(let i=0;i<105;i+=20)await req(app,'collect',{events:Array.from({length:Math.min(20,105-i)},(_,n)=>usage('a-'+(i+n)))},a.cookie);
 await req(app,'collect',{events:[usage('b-1')]},b.cookie);
 const preview=await req(app,'records/clear-preview',{class:'演示一班'},teacher.cookie);assert.equal(preview.data.total,105);
 assert.equal((await req(app,'records',undefined,teacher.cookie)).data.events.length,100);
 await req(app,'collect',{events:[usage('a-new')]},a.cookie);
 const cleared=await req(app,'records/clear',{planId:preview.data.planId},teacher.cookie);assert.equal(cleared.data.cleared,105);
 assert.equal((await req(app,'records/clear',{planId:preview.data.planId},teacher.cookie)).data.cleared,105);
 let records=await req(app,'records',undefined,teacher.cookie);assert.equal(records.data.total,2);assert.equal(records.data.summary.records,2);
 await req(app,'collect',{events:[usage('a-0')]},a.cookie);assert.equal((await req(app,'records',undefined,teacher.cookie)).data.total,2);
 assert.equal((await req(app,'me',undefined,a.cookie)).status,200);assert.equal((await req(app,'login',{password})).status,200);
 const restored=await req(app,'records/restore',{operationId:cleared.data.operationId},teacher.cookie);assert.equal(restored.data.restored,105);
 records=await req(app,'records',undefined,teacher.cookie);assert.equal(records.data.total,107);
 assert.equal((await req(app,'records/restore',{operationId:cleared.data.operationId},teacher.cookie)).data.restored,105);
 store.close();
});

test('类型、关键词及日期限定清除；班级清空后选项消失；过期预览不能执行',async()=>{
 const {app,password,store}=setup(),teacher=await req(app,'login',{password});
 const s=await req(app,'join',{code:'CLASS-TEST',className:'待清空班',consent:true,consentVersion:CONSENT});
 const p={id:'practice-clear',type:'practice',data:{questionId:'s01',title:'离子共存',topic:'物质与反应',questionType:'single',score:0,max:4,answers:{choice:1}}};
 await req(app,'collect',{events:[usage('keep'),p]},s.cookie);
 const oldDay='2026-01-01';const historical={...usage('old-date'),participantId:s.data.participant.id,className:'待清空班',receivedAt:oldDay+'T04:00:00Z',day:oldDay};await store.setJSON('events/'+oldDay+'/'+s.data.participant.id+'/old-date',historical);
 let preview=await req(app,'records/clear-preview',{type:'practice',q:'离子'},teacher.cookie);assert.equal(preview.data.total,1);
 await req(app,'records/clear',{planId:preview.data.planId},teacher.cookie);assert.equal((await req(app,'records',undefined,teacher.cookie)).data.total,1);
 preview=await req(app,'records/clear-preview',{class:'待清空班'},teacher.cookie);const key='clear-plans/'+preview.data.planId;
 const expired=await store.get(key);await store.setJSON(key,{...expired,expiresAt:0});assert.equal((await req(app,'records/clear',{planId:preview.data.planId},teacher.cookie)).status,409);
 preview=await req(app,'records/clear-preview',{class:'待清空班'},teacher.cookie);
 const otherTeacher=await req(app,'login',{password});assert.equal((await req(app,'records/clear',{planId:preview.data.planId},otherTeacher.cookie)).status,404);
 await req(app,'records/clear',{planId:preview.data.planId},teacher.cookie);const remaining=await req(app,'records',undefined,teacher.cookie);assert.equal(remaining.data.total,0);assert.deepEqual(remaining.data.classes,[]);
 assert.equal((await req(app,'records?from='+oldDay+'&to='+oldDay,undefined,teacher.cookie)).data.total,1);
 store.close();
});
test('学生同意和参加码为必需项；未加入时不接受记录',async()=>{const {app}=setup();assert.equal((await req(app,'collect',{events:[usage('a')]})).status,401);assert.equal((await req(app,'join',{code:'CLASS-TEST',consent:false,consentVersion:CONSENT})).status,400);assert.equal((await req(app,'join',{code:'WRONG',consent:true,consentVersion:CONSENT})).status,403);});
test('教师记录接口要求登录，伪造cookie被拒绝',async()=>{const {app,password}=setup();assert.equal((await req(app,'records')).status,401);const login=await req(app,'login',{password});assert.equal(login.status,200);assert.equal((await req(app,'teacher',undefined,login.cookie+'x')).status,401);assert.equal((await req(app,'teacher',undefined,login.cookie)).status,200);});
test('重复上传幂等；身份由签名会话决定；报告姓名不入库',async()=>{const {app,store,password}=setup();const joined=await req(app,'join',{code:'CLASS-TEST',consent:true,consentVersion:CONSENT,alias:'S01',className:'高二1班'}),event={...usage('same-event'),participantId:'forged'};assert.equal((await req(app,'collect',{events:[event]},joined.cookie)).status,200);await req(app,'collect',{events:[event]},joined.cookie);const login=await req(app,'login',{password}),records=await req(app,'records',undefined,login.cookie);assert.equal(records.data.total,1);assert.equal(records.data.events[0].participantId,joined.data.participant.id);assert.notEqual(records.data.events[0].participantId,'forged');const report={id:'report-1',type:'experiment',data:{experimentId:'tit',action:'report',report:{name:'PRIVATE-NAME',teacher:'PRIVATE-TEACHER',observations:['无色变浅粉红'],conclusion:'结论',reflection:'复查读数'}}};await req(app,'collect',{events:[report]},joined.cookie);const all=await req(app,'records',undefined,login.cookie);assert(!JSON.stringify(all.data).includes('PRIVATE-NAME'));assert(!JSON.stringify(all.data).includes('PRIVATE-TEACHER'));store.close();});
test('整批参数先校验；得分越界或保留字段编号均拒绝',async()=>{const {app,password}=setup();const u=await req(app,'join',{code:'CLASS-TEST',consent:true,consentVersion:CONSENT});const bad={id:'bad',type:'practice',data:{questionId:'s01',title:'题',topic:'章',questionType:'single',score:5,max:4,answers:{choice:1}}};assert.equal((await req(app,'collect',{events:[usage('good'),bad]},u.cookie)).status,400);const t=await req(app,'login',{password});assert.equal((await req(app,'records',undefined,t.cookie)).data.total,0);assert.throws(()=>validateEvent({...usage('__proto__')}));});
test('跨站写入被拒绝；停止上传后旧cookie也被服务端拒绝',async()=>{const {app}=setup();assert.equal((await req(app,'join',{code:'CLASS-TEST',consent:true,consentVersion:CONSENT},'','https://elsewhere.example')).status,403);const u=await req(app,'join',{code:'CLASS-TEST',consent:true,consentVersion:CONSENT});const leave=await req(app,'leave',{},u.cookie);assert.equal(leave.status,200);assert.equal(leave.cookie,'chem_participant=');assert.equal((await req(app,'collect',{events:[usage('after-stop')]},u.cookie)).status,401);});
test('练习与实验进入统计；日期按上海时区；范围和页码限制',async()=>{const {app,password}=setup();assert.equal(dayOf(new Date('2026-11-05T16:10:00Z')),'2026-11-06');const u=await req(app,'join',{code:'CLASS-TEST',consent:true,consentVersion:CONSENT});const practice={id:'p01',type:'practice',data:{questionId:'s01',title:'离子共存',topic:'物质与反应',questionType:'single',score:0,max:4,pending:0,attempt:1,answers:{choice:1}}};await req(app,'collect',{events:[usage('visit'),practice,{id:'exp01',type:'experiment',data:{experimentId:'tit',action:'trial',readings:{standard:.1,aliquot:25,used:25,concentration:.1}}}]},u.cookie);const t=await req(app,'login',{password}),r=await req(app,'records',undefined,t.cookie);assert.equal(r.data.summary.participants,1);assert.equal(r.data.summary.practiceAttempts,1);assert.equal(r.data.summary.experimentRecords,1);assert.equal(r.data.summary.questions[0].needsReview,1);assert.equal((await req(app,'records?from=2026-01-01&to=2026-03-01',undefined,t.cookie)).status,400);assert.equal((await req(app,'records?page=-1',undefined,t.cookie)).status,400);});
