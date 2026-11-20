/* ============================================================================
 * 抽取自 index.html 内联 <script> #11（原行 6485–6512）。
 * 教案 Markdown 渲染 + 教案 SOP 路线数据（CHEM_LESSON_FLOW）
 * 工作流 1（性能与工程重构）：内容原样搬运，仅做加载方式改变。
 * 加载方式：按需懒加载（bundle: lessons，见 js/loader.js）
 * ========================================================================== */
(function(){'use strict';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inline=s=>escape(s).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`\n]+)`/g,'<code>$1</code>');
const cells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(x=>x.trim());
window.ChemLessonMarkdown=function(text){
 const lines=String(text).split('\n');let html='',i=0;
 while(i<lines.length){const line=lines[i];
  if(line.includes('|')&&i+1<lines.length&&/^\s*\|?\s*:?-{3,}:?\s*\|/.test(lines[i+1])){
   const heads=cells(line);html+='<table style="border-collapse:collapse;width:100%;margin:14px 0"><thead><tr>'+heads.map(x=>'<th style="border:1px solid #aab9b1;padding:9px;text-align:left">'+inline(x)+'</th>').join('')+'</tr></thead><tbody>';i+=2;
   while(i<lines.length&&lines[i].includes('|')&&lines[i].trim()){const row=cells(lines[i]);html+='<tr>'+heads.map((x,j)=>'<td style="border:1px solid #aab9b1;padding:9px;min-width:50px">'+inline(row[j]||'')+'</td>').join('')+'</tr>';i++;}
   html+='</tbody></table>';continue;
  }
  if(/^\s*- /.test(line)){html+='<ul>';while(i<lines.length&&/^\s*- /.test(lines[i])){html+='<li>'+inline(lines[i].replace(/^\s*- /,''))+'</li>';i++;}html+='</ul>';continue;}
  const heading=line.match(/^(#{1,3})\s+(.*)$/);
  if(heading)html+='<h'+heading[1].length+'>'+inline(heading[2])+'</h'+heading[1].length+'>';
  else if(line==='---')html+='<hr>';
  else if(line.trim())html+='<p>'+inline(line.replace(/^>\s?/,''))+'</p>';
  i++;
 }
 return html;
};
})();


window.CHEM_LESSON_FLOW={"schema": "chem-lesson-workflow/1", "version": "1.0", "master": "SOP-010", "title": "双角色教案总控SOP", "input": "课程主题、年级、课时、学情和本课目标", "output": "可编辑的教师教案、学生任务单、模型自查建议和步骤记录", "control": "先检查输入，按依赖顺序执行子SOP。每步校验输出字段和完成标准，通过才进入下一步；失败保留已完成步骤。重做某步时，将依赖它的后续输出标为待生成，最后重新汇总。", "steps": [{"id": "SOP-011", "title": "核对课程输入", "engine": "local", "deps": [], "input": "用户填写的课程条件", "output": "brief：规范化的课程条件", "action": "只核对主题、课时、字段长度及必需条件，保留学情原意。", "attention": "不编造班级水平、人数或成绩。", "criteria": "主题存在；课时为20～120分钟整数；条件可以用于后续生成。", "fields": ["brief"]}, {"id": "SOP-012", "title": "确定学习目标", "engine": "model", "deps": ["SOP-011"], "input": "brief及本课目标参考", "output": "goals：3～5条可观察的学习目标", "action": "根据学情把本课目标写成学生能完成的具体表现。", "attention": "只写目标，不同时展开教学过程。", "criteria": "每条目标有动作和检查对象，能通过作答、解释或记录判断。", "fields": ["goals"]}, {"id": "SOP-013", "title": "设计开场问题", "engine": "model", "deps": ["SOP-011", "SOP-012"], "input": "课程条件和学习目标", "output": "teacher：提问安排；student：独立猜想任务；evidence：收集证据", "action": "设计一个能暴露本课关键误解的开场问题。", "attention": "先留学生判断空间，不直接公布答案。", "criteria": "只有一个核心问题，学生能独立留下初始判断。", "fields": ["teacher", "student", "evidence"]}, {"id": "SOP-014", "title": "设计概念讲解", "engine": "model", "deps": ["SOP-011", "SOP-012", "SOP-013"], "input": "课程目标和开场问题", "output": "teacher：概念解释；student：关系式或结构图任务；evidence：检查点", "action": "围绕开场问题，说明解决它需要的核心概念和适用条件。", "attention": "不提前展开探究操作，也不堆砌整章知识。", "criteria": "概念、条件与任务相对应；能检查学生是否理解依据。", "fields": ["teacher", "student", "evidence"]}, {"id": "SOP-015", "title": "设计探究操作", "engine": "model", "deps": ["SOP-011", "SOP-012", "SOP-014"], "input": "课程条件、目标和概念依据", "output": "teacher：组织与观察；student：操作步骤；evidence：操作证据", "action": "只设计一个围绕目标的虚拟操作或纸面探究活动。", "attention": "写明参数或控制条件；不要求未经批准的真实实验。", "criteria": "学生知道先做什么、观察什么、何时停止；操作与目标一致。", "fields": ["teacher", "student", "evidence"]}, {"id": "SOP-016", "title": "制作学生记录单", "engine": "model", "deps": ["SOP-011", "SOP-015"], "input": "探究操作及所需观察量", "output": "worksheet：可填写的学生记录单", "action": "为上一步的观察、计算和解释逐项留空。", "attention": "不填入示例答案，不夹带教师解析。", "criteria": "每项记录都能对应一个操作或观察，数值字段有单位。", "fields": ["worksheet"]}, {"id": "SOP-017", "title": "制作随堂练习", "engine": "model", "deps": ["SOP-011", "SOP-012", "SOP-014", "SOP-016"], "input": "目标、概念和记录单", "output": "teacher：答案与核对理由；student：独立练习", "action": "编写两道原创练习检查本课目标，分别提供教师核对和学生作答版本。", "attention": "不声称来自商业练习册；学生部分不带答案。", "criteria": "题干条件完整；答案与解析只在教师字段；题目能检查目标。", "fields": ["teacher", "student"]}, {"id": "SOP-018", "title": "设计离堂检查", "engine": "model", "deps": ["SOP-011", "SOP-012", "SOP-017"], "input": "学习目标和随堂练习", "output": "teacher：收集与判断；student：离堂任务；evidence：达标依据", "action": "用一个简短任务检查学生能否独立说明关键依据。", "attention": "不把离堂检查扩写为一套测验。", "criteria": "可在短时间独立完成，有明确的判断依据。", "fields": ["teacher", "student", "evidence"]}, {"id": "SOP-019", "title": "安排课后订正", "engine": "model", "deps": ["SOP-011", "SOP-017", "SOP-018"], "input": "随堂练习和离堂检查", "output": "teacher：反馈安排；student：订正与复练任务", "action": "安排围绕错因的一次订正和一次独立复练。", "attention": "不假定学生已经做错或已经进步，不虚构课堂效果。", "criteria": "学生知道要改哪类问题、保留什么过程、如何再次检查。", "fields": ["teacher", "student"]}, {"id": "SOP-020", "title": "分配课堂时长", "engine": "local", "deps": ["SOP-011"], "input": "brief中的课内分钟数", "output": "minutes、times：五阶段分钟数", "action": "按五个课堂阶段分配整数分钟，并核对总和。", "attention": "课前与课后任务不占用课内时长。", "criteria": "五阶段均有时间，合计严格等于设定课时。", "fields": ["minutes", "times"]}, {"id": "SOP-021", "title": "复核内容衔接", "engine": "model", "deps": ["SOP-011", "SOP-012", "SOP-013", "SOP-014", "SOP-015", "SOP-016", "SOP-017", "SOP-018", "SOP-019", "SOP-020"], "input": "前面各步骤的输出", "output": "review：模型自查发现和需要教师核对的事项", "action": "只检查概念、条件、单位、学生答案隔离和步骤衔接，指出具体位置。", "attention": "这是模型自查，不等于教师审定；不改写整份教案。", "criteria": "按具体问题或待核对项输出；没有发现问题时也明确需教师复核。", "fields": ["review"]}, {"id": "SOP-022", "title": "汇总双角色教案", "engine": "local", "deps": ["SOP-011", "SOP-012", "SOP-013", "SOP-014", "SOP-015", "SOP-016", "SOP-017", "SOP-018", "SOP-019", "SOP-020", "SOP-021"], "input": "全部通过格式检查的子SOP输出", "output": "full：双角色教案；teacher：教师版；student：学生版；trace：执行记录", "action": "按同一时间表组装两版教案，把参考答案和自查建议放在教师部分。", "attention": "不将教师参考答案拼入学生版；保留来源模型及待复核提示。", "criteria": "老师和学生两版齐全；五步时间一致；能够预览、编辑和导出。", "fields": ["full", "teacher", "student", "trace"]}]};
