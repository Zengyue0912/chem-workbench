import {createHmac,randomUUID,timingSafeEqual,scryptSync} from 'node:crypto';
import {createClassroom,readScope} from './classroom.mjs';
import {checkStudyQuota, validateStudyInput} from './study-model.mjs';
export const CONSENT='2026-11-05-v1';
const cookieNames={student:'chem_participant',teacher:'chem_teacher'};
const fail=(message,status=400)=>{const e=new Error(message);e.status=status;throw e;};
const str=(x,max,empty=true)=>typeof x==='string'&&x.length<=max&&(empty||x.trim())?x.trim():fail('文字字段格式不正确或过长。');
const num=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max?x:fail('数值字段不正确。');
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_.-]{1,100}$/.test(x)&&!['__proto__','constructor','prototype'].includes(x)?x:fail('记录编号不正确。');
export const dayOf=d=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);return ['year','month','day'].map(t=>parts.find(p=>p.type===t).value).join('-');};
export const hashPassword=(password,salt)=>scryptSync(password,salt,32).toString('hex');
const equal=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y);};
function sign(data,key){const payload=Buffer.from(JSON.stringify(data)).toString('base64url');return payload+'.'+createHmac('sha256',key).update(payload).digest('base64url');}
function verify(value,key,role){try{const [p,s,...more]=value.split('.');if(more.length||!p||!equal(s,createHmac('sha256',key).update(p).digest('base64url')))return null;const data=JSON.parse(Buffer.from(p,'base64url'));return data.role===role&&data.exp>Date.now()?data:null;}catch{return null;}}
function readCookie(req,name){const raw=req.headers.get('cookie')||'';return raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';}
function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});}
const cookie=(name,value,secure,maxAge)=>`${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure?'; Secure':''}`;
function cleanAnswers(raw){if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('作答格式不正确。');const out={};for(const [k,v] of Object.entries(raw).slice(0,16)){id(k);if(k==='choice'){if(v===null)out[k]=null;else if(Array.isArray(v))out[k]=v.slice(0,8).map(x=>num(x,0,7));else out[k]=num(v,0,7);}else out[k]=str(v,3000);}return out;}
function numericRecord(raw){const out={};for(const [k,v] of Object.entries(raw||{})){if(['standard','aliquot','initial','final','used','concentration','error','pH','delivered'].includes(k))out[k]=num(v,-100000,100000);else if(['status','model'].includes(k))out[k]=str(v,150);else if(k==='accepted')out[k]=v===true;}return out;}
export function validateEvent(e){
 if(!e||typeof e!=='object')fail('记录格式不正确。');const out={id:id(e.id),type:e.type};
 if(!['usage','practice','experiment'].includes(e.type))fail('不支持该记录类型。');
 const d=e.data;if(!d||typeof d!=='object'||Array.isArray(d))fail('缺少记录内容。');
 const dt=new Date(e.occurredAt);out.occurredAt=Number.isFinite(dt.valueOf())&&Math.abs(Date.now()-dt)<32*86400000?dt.toISOString():null;
 if(e.lessonId)out.lessonId=id(e.lessonId);
 if(e.type==='usage')out.data={action:['visit','view','active'].includes(d.action)?d.action:fail('使用记录动作不正确。'),view:str(d.view||'home',40),itemId:str(d.itemId||'',100),label:str(d.label||'',120),activeSeconds:num(d.activeSeconds||0,0,300)};
 if(e.type==='practice')out.data={questionId:id(d.questionId),title:str(d.title,160),topic:str(d.topic,100),questionType:str(d.questionType,30),score:num(d.score,0,1000),max:num(d.max,0,1000),pending:num(d.pending||0,0,1000),attempt:num(d.attempt||1,1,10000),answers:cleanAnswers(d.answers),notes:str(d.notes||'',2000)};
 if(e.type==='practice'&&out.data.score>out.data.max)fail('得分不能大于客观题总分。');
 if(e.type==='experiment'){
  out.data={experimentId:id(d.experimentId),name:str(d.name||'',120),action:['trial','step','report','snapshot'].includes(d.action)?d.action:fail('实验动作不正确。')};
  if(d.readings)out.data.readings=numericRecord(d.readings);
  if(d.report){if(!Array.isArray(d.report.observations)||d.report.observations.length>30)fail('实验报告记录项过多。');out.data.report={observations:d.report.observations.map(x=>str(x,1500)),conclusion:str(d.report.conclusion||'',2500),reflection:str(d.report.reflection||'',1500)};}
 }
 return out;
}
export function aggregate(events){
 const participants=new Set(events.map(e=>e.participantId)),usage=events.filter(e=>e.type==='usage'),practice=events.filter(e=>e.type==='practice'),experiments=events.filter(e=>e.type==='experiment');
 const questions=new Map(),modules=new Map();for(const e of practice){const q=questions.get(e.data.questionId)||{id:e.data.questionId,title:e.data.title,attempts:0,needsReview:0};q.attempts++;if(e.data.score<e.data.max)q.needsReview++;questions.set(q.id,q);}for(const e of usage){const key=e.data.view,m=modules.get(key)||{view:key,seconds:0,visits:0};m.seconds+=e.data.activeSeconds;if(e.data.action!=='active')m.visits++;modules.set(key,m);}
 return {records:events.length,participants:participants.size,activeSeconds:usage.reduce((s,x)=>s+x.data.activeSeconds,0),practiceAttempts:practice.length,experimentRecords:experiments.length,score:practice.reduce((s,x)=>s+x.data.score,0),max:practice.reduce((s,x)=>s+x.data.max,0),questions:[...questions.values()].sort((a,b)=>b.needsReview-a.needsReview),modules:[...modules.values()].sort((a,b)=>b.seconds-a.seconds)};
}
export function createApp({store,config}){
 const classroom=createClassroom({store});
 const participant=u=>({id:u.id,alias:u.alias||'',className:u.className||'',studentId:u.studentId||'',studentNo:u.studentNo||''});
 const configured=()=>!!(config.secret?.length>=32&&config.adminHash&&config.adminSalt&&config.collectionCode?.length>=6);
 const auth=async(req,role)=>{const result=verify(readCookie(req,cookieNames[role]),config.secret||'',role);if(!result)fail(role==='teacher'?'请先登录教师后台。':'请先同意并加入学习记录。',401);const session=await store.get('sessions/'+role+'/'+result.id,{type:'json',consistency:'strong'});if(!session?.active)fail('会话已结束，请重新加入或登录。',401);return result;};
 async function record(event,user){const now=new Date();const data={...event,participantId:user.id,studentId:user.studentId||'',studentNo:user.studentNo||'',alias:user.alias||'',className:user.className||'',consentVersion:CONSENT,receivedAt:now.toISOString(),day:dayOf(now)};const receipt='receipts/'+user.id+'/'+event.id;await store.setJSON(receipt,data,{onlyIfNew:true});const stable=await store.get(receipt,{type:'json',consistency:'strong'});if(!stable)throw Error('记录写入未确认');const key='events/'+stable.day+'/'+user.id+'/'+event.id;await store.setJSON(key,stable,{onlyIfNew:true});if(stable.lessonId)await store.setJSON('lesson-events/'+stable.lessonId+'/'+user.id+'/'+event.id,{key},{onlyIfNew:true});return stable;}
 async function body(req,limit=90000){const declared=Number(req.headers.get('content-length')||0);if(declared>limit)fail('上传内容过大。',413);const text=await req.text();if(Buffer.byteLength(text)>limit)fail('上传内容过大。',413);try{return JSON.parse(text);}catch{fail('请求内容不是有效JSON。');}}
 const clearedKey=e=>'cleared/'+e.participantId+'/'+e.id;
 async function findRecords(params){
  if(store.queryEvents){const scope=readScope(params,dayOf(new Date())),found=await store.queryEvents({...scope,limit:10001});if(found.total>10000)fail('当前筛选超过10000条，请缩小清除范围。');return {events:found.events,classes:found.classes,range:{from:scope.from,to:scope.to},filters:{className:scope.className,type:scope.type,q:scope.q,lessonId:scope.lessonId,studentKey:scope.studentKey}};}
  const from=params.get('from')||dayOf(new Date()),to=params.get('to')||from;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to))fail('日期格式不正确。');
  const start=Date.parse(from+'T00:00:00+08:00'),end=Date.parse(to+'T00:00:00+08:00');
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||end-start>30*86400000)fail('每次可查看连续31天以内的记录。');
  let keys=[];for(let t=start;t<=end;t+=86400000){const listed=await store.list({prefix:'events/'+dayOf(new Date(t))+'/'});keys.push(...listed.blobs.map(x=>x.key));if(keys.length>10000)fail('该时段超过10000条，请缩小日期范围。');}
  const events=[];for(let offset=0;offset<keys.length;offset+=12){const group=await Promise.all(keys.slice(offset,offset+12).map(async key=>{const e=await store.get(key,{type:'json',consistency:'strong'});if(!e)return null;const removed=await store.get(clearedKey(e),{type:'json',consistency:'strong'});return removed?.active?null:e;}));events.push(...group.filter(Boolean));}
  const className=(params.get('class')||'').slice(0,40),type=params.get('type')||'',q=(params.get('q')||'').slice(0,100);
  if(type&&!['usage','practice','experiment'].includes(type))fail('记录类型不正确。');
  const lessonId=params.get('lesson')||'',student=params.get('student')||'';
  const filtered=events.filter(e=>(!className||e.className===className)&&(!type||e.type===type)&&(!lessonId||e.lessonId===lessonId)&&(!student||student===(e.studentId?'s_'+e.studentId:'g_'+e.participantId))&&(!q||[e.alias,e.studentNo,e.participantId,e.data.title,e.data.name,e.data.label].join(' ').includes(q))).sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt));
  return {events:filtered,classes:[...new Set(events.map(e=>e.className).filter(Boolean))],range:{from,to},filters:{className,type,q}};
 }
 return {async handle(req){try{
  const url=new URL(req.url),path=url.pathname.replace(/^\/(?:api\/data|\.netlify\/functions\/cloud)/,'')||'/';
  const secure=url.protocol==='https:';
  if(req.method==='OPTIONS')return json({error:'不允许跨站上传。'},403);
  if(req.method==='POST'){
   const origin=req.headers.get('origin'),allowed=config.siteUrl?new URL(config.siteUrl).origin:url.origin;
   if(origin!==allowed)fail('请求来源不被允许。',403);
   if(!req.headers.get('content-type')?.startsWith('application/json'))fail('请求必须为JSON。',415);
  }
  if(path==='/study/status'&&req.method==='GET'){
   if(!config.studyModel||(config.mode!=='local'&&!configured()))return json({configured:false});
   if(config.mode==='local')return json({configured:true,available:true});
   let available=false;
   try{available=!!(await auth(req,'student')).studentId;}catch(error){if(error.status!==401)throw error;}
   return json({configured:true,available});
  }
  if(path==='/study/guide'&&req.method==='POST'){
   if(!config.studyModel)fail('当前使用内置辅导。',503);
   let studentId='local';
   if(config.mode!=='local'){
    if(!configured())fail('云课堂还没有配置。',503);
    const user=await auth(req,'student');
    if(!user.studentId)fail('请用学号加入课堂后再使用模型提示。',403);
    studentId=user.studentId;
   }
   const input=validateStudyInput(await body(req,14000));
   await checkStudyQuota(store,dayOf(new Date()),studentId);
   const answer=await config.studyModel(input);
   return json(input.mode==='plan'?{plan:answer}:{answer});
  }
  if(path==='/health'&&req.method==='GET')return json({app:'chem-learning-trial/1',configured:configured(),mode:config.mode,features:{classroom:true},consentVersion:CONSENT,today:dayOf(new Date()),...(config.mode==='local'&&config.instanceId?{instanceId:config.instanceId}:{})});
  if(!configured())fail('后台尚未配置。请先设置教师密码、参加码和会话密钥。',503);
  if(path==='/classes'&&req.method==='GET')return json({classes:await classroom.publicClasses()});
  if(path.startsWith('/classroom/')){const teacher=await auth(req,'teacher');return json(await classroom.teacher(path,req.method,url.searchParams,req.method==='POST'?await body(req):null,teacher,dayOf(new Date())));}
  if(path==='/student/lessons'&&req.method==='GET'){const user=await auth(req,'student');return json({lessons:await classroom.studentLessons(user)});}
  if(path==='/join'&&req.method==='POST'){
   const d=await body(req,3000);if(d.consent!==true||d.consentVersion!==CONSENT)fail('请先阅读并同意学习记录说明。');
   if(!equal(str(d.code,100),config.collectionCode))fail('参加码不正确，请向老师确认。',403);
   const fixed=await classroom.identify(d);
   const who={role:'student',id:randomUUID(),alias:str(d.alias||'',40),className:str(d.className||'',40),...(fixed||{}),exp:Date.now()+7*86400000};
   await store.setJSON('sessions/student/'+who.id,{active:true,exp:who.exp});
   return json({participant:participant(who),mode:config.mode},200,{'Set-Cookie':cookie(cookieNames.student,sign(who,config.secret),secure,7*86400)});
  }
  if(path==='/me'&&req.method==='GET'){const u=await auth(req,'student');return json({participant:participant(u),mode:config.mode});}
  if(path==='/leave'&&req.method==='POST'){const u=await auth(req,'student');await store.setJSON('sessions/student/'+u.id,{active:false,exp:u.exp});return json({ok:true},200,{'Set-Cookie':cookie(cookieNames.student,'',secure,0)});}
  if(path==='/collect'&&req.method==='POST'){
   const who=await auth(req,'student'),data=await body(req);if(!Array.isArray(data.events)||!data.events.length||data.events.length>20)fail('每批需要1～20条记录。');
   const events=data.events.map(validateEvent);if(new Set(events.map(e=>e.id)).size!==events.length)fail('同一批记录编号重复。');
   for(const lessonId of new Set(events.map(e=>e.lessonId).filter(Boolean)))await classroom.checkLesson(lessonId,who.className);
   const accepted=[];for(const e of events){await record(e,who);accepted.push(e.id);}return json({accepted});
  }
  if(path==='/login'&&req.method==='POST'){
   const data=await body(req,3000),password=str(data.password,200);const attemptKey='auth/'+createHmac('sha256',config.secret).update(config.clientIP?.(req)||'local').digest('hex').slice(0,32)+'/',now=Date.now();
   const {blobs}=await store.list({prefix:attemptKey});let count=0;for(const row of blobs){const t=Number(row.key.split('/').at(-1)?.split('_')[0]);if(now-t<15*60000)count++;}if(count>=8)fail('登录尝试过多，请15分钟后重试。',429);
   if(!equal(hashPassword(password,config.adminSalt),config.adminHash)){await store.setJSON(attemptKey+now+'_'+randomUUID(),{time:now},{onlyIfNew:true});fail('教师密码不正确。',401);}
   const who={role:'teacher',id:randomUUID(),exp:Date.now()+2*3600000};await store.setJSON('sessions/teacher/'+who.id,{active:true,exp:who.exp});
   return json({ok:true,mode:config.mode},200,{'Set-Cookie':cookie(cookieNames.teacher,sign(who,config.secret),secure,7200)});
  }
  if(path==='/teacher'&&req.method==='GET'){await auth(req,'teacher');return json({ok:true,mode:config.mode,today:dayOf(new Date())});}
  if(path==='/logout'&&req.method==='POST'){try{const u=await auth(req,'teacher');await store.setJSON('sessions/teacher/'+u.id,{active:false,exp:u.exp});}catch{}return json({ok:true},200,{'Set-Cookie':cookie(cookieNames.teacher,'',secure,0)});}
  if(path==='/records/clear-preview'&&req.method==='POST'){
   const teacher=await auth(req,'teacher'),d=await body(req,3000);
   const params=new URLSearchParams();for(const k of ['from','to','class','type','q','lesson','student'])if(d[k]!==undefined)params.set(k,str(d[k],['q','lesson','student'].includes(k)?110:40));
   const found=await findRecords(params),planId=randomUUID(),expiresAt=Date.now()+5*60000;
   await store.setJSON('clear-plans/'+planId,{teacherId:teacher.id,expiresAt,range:found.range,filters:found.filters,refs:found.events.map(e=>({participantId:e.participantId,id:e.id})),status:'preview'});
   return json({planId,total:found.events.length,participants:new Set(found.events.map(e=>e.participantId)).size,range:found.range,filters:found.filters,expiresAt});
  }
  if(path==='/records/clear'&&req.method==='POST'){
   const teacher=await auth(req,'teacher'),d=await body(req,3000),planId=id(d.planId);
   const key='clear-plans/'+planId,plan=await store.get(key,{type:'json',consistency:'strong'});
   if(!plan||plan.teacherId!==teacher.id)fail('清除预览已失效，请重新选择。',404);
   if(plan.status==='cleared')return json({operationId:planId,cleared:plan.cleared});
   if(plan.status==='restored')fail('这次清除已撤销，请重新预览。',409);
   if(plan.expiresAt<Date.now())fail('预览已超过5分钟，请重新核对范围。',409);
   let count=0;for(const ref of plan.refs){const old=await store.get(clearedKey(ref),{type:'json',consistency:'strong'});if(old?.active&&old.operationId!==planId)continue;await store.setJSON(clearedKey(ref),{active:true,operationId:planId,clearedAt:new Date().toISOString()});count++;}
   plan.status='cleared';plan.cleared=count;await store.setJSON(key,plan);
   return json({operationId:planId,cleared:count});
  }
  if(path==='/records/restore'&&req.method==='POST'){
   await auth(req,'teacher');const d=await body(req,3000),operationId=id(d.operationId),key='clear-plans/'+operationId,plan=await store.get(key,{type:'json',consistency:'strong'});
   if(!plan||!['cleared','restored'].includes(plan.status))fail('没有找到可撤销的清除记录。',404);
   if(plan.status==='restored')return json({restored:plan.restored});
   let count=0;for(const ref of plan.refs){const marker=await store.get(clearedKey(ref),{type:'json',consistency:'strong'});if(marker?.active&&marker.operationId===operationId){await store.setJSON(clearedKey(ref),{...marker,active:false});count++;}}
   plan.status='restored';plan.restored=count;await store.setJSON(key,plan);return json({restored:count});
  }
  if(path==='/records'&&req.method==='GET'){
   if(store.queryEvents){await auth(req,'teacher');const scope=readScope(url.searchParams,dayOf(new Date())),page=Number(url.searchParams.get('page')||0);if(!Number.isInteger(page)||page<0||page>10000)fail('页码不正确。');const found=await store.queryEvents({...scope,limit:100,offset:page*100}),summary=await store.summarizeEvents(scope);return json({events:found.events,total:found.total,page,pageSize:100,summary,classes:found.classes,range:{from:scope.from,to:scope.to},mode:config.mode,notice:'客观分数由学生端上报；时长为前台估计。详细记录按后台筛选分页，不代表正式考核成绩。'});}
   await auth(req,'teacher');const found=await findRecords(url.searchParams),filtered=found.events;
   const page=Number(url.searchParams.get('page')||0);if(!Number.isInteger(page)||page<0||page>100)fail('页码不正确。');
   return json({events:filtered.slice(page*100,(page+1)*100),total:filtered.length,page,pageSize:100,summary:aggregate(filtered),classes:found.classes,range:found.range,mode:config.mode,notice:'作答和得分由学生端上报，仅供教学观察，不作为监考成绩。停留时长为页面前台活动估计。'});
  }
  return json({error:'接口不存在。'},404);
 }catch(e){return json({error:e.status?e.message:'后台暂时不可用，请稍后重试。'},e.status||500);}}};
}
