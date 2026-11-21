import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApp,hashPassword,CONSENT,dayOf} from '../server/core.mjs';
import {openSQLite} from '../server/sqlite.mjs';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
const origin='http://127.0.0.1:8890';
function setup(){const store=openSQLite(':memory:'),password='Test-'+randomUUID(),config={mode:'local',secret:randomUUID()+randomUUID(),adminSalt:'classroom-test',adminHash:hashPassword(password,'classroom-test'),collectionCode:'CLASSROOM-TEST',siteUrl:origin};return {store,password,app:createApp({store,config})};}
async function req(app,path,data,cookie=''){const r=await app.handle(new Request(origin+'/api/data/'+path,{method:data===undefined?'GET':'POST',headers:{...(data===undefined?{}:{Origin:origin,'Content-Type':'application/json'}),Cookie:cookie},...(data===undefined?{}:{body:JSON.stringify(data)})}));return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
const event=(id,type,data,lessonId)=>({id,type,data,lessonId,occurredAt:new Date().toISOString()});
test('70人任务：固定学号跨设备去重、最近作答统计、报告与人工核对分离',async()=>{
 const {app,store,password}=setup(),t=await req(app,'login',{password});
 assert.equal((await req(app,'classroom/classes')).status,401);
 const c=await req(app,'classroom/classes',{name:'高一测试班',students:Array.from({length:70},(_,i)=>({no:String(i+1).padStart(3,'0'),alias:'测试学生'+(i+1)}))},t.cookie);assert.equal(c.status,200);assert.equal(c.data.classroom.students.length,70);
 const roster=c.data.classroom.students;const pub=await req(app,'classes');assert.deepEqual(pub.data,{classes:[{name:'高一测试班'}]});assert.equal(roster[0].code,undefined);assert.ok(!JSON.stringify(pub.data).includes('测试学生1'));
 const join=s=>req(app,'join',{code:'CLASSROOM-TEST',consent:true,consentVersion:CONSENT,className:'高一测试班',studentNo:s.no});
 assert.equal((await join({...roster[0],no:'INVALID NO!'})).status,400);
 assert.equal((await req(app,'join',{code:'WRONG',consent:true,consentVersion:CONSENT,className:'高一测试班',studentNo:roster[0].no})).status,403);
 const s1=await join(roster[0]),s1Again=await join(roster[0]),s2=await join(roster[1]);assert.notEqual(s1.data.participant.id,s1Again.data.participant.id);assert.equal(s1.data.participant.studentId,s1Again.data.participant.studentId);
 const lesson=await req(app,'classroom/lessons',{className:'高一测试班',title:'滴定课堂',date:dayOf(new Date()),questionIds:['s01','e01'],experimentIds:['tit'],requireReport:true},t.cookie);assert.equal(lesson.status,200);const id=lesson.data.lesson.id;
 assert.equal((await req(app,'student/lessons',undefined,s1.cookie)).data.lessons[0].id,id);
 const p=(eventId,score)=>event(eventId,'practice',{questionId:'s01',title:'离子共存',topic:'物质与反应',questionType:'single',score,max:4,pending:0,answers:{choice:score?0:1},attempt:score?2:1},id);
 await req(app,'collect',{events:[p('first',0)]},s1.cookie);await new Promise(r=>setTimeout(r,3));
 const manual=event('manual','practice',{questionId:'e01',title:'滴定操作',topic:'实验探究',questionType:'experiment',score:4,max:4,pending:6,answers:{a:'25',b:'.1',c:'润洗会引入额外酸。'}},id);
 const report=event('report','experiment',{experimentId:'tit',name:'滴定',action:'report',report:{observations:['浅粉色'],conclusion:'接近终点',reflection:'读数平视'}},id);
 await req(app,'collect',{events:[p('last',4),manual,report]},s1Again.cookie);
 await req(app,'collect',{events:[event('s2-view','usage',{action:'view',view:'practice',activeSeconds:0},id)]},s2.cookie);
 const guest=await req(app,'join',{code:'CLASSROOM-TEST',consent:true,consentVersion:CONSENT,className:'高一测试班',alias:'测试学生1'});await req(app,'collect',{events:[event('guest','usage',{action:'visit',view:'home',activeSeconds:0},id)]},guest.cookie);
 let overview=(await req(app,'classroom/overview?lesson='+id,undefined,t.cookie)).data;
 assert.equal(overview.summary.expected,70);assert.equal(overview.summary.participated,2);assert.equal(overview.summary.temporary,1);assert.equal(overview.summary.complete,1);assert.equal(overview.summary.pending,2);
 assert.equal(overview.questions.find(q=>q.id==='s01').submitted,1);assert.equal(overview.questions.find(q=>q.id==='s01').wrong,0);
 let profile=(await req(app,'classroom/student?lesson='+id+'&student=s_'+s1.data.participant.studentId,undefined,t.cookie)).data;
 assert.equal(profile.practice.find(p=>p.last.data.questionId==='s01').attempts,2);assert.equal(profile.practice.find(p=>p.last.data.questionId==='s01').first.data.score,0);assert.equal(profile.student.score,8);
 for(const e of [profile.practice.find(p=>p.last.id==='manual').last,profile.experiments[0].report])assert.equal((await req(app,'classroom/review',{event:{id:e.id,participantId:e.participantId,day:e.day}},t.cookie)).status,200);
 overview=(await req(app,'classroom/overview?lesson='+id,undefined,t.cookie)).data;assert.equal(overview.summary.pending,0);
 const manualRef=profile.practice.find(p=>p.last.id==='manual').last;
 await req(app,'classroom/review',{reviewed:false,event:{id:manualRef.id,participantId:manualRef.participantId,day:manualRef.day}},t.cookie);
 overview=(await req(app,'classroom/overview?lesson='+id,undefined,t.cookie)).data;assert.equal(overview.summary.pending,1);
 const updated=await req(app,'classroom/classes',{name:'高一测试班',students:roster.map(s=>({no:s.no,alias:s.alias}))},t.cookie);assert.equal(updated.data.classroom.students[0].code,undefined);assert.equal(updated.data.classroom.students[0].id,roster[0].id);
 assert.equal((await req(app,'classroom/overview?lesson='+id+'&page=1',undefined,t.cookie)).data.students.length,25);
 await req(app,'classroom/lessons/status',{id,active:false},t.cookie);assert.equal((await req(app,'student/lessons',undefined,s1.cookie)).data.lessons.length,0);
 store.close();
});
test('不同班级任务不能混传，核对权限和非法名单、日期被拒绝',async()=>{
 const {app,store,password}=setup(),t=await req(app,'login',{password});
 assert.equal((await req(app,'classroom/classes',{name:'测试班',students:[{no:'001'},{no:'001'}]},t.cookie)).status,400);
 await req(app,'classroom/classes',{name:'甲班',students:[{no:'001'}]},t.cookie);
 const l=await req(app,'classroom/lessons',{className:'甲班',title:'甲班任务',date:dayOf(new Date()),questionIds:['s01'],experimentIds:[]},t.cookie);
 const s=await req(app,'join',{code:'CLASSROOM-TEST',consent:true,consentVersion:CONSENT,className:'乙班'});
 assert.equal((await req(app,'collect',{events:[event('foreign','usage',{action:'visit',view:'home'},l.data.lesson.id)]},s.cookie)).status,400);
 assert.equal((await req(app,'classroom/review',{event:{}},s.cookie)).status,401);
 assert.equal((await req(app,'classroom/overview?from=2026-99-99',undefined,t.cookie)).status,400);
 assert.equal((await req(app,'classroom/overview?class='+encodeURIComponent('乙班')+'&lesson='+l.data.lesson.id,undefined,t.cookie)).status,400);
 store.close();
});
test('索引分页可查询超过一万条；清除、撤销与汇总使用相同可见范围',async()=>{
 const {app,store,password}=setup(),t=await req(app,'login',{password}),day=dayOf(new Date()),now=new Date().toISOString();
 for(let i=0;i<10120;i++)await store.setJSON('events/'+day+'/bulk/'+i,{id:'e'+i,participantId:'bulk',alias:'虚拟学生',className:'容量测试班',receivedAt:now,day,type:'usage',data:{action:'active',view:'games',activeSeconds:300}});
 const r=await req(app,'records?class='+encodeURIComponent('容量测试班')+'&page=100',undefined,t.cookie);assert.equal(r.status,200);assert.equal(r.data.total,10120);assert.equal(r.data.events.length,100);
 const o=await req(app,'classroom/overview?class='+encodeURIComponent('容量测试班'),undefined,t.cookie);assert.equal(o.status,200);assert.equal(o.data.total,1);assert.equal(o.data.students[0].activeSeconds,10120*300);
 await store.setJSON('cleared/bulk/e0',{active:true,operationId:'test-clear'});assert.equal((await req(app,'records',undefined,t.cookie)).data.total,10119);
 await store.setJSON('cleared/bulk/e0',{active:false,operationId:'test-clear'});assert.equal((await req(app,'records',undefined,t.cookie)).data.total,10120);
 store.close();
});
test('旧数据库自动建立索引，保留原始记录和已清除状态',async()=>{
 const dir=new URL('../.private/classroom-migration-test/',import.meta.url);fs.mkdirSync(dir,{recursive:true});const file=new URL(randomUUID()+'.sqlite',dir);const db=new DatabaseSync(file);db.exec('CREATE TABLE records(key TEXT PRIMARY KEY,body TEXT NOT NULL)');const day=dayOf(new Date()),e={id:'old',participantId:'guest',alias:'旧记录',className:'旧班',type:'usage',day,receivedAt:new Date().toISOString(),data:{action:'visit',view:'home',activeSeconds:0}};
 db.prepare('INSERT INTO records VALUES (?,?)').run('events/'+day+'/guest/old',JSON.stringify(e));db.prepare('INSERT INTO records VALUES (?,?)').run('cleared/guest/old',JSON.stringify({active:true}));db.close();
 const store=openSQLite(file);assert.deepEqual(await store.get('events/'+day+'/guest/old'),e);assert.equal((await store.queryEvents({from:day,to:day})).total,0);await store.setJSON('cleared/guest/old',{active:false});assert.equal((await store.queryEvents({from:day,to:day})).total,1);store.close();
});
test('课堂任务包含跨日补交，SQL索引和云端存储接口行为一致',async()=>{
 for(const indexed of [true,false]){
  const db=openSQLite(':memory:'),store=indexed?db:{get:db.get,setJSON:db.setJSON,list:db.list},password='Late-Test-'+randomUUID(),app=createApp({store,config:{mode:indexed?'local':'cloud',secret:randomUUID()+randomUUID(),adminSalt:'late',adminHash:hashPassword(password,'late'),collectionCode:'CLASSROOM-TEST',siteUrl:origin}}),teacher=await req(app,'login',{password});
  const c=await req(app,'classroom/classes',{name:'补交测试班',students:[{no:'001',alias:'虚拟学习者'}]},teacher.cookie),s=c.data.classroom.students[0];
  const lesson=await req(app,'classroom/lessons',{className:'补交测试班',title:'历史课次补交',date:'2020-01-01',questionIds:['s01'],experimentIds:[]},teacher.cookie);
  const joined=await req(app,'join',{code:'CLASSROOM-TEST',className:'补交测试班',studentNo:s.no,consent:true,consentVersion:CONSENT});
  await req(app,'collect',{events:[event('late-answer','practice',{questionId:'s01',title:'离子共存',topic:'物质与反应',questionType:'single',score:4,max:4,answers:{choice:0}},lesson.data.lesson.id)]},joined.cookie);
  const o=await req(app,'classroom/overview?from=2020-01-01&to=2020-01-01&lesson='+lesson.data.lesson.id,undefined,teacher.cookie);assert.equal(o.status,200);assert.equal(o.data.summary.complete,1);assert.equal(o.data.students[0].score,4);
  db.close();
 }
});

test('学生自助加入自动新增名单，无预录也可进入，重复加入沿用档案',async()=>{const {app,password,store}=setup();const input={code:'CLASSROOM-TEST',consent:true,consentVersion:CONSENT,studentNo:'005',alias:'Xyt',className:'自助测试班'};const first=await req(app,'join',input),second=await req(app,'join',input);assert.equal(first.status,200);assert.equal(second.data.participant.studentId,first.data.participant.studentId);const t=await req(app,'login',{password}),c=await req(app,'classroom/classes',undefined,t.cookie);assert.equal(c.data.classes[0].students.length,1);assert.equal(c.data.classes[0].students[0].no,'005');assert.equal(c.data.classes[0].students[0].alias,'Xyt');const saved=await req(app,'classroom/classes',{name:'自助测试班',students:[{no:'005',alias:'新昵称'}]},t.cookie);assert.equal(saved.data.classroom.students[0].id,first.data.participant.studentId);assert.equal((await req(app,'classroom/classes',undefined,t.cookie)).data.classes[0].students[0].alias,'新昵称');assert.equal((await req(app,'join',{...input,className:'',studentNo:'006'})).data.participant.className,'未分班');store.close();});
