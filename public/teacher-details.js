(function(root){'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const views={home:'工作台',practice:'同步练习','exam-space':'高考真题空间实战',games:'化学小游戏',mistakes:'错题本',lessons:'教案',doc:'资料阅读',stage:'模型与实验','3d':'模型与实验',periodic:'元素周期表',guide:'使用指南'};
const types={usage:'使用情况',practice:'做题记录',experiment:'实验记录'};
const actions={trial:'滴定测量',snapshot:'实验状态记录',report:'实验报告',step:'实验操作'};
const questionTypes={single:'单项选择题',multi:'多项选择题',fill:'填空题',experiment:'实验综合题'};
const fields=[['standard','标准液浓度','mol/L'],['aliquot','待测液取样体积','mL'],['initial','滴定管初始读数','mL'],['final','滴定管最终读数','mL'],['used','读数差（消耗体积）','mL'],['delivered','模拟实际加入体积','mL'],['concentration','计算所得浓度','mol/L'],['error','相对误差','%'],['pH','溶液 pH','']];
function time(value){if(!value)return '未记录';const d=new Date(value);return Number.isFinite(d.valueOf())?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d)+'（北京时间）':'未记录';}
function duration(v){const n=Math.max(0,Math.round(Number(v)||0));return n>=60?Math.floor(n/60)+'分'+(n%60?n%60+'秒':'钟'):n+'秒';}
function number(v){return typeof v==='number'&&Number.isFinite(v)?String(Number(v.toFixed(6))):'未记录';}
function text(v){if(Array.isArray(v))return v.map(text).join('、');if(v===null||v===undefined||String(v).trim()==='')return '未填写';return typeof v==='object'?'无法显示此项内容':String(v);}
function option(i,q){if(!Number.isInteger(i)||i<0||i>7)return '未选择';return String.fromCharCode(65+i)+(q?.options?.[i]?'．'+q.options[i]:'');}
function choice(value,q){return Array.isArray(value)?value.map(i=>option(i,q)).join('\n')||'未选择':option(value,q);}
function matched(e,bank){const d=e.data||{};return bank?.questions?.find(q=>q.id===d.questionId&&q.title===d.title&&q.type===d.questionType&&q.topic===d.topic)||null;}
function build(e,bank){
 const d=e.data||{},who=e.alias||'学习者 '+String(e.participantId||'').slice(0,8),q=matched(e,bank);
 const m={type:e.type,tag:types[e.type]||'学习记录',title:'学习记录',lead:'',tone:'neutral',metrics:[],sections:[],meta:[...(e.studentNo?[['学号',e.studentNo]]:[]),['学习者',who],['班级',e.className||'未填写'],['发生时间',time(e.occurredAt)],['收到时间',time(e.receivedAt)]],extra:[['完整学习编号',e.participantId||'未记录'],['记录编号',e.id||'未记录'],['记录说明版本',e.consentVersion||'未记录']]};
 if(e.type==='usage'){
  const module=views[d.view]||'其他学习页面',item=d.label?'（'+d.label+'）':'';
  m.title=module+' · '+({active:'前台停留',view:'进入模块',visit:'加入后访问'}[d.action]||'使用记录');
  m.lead=who+(d.action==='active'?'在“'+module+'”'+item+'前台停留约'+duration(d.activeSeconds)+'。':d.action==='visit'?'加入学习记录后，访问了“'+module+'”'+item+'。':'进入了“'+module+'”'+item+'。');
  m.metrics=[['使用模块',module],['记录动作',{active:'前台停留估计',view:'模块切换 / 进入',visit:'加入后访问'}[d.action]||'使用记录'],['本条时长',d.action==='active'?duration(d.activeSeconds):'本条未计时']];
  if(d.label)m.sections.push({title:'查看的内容',body:d.label});
  m.sections.push({title:'老师怎么看这条记录',body:d.action==='active'?'这是一次分段记录，不是该学生在这个模块的累计时长。页面处在前台不等于学生一直专注；这条记录也不包含小游戏成绩。':'这条记录说明学生进入了模块，不能仅凭进入次数判断学习效果。累计时长请结合后台的模块统计查看。'});
  if(d.itemId)m.extra.push(['内容编号',d.itemId]);
 }else if(e.type==='practice'){
  const hasObjective=Number(d.max)>0,full=hasObjective&&d.score>=d.max,pending=Number(d.pending)||0;
  const state=!hasObjective?'等待人工核对':full?'客观题已得满分':'客观题需要订正';
  m.title=d.title||'练习提交';m.tone=!hasObjective?'neutral':full?'good':'attention';
  m.lead=who+'提交了“'+m.title+'”。'+(hasObjective?'客观题得分 '+number(d.score)+' / '+number(d.max)+' 分。':'本条没有可展示的客观题分数。')+(pending?'另有 '+pending+' 分开放作答待教师核对。':'');
  m.metrics=[['客观题得分',hasObjective?number(d.score)+' / '+number(d.max)+' 分':'无客观计分项'],['本次提交次序','第 '+(d.attempt||1)+' 次'],['当前状态',state]];
  m.sections.push({title:'题目信息',rows:[['知识点',d.topic||'未记录'],['题型',questionTypes[d.questionType]||'练习题'],['题号',d.questionId||'未记录']]});
  if(q)m.sections.push({title:'题干与选项（当前题库）',body:q.stem,items:q.options?.map((o,i)=>String.fromCharCode(65+i)+'．'+o),note:'题干和参考答案来自当前内置题库，历史记录未保存题目全文；如当时使用了自定义或改版题包，请以当时题目为准。'});
  else m.sections.push({title:'题目原文',body:'本条记录未保存题干全文，当前内置题库也没有匹配项。下面仍保留实际上传的作答，请结合学生当时使用的题包核对。'});
  const answers=d.answers||{},rows=[];
  if(Object.hasOwn(answers,'choice'))rows.push(['学生选择',choice(answers.choice,q)]);
  if(q?.parts){for(const [i,p] of q.parts.entries())rows.push(['第'+(i+1)+'问：'+p.prompt+(p.unit?'（'+p.unit+'）':''),text(answers[p.id])]);}
  for(const [key,value] of Object.entries(answers)){if(key==='choice'||q?.parts?.some(p=>p.id===key))continue;rows.push(['作答项 '+key,text(value)]);}
  m.sections.push({title:'学生本次作答',rows:rows.length?rows:[['作答','未记录']]});
  m.sections.push({title:'学生的解题思路',body:d.notes?.trim()?d.notes:'本次没有提交思路说明。'});
  if(q){const references=q.options?[['参考选择',choice(q.answer,q)]]:(q.parts||[]).map((p,i)=>['第'+(i+1)+'问'+(p.kind==='manual'?' · 核对要点':''),p.kind==='manual'?p.rubric:text(p.answer)+(p.unit?' '+p.unit:'')]);m.sections.push({title:'参考答案与解析（当前题库）',rows:references,body:q.analysis||'暂无解析',collapsible:true});}
  m.sections.push({title:'讲评提示',body:!hasObjective?'本条需查看学生原文并人工核对，不能按零分处理。':full?(pending?'客观部分已得满分，开放作答仍需人工核对。':'可以请学生解释选择或计算的依据，确认推理过程。'):'可以先看学生的答案与思路，再让学生解释所用条件或计算关系。这里展示的是当时网页上报的分数，没有重新判分。',note:'后台展示不会自动修改成绩，也不会将提示当作教师评语发给学生。'});
 }else if(e.type==='experiment'){
  m.title=d.name||'实验记录';m.lead=who+'提交了一份“'+m.title+'”的'+(actions[d.action]||'实验记录')+'。';
  m.metrics=[['实验名称',m.title],['提交内容',actions[d.action]||'实验记录'],['记录性质',d.action==='trial'?'虚拟实验测量':'学生主动提交']];
  const readings=d.readings||{},rows=fields.filter(([key])=>Object.hasOwn(readings,key)).map(([key,label,unit])=>[label,number(readings[key])+(unit?' '+unit:'')]);
  if(Object.hasOwn(readings,'status'))rows.push(['网页终点判断',text(readings.status)]);
  if(Object.hasOwn(readings,'accepted'))rows.push(['本次测量是否被模型接受',readings.accepted?'已接受':'未接受']);
  if(readings.model)rows.push(['实验模型',text(readings.model)]);
  if(rows.length)m.sections.push({title:'测量数据',rows,note:'数据来自虚拟实验教学模型。网页终点判断不等于教师已经审核，也不能替代真实实验结果。'});
  if(d.report){
   m.sections.push({title:'一、实验现象与观察',rows:(d.report.observations||[]).length?d.report.observations.map((v,i)=>['观察 '+(i+1),text(v)]):[['观察记录','未填写']],note:'这里保留上传时的观察顺序；旧记录没有上传对应操作步骤名称。'});
   m.sections.push({title:'二、实验结论',body:text(d.report.conclusion)});
   m.sections.push({title:'三、误差分析与反思',body:text(d.report.reflection)});
   m.sections.push({title:'教师查看重点',body:'先对照现象和结论，再检查学生是否说明误差来源、影响方向与改进办法。此处未对报告进行自动评分。'});
  }else if(!rows.length)m.sections.push({title:'本次保存了什么',body:'本条保存了实验名称和一次提交标记，没有收到测量数值或报告正文。不能据此还原完整实验步骤，也不能判断实验是否完成。'});
  if(d.experimentId)m.extra.push(['实验编号',d.experimentId]);
 }else m.lead='这条记录暂时没有对应的教学展示格式。';
 return m;
}
function rowsHTML(rows){return '<dl class="detail-rows">'+rows.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>';}
function render(m){return '<article class="record-paper"><div class="record-intro '+esc(m.tone)+'"><span class="record-tag">'+esc(m.tag)+'</span><h3>'+esc(m.title)+'</h3><p>'+esc(m.lead)+'</p></div><div class="detail-meta">'+rowsHTML(m.meta)+'</div><div class="detail-metrics">'+m.metrics.map(([k,v])=>'<div><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>').join('')+'</div>'+m.sections.map(s=>{const body=(s.body?'<p class="record-prose">'+esc(s.body)+'</p>':'')+(s.items?'<ul class="record-options">'+s.items.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul>':'')+(s.rows?rowsHTML(s.rows):'')+(s.note?'<p class="record-note">'+esc(s.note)+'</p>':'');return s.collapsible?'<details class="record-section record-reference"><summary>'+esc(s.title)+'</summary>'+body+'</details>':'<section class="record-section"><h3>'+esc(s.title)+'</h3>'+body+'</section>';}).join('')+'<details class="record-section record-identifiers"><summary>编号与接收信息</summary>'+rowsHTML(m.extra)+'</details></article>';}
function plain(m){return [m.tag+'｜'+m.title,m.lead,...m.meta.map(([k,v])=>k+'：'+v),...m.metrics.map(([k,v])=>k+'：'+v),...m.sections.flatMap(s=>['',s.title,...(s.body?[s.body]:[]),...(s.items||[]),...(s.rows||[]).map(([k,v])=>k+'：'+v),...(s.note?['说明：'+s.note]:[])])].join('\n');}
root.ChemTeacherDetails={build,render,plain,time,duration};
})(globalThis);
