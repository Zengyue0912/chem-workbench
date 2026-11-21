import {createHash,randomUUID} from 'node:crypto';
import {catalog} from './course-catalog.mjs';
const fail=(s,status=400)=>{const e=Error(s);e.status=status;throw e;};
const clean=(s,n=100)=>typeof s==='string'&&s.trim().length<=n?s.trim():fail('填写内容过长或格式不正确。');
const hash=s=>createHash('sha256').update(s).digest('hex');
const classKey=name=>'classes/'+hash(name);
const studentKey=e=>e.studentId?'s_'+e.studentId:'g_'+e.participantId;
const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function readScope(params,today){const from=params.get('from')||today,to=params.get('to')||from;if(!date(from)||!date(to)||to<from||Date.parse(to)-Date.parse(from)>30*86400000)fail('请选择连续31天以内的有效日期。');return {from,to,className:clean(params.get('class')||'',40),lessonId:clean(params.get('lesson')||'',100),studentKey:clean(params.get('student')||'',110),type:clean(params.get('type')||'',30),q:clean(params.get('q')||'',100)};}
const when=e=>e.occurredAt||e.receivedAt;
const later=(a,b)=>when(a)>when(b)||(when(a)===when(b)&&a.receivedAt>b.receivedAt);
const publicLesson=l=>({id:l.id,title:l.title,className:l.className,date:l.date,questionIds:l.questionIds,experimentIds:l.experimentIds,requireReport:l.requireReport,active:l.active});
const reviewKey=e=>'reviews/'+e.participantId+'/'+e.id;
export function createClassroom({store}){
 async function list(prefix){const {blobs}=await store.list({prefix});const out=[];for(let i=0;i<blobs.length;i+=12)out.push(...(await Promise.all(blobs.slice(i,i+12).map(x=>store.get(x.key,{type:'json',consistency:'strong'})))).filter(Boolean));return out;}
 async function classes(){const base=(await list('classes/')).map(c=>({...c,students:c.students.map(({code,...student})=>student)}));for(const e of await list('enrollments/')){let c=base.find(c=>c.name===e.className);if(!c){c={name:e.className,students:[]};base.push(c);}const i=c.students.findIndex(s=>s.no===e.no);if(i<0)c.students.push(e);else if(e.active!==false)c.students[i]={...c.students[i],...e};}return base.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));}
 async function lessons(){return (await list('lessons/')).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));}
 async function* events(scope){if(store.iterEvents){yield* store.iterEvents(scope);return;}const groups=[];if(scope.allLesson&&scope.lessonId){const refs=await list('lesson-events/'+scope.lessonId+'/');const rows=[];for(const ref of refs){const e=await store.get(ref.key,{type:'json',consistency:'strong'});if(e)rows.push(e);}groups.push(rows);}else for(let d=Date.parse(scope.from+'T00:00:00Z');d<=Date.parse(scope.to+'T00:00:00Z');d+=86400000)groups.push(await list('events/'+new Date(d).toISOString().slice(0,10)+'/'));for(const rows of groups)for(const e of rows){if(scope.className&&e.className!==scope.className||scope.lessonId&&e.lessonId!==scope.lessonId||scope.studentKey&&studentKey(e)!==scope.studentKey||scope.type&&e.type!==scope.type)continue;if((await store.get('cleared/'+e.participantId+'/'+e.id,{type:'json',consistency:'strong'}))?.active)continue;yield e;}}
 async function selectedLesson(scope){if(!scope.lessonId)return null;const l=await store.get('lessons/'+scope.lessonId,{type:'json',consistency:'strong'});if(!l)fail('没有找到这个课堂任务。',404);if(scope.className&&l.className!==scope.className)fail('任务与所选班级不一致。');scope.className=l.className;scope.allLesson=true;return l;}
 function row(info){return {key:info.key,studentId:info.id||'',studentNo:info.no||'',alias:info.alias||'',className:info.className||'',expected:!!info.expected,temporary:!info.id,participated:false,lastAt:'',activeSeconds:0,attempts:0,practice:new Map(),experiments:new Map(),timeline:[],trials:[]};}
 function add(r,e){r.participated=true;r.lastAt=r.lastAt>e.receivedAt?r.lastAt:e.receivedAt;if(e.type==='usage'){r.activeSeconds+=e.data.activeSeconds||0;return;}
  if(e.type==='practice'){r.attempts++;const old=r.practice.get(e.data.questionId);if(!old)r.practice.set(e.data.questionId,{first:e,last:e,attempts:1});else{old.attempts++;if(later(e,old.last))old.last=e;if(later(old.first,e))old.first=e;}}
  if(e.type==='experiment'){let x=r.experiments.get(e.data.experimentId);if(!x){x={id:e.data.experimentId,name:e.data.name||e.data.experimentId,trials:0,submissions:0,reports:0,report:null};r.experiments.set(x.id,x);}x.submissions++;if(e.data.action==='trial')x.trials++;if(e.data.report){x.reports++;if(!x.report||later(e,x.report))x.report=e;}if(e.data.action==='trial'){r.trials.push(e);r.trials.sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt));r.trials=r.trials.slice(0,20);}}
  r.timeline.push(e);r.timeline.sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt));r.timeline=r.timeline.slice(0,40);
 }
 async function finish(r,l){const exercises=[...r.practice.values()].filter(x=>!l||!l.questionIds.length||l.questionIds.includes(x.last.data.questionId)),labs=[...r.experiments.values()];let score=0,max=0,wrong=0,pending=0;for(const p of exercises){score+=p.last.data.score;max+=p.last.data.max;if(p.last.data.max>0&&p.last.data.score<p.last.data.max)wrong++;p.reviewed=!!(await store.get(reviewKey(p.last),{type:'json',consistency:'strong'}))?.reviewed;if(p.last.data.pending&&!p.reviewed)pending++;}for(const lab of labs){lab.reviewed=lab.report?!!(await store.get(reviewKey(lab.report),{type:'json',consistency:'strong'}))?.reviewed:false;if(lab.report&&!lab.reviewed)pending++;}
  const questionsDone=l?l.questionIds.filter(id=>r.practice.has(id)).length:exercises.length;
  const experimentsDone=l?l.experimentIds.filter(id=>{const e=r.experiments.get(id);return e&&(l.requireReport?e.reports>0:e.submissions>0);}).length:labs.filter(x=>x.submissions>0).length;
  const required=l?l.questionIds.length+l.experimentIds.length:0,done=questionsDone+experimentsDone;
  return {key:r.key,studentId:r.studentId,studentNo:r.studentNo,alias:r.alias,className:r.className,expected:r.expected,temporary:r.temporary,participated:r.participated,lastAt:r.lastAt,activeSeconds:r.activeSeconds,attempts:r.attempts,questions:exercises.length,questionsDone,experimentsDone,reportCount:labs.filter(x=>x.reports).length,score,max,wrong,pending,done,required,complete:!!l&&required>0&&done===required,status:l?(done===required?'已提交齐全':!r.participated?'暂无任务记录':'尚未交齐'):!r.participated?'暂无学习记录':pending?'有待核对内容':wrong?'有题目需订正':'已参与'};
 }
 return {
  catalog,
  async publicClasses(){return (await classes()).map(c=>({name:c.name}));},
  async identify(d){const no=clean(d.studentNo||'',40);if(!no)return null;if(!/^[\p{L}\p{N}_-]+$/u.test(no))fail('学号只能使用字母、数字、下划线或短横线。');const name=clean(d.className||'',40)||'未分班',alias=clean(d.alias||'',40),c=(await classes()).find(c=>c.name===name),previous=c?.students.find(s=>s.no===no);if(!previous&&!alias)fail('请填写学号和昵称。');const key='enrollments/'+hash(name)+'/'+hash(no);await store.setJSON(classKey(name),{name,students:[],updatedAt:new Date().toISOString()},{onlyIfNew:true});await store.setJSON(key,{id:previous?.id||randomUUID(),no,alias:previous?.alias||alias,className:name,active:true,autoRegistered:true},{onlyIfNew:true});let student=await store.get(key,{type:'json',consistency:'strong'});if(student.active===false){student={...student,active:true};await store.setJSON(key,student);}return {studentId:student.id,studentNo:student.no,className:name,alias:student.alias||alias};},
  async checkLesson(id,className){const l=await store.get('lessons/'+id,{type:'json',consistency:'strong'});if(!l||l.className!==className)fail('课堂任务与当前班级不一致。');return l;},
  async studentLessons(user){return (await lessons()).filter(l=>l.className===user.className&&l.active).map(publicLesson);},
  async teacher(path,method,params,d,teacher,today){
   if(path==='/classroom/catalog'&&method==='GET')return catalog;
   if(path==='/classroom/classes'&&method==='GET')return {classes:await classes()};
   if(path==='/classroom/classes'&&method==='POST'){
    const name=clean(d.name,40);if(!name||!Array.isArray(d.students)||!d.students.length||d.students.length>200)fail('请填写班级和1至200位学生。');const old=(await classes()).find(c=>c.name===name),seen=new Set();
    const students=d.students.map(x=>{const no=clean(x.no,40),alias=clean(x.alias||'',40);if(!/^[\p{L}\p{N}_-]+$/u.test(no)||seen.has(no))fail('学号不能为空、不能重复，且只能使用字母、数字、下划线或短横线。');seen.add(no);const prev=old?.students.find(y=>y.no===no);return {id:prev?.id||randomUUID(),no,alias,active:true};});
    for(const oldStudent of old?.students||[])if(!seen.has(oldStudent.no))students.push({id:oldStudent.id,no:oldStudent.no,alias:oldStudent.alias,active:false});
    const c={name,students,updatedAt:new Date().toISOString()};await store.setJSON(classKey(name),c);for(const student of students){const key='enrollments/'+hash(name)+'/'+hash(student.no),enrolled=await store.get(key,{type:'json',consistency:'strong'});if(enrolled)await store.setJSON(key,{...enrolled,...student});}return {classroom:c};
   }
   if(path==='/classroom/lessons'&&method==='GET')return {lessons:(await lessons()).map(publicLesson)};
   if(path==='/classroom/lessons'&&method==='POST'){
    const className=clean(d.className,40),title=clean(d.title,100),day=clean(d.date,10),cls=await store.get(classKey(className),{type:'json',consistency:'strong'});
    if(!cls||!title||!date(day))fail('请先录入班级名单，并填写任务名称和有效日期。');
    const ids=(a,source)=>{if(!Array.isArray(a)||a.length>60||a.some(id=>!source.some(x=>x.id===id)))fail('题目或实验选择不正确。');return [...new Set(a)];};
    const questionIds=ids(d.questionIds||[],catalog.questions),experimentIds=ids(d.experimentIds||[],catalog.experiments);if(!questionIds.length&&!experimentIds.length)fail('至少选择一道练习或一个实验。');
    const l={id:randomUUID(),title,className,date:day,questionIds,experimentIds,requireReport:d.requireReport===true,active:true,createdAt:new Date().toISOString(),roster:cls.students.filter(x=>x.active!==false).map(x=>({id:x.id,no:x.no,alias:x.alias}))};await store.setJSON('lessons/'+l.id,l);return {lesson:publicLesson(l)};
   }
   if(path==='/classroom/lessons/status'&&method==='POST'){const l=await store.get('lessons/'+clean(d.id,100),{type:'json',consistency:'strong'});if(!l||typeof d.active!=='boolean')fail('任务设置不正确。');l.active=d.active;await store.setJSON('lessons/'+l.id,l);return {lesson:publicLesson(l)};}
   if(path==='/classroom/review'&&method==='POST'){
    const ref=d.event;if(!ref||!/^[-\w.]{1,100}$/.test(ref.id)||!/^[-\w.]{1,100}$/.test(ref.participantId)||!date(ref.day))fail('核对记录不正确。');
    const e=await store.get('events/'+ref.day+'/'+ref.participantId+'/'+ref.id,{type:'json',consistency:'strong'});if(!e||!(e.type==='practice'&&e.data.pending||e.type==='experiment'&&e.data.report))fail('这条记录无需人工核对。');
    const reviewed=d.reviewed!==false;await store.setJSON(reviewKey(e),{reviewed,reviewedAt:new Date().toISOString(),teacherId:teacher.id});return {reviewed};
   }
   if(path==='/classroom/overview'&&method==='GET'){
    const scope=readScope(params,today),l=await selectedLesson(scope),allClasses=await classes(),allLessons=await lessons(),map=new Map(),roster=l?l.roster.map(s=>({...s,className:l.className})) :allClasses.filter(c=>!scope.className||c.name===scope.className).flatMap(c=>c.students.filter(s=>s.active!==false).map(s=>({...s,className:c.name})));
    if(l){for(const c of allClasses.filter(c=>c.name===l.className))for(const s of c.students.filter(s=>s.autoRegistered&&s.active!==false))if(!roster.some(x=>x.id===s.id))roster.push({...s,className:c.name});}for(const s of roster)map.set('s_'+s.id,row({...s,key:'s_'+s.id,expected:true}));let records=0;const discovered=new Set(allClasses.map(c=>c.name));
    for await(const e of events({...scope,q:'',type:''})){records++;if(e.className)discovered.add(e.className);const key=studentKey(e);if(!map.has(key))map.set(key,row({key,id:e.studentId,no:e.studentNo,alias:e.alias,className:e.className}));add(map.get(key),e);}
    const rows=[];for(const r of map.values())rows.push(await finish(r,l));
    const questions=new Map();for(const r of map.values())for(const p of r.practice.values()){const d=p.last.data;if(l&&l.questionIds.length&&!l.questionIds.includes(d.questionId))continue;const q=questions.get(d.questionId)||{id:d.questionId,title:d.title,submitted:0,wrong:0};q.submitted++;if(d.max>0&&d.score<d.max)q.wrong++;questions.set(q.id,q);}
    const summary={expected:rows.filter(r=>r.expected).length,participated:rows.filter(r=>r.expected&&r.participated).length,temporary:rows.filter(r=>r.temporary).length,practiceSubmitted:rows.filter(r=>r.questions).length,reportsSubmitted:rows.filter(r=>r.reportCount).length,complete:rows.filter(r=>r.expected&&r.complete).length,pending:rows.reduce((s,r)=>s+r.pending,0),needsHelp:rows.filter(r=>r.wrong).length,records};
    const q=scope.q.toLowerCase(),attention=params.get('attention')||'';
    let filtered=rows.filter(r=>!q||[r.studentNo,r.alias,r.className,r.key].join(' ').toLowerCase().includes(q));
    if(attention==='pending')filtered=filtered.filter(r=>r.pending);if(attention==='help')filtered=filtered.filter(r=>r.wrong);if(attention==='missing')filtered=filtered.filter(r=>r.expected&&l&&!r.complete);
    filtered.sort((a,b)=>a.className.localeCompare(b.className,'zh-CN')||a.studentNo.localeCompare(b.studentNo,'zh-CN',{numeric:true})||a.alias.localeCompare(b.alias,'zh-CN'));
    const page=Math.max(0,Math.min(100,Number(params.get('page'))||0)),pageSize=params.get('export')==='1'?200:25;
    return {summary,students:filtered.slice(page*pageSize,(page+1)*pageSize),total:filtered.length,page,pageSize,classes:[...discovered].sort(),lessons:allLessons.filter(x=>!scope.className||x.className===scope.className).map(publicLesson),lesson:l?publicLesson(l):null,range:{from:scope.from,to:scope.to},questions:[...questions.values()].sort((a,b)=>b.wrong-a.wrong).slice(0,6),mode:store.iterEvents?'local':'cloud',temporaryNotice:'旧临时编号未与学号自动合并。任务进度按已提交记录计算，开放作答仍需核对。'};
   }
   if(path==='/classroom/student'&&method==='GET'){
    const scope=readScope(params,today);if(!/^[sg]_[-\w.]{1,100}$/.test(scope.studentKey))fail('学习者编号不正确。');const l=await selectedLesson(scope);let info={key:scope.studentKey,className:scope.className};
    for(const c of await classes()){const s=c.students.find(s=>'s_'+s.id===scope.studentKey);if(s)info={...s,key:scope.studentKey,className:c.name,expected:true};}const r=row(info),modules=new Map();
    for await(const e of events({...scope,q:'',type:''})){if(!r.alias)r.alias=e.alias||'';if(!r.className)r.className=e.className||'';add(r,e);if(e.type==='usage'){const key=e.day+'|'+e.data.view;const bucket=modules.get(key)||{day:e.day,view:e.data.view,seconds:0};bucket.seconds+=e.data.activeSeconds||0;modules.set(key,bucket);}}
    const summary=await finish(r,l);return {student:summary,practice:[...r.practice.values()].map(p=>({first:p.first,last:p.last,attempts:p.attempts,reviewed:p.reviewed})),experiments:[...r.experiments.values()],trials:r.trials,timeline:r.timeline,activity:[...modules.values()],lesson:l?publicLesson(l):null,range:{from:scope.from,to:scope.to}};
   }
   fail('没有找到这个教学管理功能。',404);
  }
 };
}
