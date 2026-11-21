const $=id=>document.getElementById(id),E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let result=null,page=0,busy=false,currentDetail=null,detailToken=0,questionBank=null;
let clearPlan=null,clearing=false,lastClear='';
try{lastClear=localStorage.getItem('chem_teacher_last_clear')||'';}catch{}
const detailUI=globalThis.ChemTeacherDetails;
const questionBankReady=fetch('高中化学习题.sop.json').then(r=>r.ok?r.json():null).then(bank=>{questionBank=bank;}).catch(()=>{});
const names={usage:'使用情况',practice:'做题记录',experiment:'实验记录'},views={home:'工作台',practice:'同步练习','exam-space':'高考真题空间实战',games:'化学小游戏',mistakes:'错题本',lessons:'教案',doc:'资料阅读','3d':'模型与实验'};
async function api(path,body){const r=await fetch('/api/data/'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await r.json();if(!r.ok){const e=Error(data.error||'请求失败');e.status=r.status;throw e;}return data;}
function modeLabel(mode){$('storageMode').textContent=mode==='cloud'?'云端记录 · Netlify Blobs':'本机体验 · SQLite';}
function authUI(yes){document.body.classList.toggle('teacher-session',yes);$('dashboard').hidden=!yes;$('loginPanel').hidden=yes;$('logout').hidden=!yes;if(!yes){globalThis.TeacherClassroom?.reset();clearDetail();if($('clearDialog').open)$('clearDialog').close();clearPlan=null;}}
function query(){return new URLSearchParams({from:$('from').value,to:$('to').value,class:$('classFilter').value,type:$('typeFilter').value,q:$('search').value,lesson:$('lessonFilter').value,page}).toString();}
async function load(){if(busy)return;busy=true;$('refresh').disabled=true;$('clearRecords').disabled=true;$('dashboardStatus').textContent='正在读取记录…';try{if(globalThis.TeacherClassroom&&!TeacherClassroom.isRaw()){const roomParams=new URLSearchParams(query());roomParams.set('page',TeacherClassroom.page());roomParams.set('attention',TeacherClassroom.attention());const data=await api('classroom/overview?'+roomParams);modeLabel(data.mode);authUI(true);await TeacherClassroom.render(data);$('rangeLabel').textContent=data.lesson?data.lesson.date+' · '+data.lesson.title+' · 完整任务记录（含补交）':data.range.from+' 至 '+data.range.to+' · 按学生汇总';$('dashboardStatus').textContent='已更新。';return true;}result=await api('records?'+query());modeLabel(result.mode);render();$('dashboardStatus').textContent='已更新。';return true;}catch(e){$('dashboardStatus').textContent=e.message;if(e.status===401){authUI(false);$('loginStatus').textContent='登录已过期，请重新登录。';}return false;}finally{busy=false;$('refresh').disabled=false;$('clearRecords').disabled=false;}}
function summary(e){const m=detailUI.build(e);return m.lead;}
function render(){const s=result.summary;authUI(true);$('rangeLabel').textContent=result.range.from+' 至 '+result.range.to+' · 筛选范围内统计';$('stats').innerHTML=[[s.participants,'学习编号数'],[s.records,'上传记录'],[s.practiceAttempts,'提交作答'],[s.experimentRecords,'实验记录'],[(s.activeSeconds/60).toFixed(1),'前台活动分钟（估计）']].map(([value,title])=>'<div class="stat"><strong>'+E(value)+'</strong><span>'+title+'</span></div>').join('');const selected=$('classFilter').value;$('classFilter').innerHTML='<option value="">全部班级</option>'+[...new Set([...result.classes,...(globalThis.TeacherClassroom?.knownClasses()||[])])].map(c=>'<option '+(c===selected?'selected':'')+' value="'+E(c)+'">'+E(c)+'</option>').join('');
 $('undoClear').hidden=!lastClear;
 $('questionStats').innerHTML=s.questions.slice(0,6).map(q=>'<div class="insight-row"><span>'+E(q.title)+'</span><span>需订正 '+q.needsReview+' / 提交 '+q.attempts+'</span></div><div class="bar"><i style="width:'+Math.round(100*q.needsReview/q.attempts)+'%"></i></div>').join('')||'<p class="muted">收到作答记录后显示。</p>';
 const maximum=Math.max(1,...s.modules.map(m=>m.seconds));$('moduleStats').innerHTML=s.modules.slice(0,6).map(m=>'<div class="insight-row"><span>'+E(views[m.view]||m.view)+'</span><span>'+(m.seconds/60).toFixed(1)+' 分钟 · '+m.visits+' 次切换/进入</span></div><div class="bar"><i style="width:'+Math.round(100*m.seconds/maximum)+'%"></i></div>').join('')||'<p class="muted">加入记录后才会统计使用情况。</p>';
 $('recordCount').textContent='共 '+result.total+' 条，本页 '+result.events.length+' 条。';$('records').innerHTML=result.events.map((e,i)=>'<tr><td>'+E(new Date(e.receivedAt).toLocaleString('zh-CN'))+'</td><td>'+E(e.className||'未填班级')+'<small>'+E(e.alias||e.participantId.slice(0,8))+'</small></td><td>'+E(names[e.type])+'</td><td>'+E(summary(e))+'</td><td><button type="button" data-detail="'+i+'">查看</button></td></tr>').join('')||'<tr><td colspan="5">当前筛选下没有记录。请让学生先同意加入，再提交作答或实验记录。</td></tr>';
 $('previous').disabled=page===0;$('next').disabled=(page+1)*100>=result.total;$('pageLabel').textContent='第 '+(page+1)+' 页';$('dataNotice').textContent=result.notice;
}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;$('loginStatus').textContent='正在登录…';try{await api('login',{password:$('password').value});$('password').value='';const me=await api('teacher');modeLabel(me.mode);$('from').value=me.today;$('to').value=me.today;page=0;await load();}catch(e){$('loginStatus').textContent=e.message;}finally{b.disabled=false;}});
$('logout').onclick=async()=>{try{await api('logout',{});}finally{clearDetail();result=null;$('records').innerHTML='';$('stats').innerHTML='';authUI(false);$('loginStatus').textContent='已退出。';}};
$('filters').onsubmit=e=>{e.preventDefault();page=0;globalThis.TeacherClassroom?.resetPage();load();};$('refresh').onclick=load;$('previous').onclick=()=>{page--;load();};$('next').onclick=()=>{page++;load();};
function rememberClear(value){lastClear=value;$('undoClear').hidden=!value;try{if(value)localStorage.setItem('chem_teacher_last_clear',value);else localStorage.removeItem('chem_teacher_last_clear');}catch{}}
function clearFailure(e){if(e.status===401){authUI(false);$('loginStatus').textContent='登录已过期，请重新登录。';}else $('clearStatus').textContent=e.message;}
$('clearRecords').onclick=async()=>{
 if(busy||clearing)return;if(globalThis.TeacherClassroom&&!TeacherClassroom.isRaw()){TeacherClassroom.activate('raw');return;}clearing=true;$('clearRecords').disabled=true;$('dashboardStatus').textContent='正在核对清除范围…';
 try{
  const scope=Object.fromEntries(new URLSearchParams(query()));delete scope.page;
  clearPlan=await api('records/clear-preview',scope);
  if(!clearPlan.total){$('dashboardStatus').textContent='当前筛选范围没有可清除的记录。';clearPlan=null;return;}
  const p=clearPlan;
  $('clearScope').innerHTML=[['日期',p.range.from+' 至 '+p.range.to],['班级',p.filters.className||'全部班级'],['记录类型',names[p.filters.type]||'全部类型'],['查找条件',p.filters.q||'不限制'],['课堂任务',$('lessonFilter').selectedOptions[0]?.textContent||'全部课次'],['将清除的记录',p.total+' 条（包含其他页）'],['涉及学习编号',p.participants+' 个']].map(([k,v])=>'<div><dt>'+E(k)+'</dt><dd>'+E(v)+'</dd></div>').join('');
  $('confirmClear').textContent='清除这 '+p.total+' 条记录';$('clearStatus').textContent='';$('dashboardStatus').textContent='请在弹窗中核对范围。';$('clearDialog').showModal();
 }catch(e){$('dashboardStatus').textContent=e.message;if(e.status===401)clearFailure(e);}
 finally{clearing=false;$('clearRecords').disabled=false;}
};
$('cancelClear').onclick=()=>{if(!clearing){$('clearDialog').close();clearPlan=null;$('dashboardStatus').textContent='已取消清除，记录未改动。';}};
$('clearDialog').addEventListener('cancel',e=>{if(clearing)e.preventDefault();else{clearPlan=null;$('dashboardStatus').textContent='已取消清除，记录未改动。';}});
$('confirmClear').onclick=async()=>{
 if(clearing||!clearPlan)return;clearing=true;$('confirmClear').disabled=true;$('cancelClear').disabled=true;$('clearStatus').textContent='正在清除，请稍候…';
 try{
  const d=await api('records/clear',{planId:clearPlan.planId});rememberClear(d.cleared?d.operationId:lastClear);
  const resetClass=!!clearPlan.filters.className;clearPlan=null;$('clearDialog').close();clearDetail();page=0;if(resetClass)$('classFilter').value='';
  if(await load())$('dashboardStatus').textContent='已清除 '+d.cleared+' 条记录，可点击“撤销上次清除”恢复。'+(resetClass?'列表已切换为全部班级。':'')+' 学生继续使用会产生新记录。';
 }catch(e){clearFailure(e);}
 finally{clearing=false;$('confirmClear').disabled=false;$('cancelClear').disabled=false;}
};
$('undoClear').onclick=async()=>{
 if(busy||clearing||!lastClear)return;clearing=true;$('undoClear').disabled=true;
 try{const d=await api('records/restore',{operationId:lastClear});rememberClear('');clearDetail();page=0;if(await load())$('dashboardStatus').textContent='已恢复 '+d.restored+' 条记录。';}
 catch(e){$('dashboardStatus').textContent=e.message;if(e.status===404)rememberClear('');if(e.status===401)clearFailure(e);}
 finally{clearing=false;$('undoClear').disabled=false;}
};
function clearDetail(){detailToken++;currentDetail=null;$('detailContent').innerHTML='';$('detailStatus').textContent='';if($('detail').open)$('detail').close();}
globalThis.TeacherRecord={open:event=>{paintDetail(event);if(!$('detail').open)$('detail').showModal();$('detail').scrollTop=0;}};
function paintDetail(event){currentDetail=detailUI.build(event,questionBank);$('detailContent').innerHTML=detailUI.render(currentDetail);$('detail').scrollTop=0;}
$('records').onclick=async e=>{const b=e.target.closest('[data-detail]');if(!b)return;const event=result?.events[Number(b.dataset.detail)];if(!event)return;const token=++detailToken;$('detailStatus').textContent='';paintDetail(event);if(!$('detail').open)$('detail').showModal();$('detail').scrollTop=0;requestAnimationFrame(()=>{if(token===detailToken&&$('detail').open)$('detail').scrollTop=0;});if(event.type==='practice'){await questionBankReady;if(token===detailToken&&$('detail').open)paintDetail(event);}};
$('closeDetail').onclick=()=>$('detail').close();
$('detail').addEventListener('close',()=>{detailToken++;currentDetail=null;finishPrint();$('detailContent').innerHTML='';$('detailStatus').textContent='';});
$('copyDetail').onclick=async()=>{if(!currentDetail)return;try{await navigator.clipboard.writeText(detailUI.plain(currentDetail));$('detailStatus').textContent='已复制中文记录，可直接粘贴到汇报文档。';}catch{$('detailStatus').textContent='浏览器未允许复制，可点“下载文字记录”保存。';}};
$('downloadDetail').onclick=()=>{if(!currentDetail)return;const u=URL.createObjectURL(new Blob([detailUI.plain(currentDetail)],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='学习记录-'+currentDetail.tag+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);$('detailStatus').textContent='已下载中文文字记录。';};
let printSections=[];
$('printDetail').onclick=()=>{if(!currentDetail)return;printSections=[...$('detailContent').querySelectorAll('details:not([open])')];printSections.forEach(x=>x.open=true);document.body.classList.add('printing-detail');try{window.print();}catch{$('detailStatus').textContent='当前浏览器无法打印，请下载文字记录。';}finally{finishPrint();}};
function finishPrint(){document.body.classList.remove('printing-detail');printSections.forEach(x=>x.open=false);printSections=[];}
window.addEventListener('afterprint',finishPrint);
function csvCell(v){let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
$('export').onclick=async()=>{if(!result)return;const snapshot=result;await questionBankReady;const rows=[['收到时间（北京时间）','学习编号','昵称','班级','类型','摘要','中文详情'],...snapshot.events.map(e=>[detailUI.time(e.receivedAt),e.participantId,e.alias,e.className,names[e.type],summary(e),detailUI.plain(detailUI.build(e,questionBank))])],u=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='学习记录-'+snapshot.range.from+'-第'+(snapshot.page+1)+'页.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);};
globalThis.TeacherReload=load;
(async()=>{try{const health=await api('health');modeLabel(health.mode);if(!health.configured){$('loginStatus').textContent='后台未配置。请按压缩包里的部署说明完成设置。';return;}const me=await api('teacher');$('from').value=me.today;$('to').value=me.today;await load();}catch(e){if(e.status!==401)$('loginStatus').textContent=location.protocol==='file:'?'请通过“启动体验.cmd”打开教师后台。':e.message;}})();
