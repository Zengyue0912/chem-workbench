import {stocks,setups,capacities,vesselNames,newSetup,volume,fmt,dispense,transfer,observe} from './color-lab-model.js?v=3';
import {createReactionPlayer,describeChange} from './color-lab-reaction.js?v=1';

const storage='chem-color-bench-v1';
const doses={pipette:[0.5,1,2,5,10],dropper:[0.05,0.1,0.15,0.25]};
const names=['A','B'];
function recover() {
  let saved={};
  try { saved=JSON.parse(sessionStorage.getItem(storage)) || {}; } catch {}
  const all={};
  for (const [id,setup] of Object.entries(setups)) {
    const s=saved[id], base=newSetup(id);
    all[id]=base;
    if (!s || !Array.isArray(s.vessels) || s.vessels.length!==2) continue;
    if (!s.vessels.every(v=>v && Object.hasOwn(capacities,v.kind) && v.stock && typeof v.stock==='object' &&
      !Array.isArray(v.stock) && Object.entries(v.stock).every(([key,n])=>setup.reagents.includes(key) && Number.isFinite(n) && n>=0) &&
      volume(v)<=capacities[v.kind]+1e-8)) continue;
    base.vessels=s.vessels; base.active=s.active===1?1:0;
    if (setup.reagents.includes(s.reagent)) base.reagent=s.reagent;
    if (Object.hasOwn(doses,s.tool) && doses[s.tool].includes(s.amount)) {base.tool=s.tool;base.amount=s.amount;}
    if (Array.isArray(s.log)) base.log=s.log.filter(line=>typeof line==='string').slice(-100);
    if (typeof s.note==='string') base.note=s.note.slice(0,1600);
  }
  return all;
}
function vesselCard(i) {
  return '<button type="button" class="fl-vessel" data-vessel="'+i+'" aria-pressed="false">'+
    '<span class="fl-vessel-title"><strong>'+names[i]+' 杯</strong><small data-kind></small></span>'+
    '<span class="fl-window" aria-hidden="true"><span class="fl-glass"><span class="fl-fluid"><canvas class="fl-flow"></canvas></span><span class="fl-deposit"></span><i class="fl-drop"></i></span>'+
    '<span class="fl-sample"><span class="fl-sample-glass"><i class="fl-sample-fluid"><canvas class="fl-sample-flow"></canvas></i><i class="fl-sample-deposit"></i></span><small data-sample-label></small></span></span>'+
    '<span class="fl-result"><b data-appearance></b><b class="fl-phase"></b><small data-volume></small></span><span class="fl-reading"></span></button>';
}
const button=(action,label,cls='cw-secondary')=>'<button type="button" class="'+cls+'" data-fl="'+action+'">'+label+'</button>';
function snapshot(label){
  return '<div class="fl-snapshot"><i class="fl-swatch" aria-hidden="true"></i><span><small>'+label+'</small><b></b></span></div>';
}
class ColorLab extends HTMLElement {
  constructor() {
    super();
    this.idKey='iodine';this.sessions=recover();
    try { const last=sessionStorage.getItem(storage+'-tray'); if (Object.hasOwn(setups,last)) this.idKey=last; } catch {}
    this.undoStack={indicator:[],iodine:[],copper:[]};
    this.lastChanges={};
    this.addEventListener('click',e=>this.clickControl(e));
    this.addEventListener('change',e=>this.changeControl(e));
    this.addEventListener('input',e=>{
      if(e.target.name==='fl-note'){this.state.note=e.target.value;this.save();}
    });
    this.addEventListener('dragstart',e=>{
      const card=e.target.closest('[data-stock]');
      if(card && e.dataTransfer) {e.dataTransfer.setData('application/x-chem-color-stock',card.dataset.stock);e.dataTransfer.effectAllowed='copy';}
    });
    this.addEventListener('dragover',e=>{
      if(e.target.closest('[data-vessel]') && e.dataTransfer?.types.includes('application/x-chem-color-stock')) e.preventDefault();
    });
    this.addEventListener('drop',e=>{
      const cup=e.target.closest('[data-vessel]'),key=e.dataTransfer?.getData('application/x-chem-color-stock');
      if(!cup || !this.setup.reagents.includes(key)) return;
      e.preventDefault();this.state.active=Number(cup.dataset.vessel);this.state.reagent=key;this.operate('add');
    });
  }
  get state(){return this.sessions[this.idKey];}
  get setup(){return setups[this.idKey];}
  el(selector){return this.querySelector(selector);}
  say(message){this.el('.fl-status').textContent=message;}
  save(){
    try{sessionStorage.setItem(storage,JSON.stringify(this.sessions));sessionStorage.setItem(storage+'-tray',this.idKey);}
    catch{this.el('.fl-save-note').textContent='此浏览器无法暂存，请下载记录。';}
  }
  connectedCallback() {
    this.innerHTML='<header class="cw-head-row fl-heading"><h1>自由实验台</h1><button type="button" class="cw-secondary" data-cw-kind="exp">返回虚拟实验室</button></header>'+
      '<nav class="fl-trays" aria-label="选择实验">'+Object.entries(setups).map(([key,x])=>
        '<button type="button" data-tray="'+key+'"><span class="fl-palette" aria-hidden="true">'+x.palette.map(c=>'<i style="background:'+c+'"></i>').join('')+'</span>'+x.short+'</button>').join('')+'</nav>'+
      '<div class="fl-layout"><section class="fl-panel fl-observe"><header><div class="fl-observe-head"><h2 class="fl-title"></h2>'+
      '<label class="fl-compare-toggle"><input type="checkbox" name="fl-compare">白底比色</label></div><p class="fl-prompt"></p></header>'+
      '<div class="fl-pair">'+vesselCard(0)+vesselCard(1)+'</div>'+
      '<section class="fl-change" aria-label="本次加液前后" hidden><div class="fl-change-heading"><strong></strong>'+
      '<span class="fl-change-actions">'+button('repeat','再加同量','fl-repeat')+button('replay','重看变化','fl-replay')+'</span></div><div class="fl-snapshots">'+snapshot('加入前')+'<span class="fl-direction" aria-hidden="true">→</span>'+snapshot('混匀后')+'</div></section>'+
      '<div class="fl-transfer">'+button('split','等分到另一杯')+button('pour','转移到另一杯')+
      '<label>空杯器皿<select name="fl-kind"><option value="smallBeaker">25 mL 烧杯</option><option value="beaker">50 mL 烧杯</option><option value="tube">20 mL 试管</option></select></label>'+
      button('empty','倒空当前杯','fl-plain')+'</div></section>'+
      '<section class="fl-panel fl-rack"><h2>试剂架</h2><p>选好试剂后加入，也可拖到杯中。</p><div class="fl-stocks"></div>'+
      '<div class="fl-dosing"><label>取液工具<select name="fl-tool"><option value="pipette">刻度移液管</option><option value="dropper">滴管（模拟每滴 0.05 mL）</option></select></label>'+
      '<label>每次用量<select name="fl-dose"></select></label></div>'+button('add','加入试剂','cw-primary fl-add')+
      '<div class="fl-status" role="status"></div></section></div>'+
      '<section class="fl-panel fl-record"><div class="fl-record-head"><h2>观察记录</h2><div>'+button('restart','重做本实验','fl-plain')+button('undo','撤销上一步')+button('download','下载记录')+'</div></div>'+
      '<div class="fl-record-grid"><ol class="fl-log"></ol><label>我的结论<textarea name="fl-note" rows="3" maxlength="1600" placeholder="对比两杯，记下改变了什么、观察到了什么。"></textarea></label></div>'+
      '<small class="fl-save-note">当前标签页保留最近 100 次操作，下载可保存记录和结论。</small></section>'+
      '<details class="fl-model-note"><summary>模拟条件与参考</summary><p class="fl-model-text"></p>'+
      '<p>自由选器材、按量加液参考 <a href="https://www.nobook.com/" target="_blank" rel="noopener">NOBOOK</a> 和 <a href="https://chemcollective.org/vlabs" target="_blank" rel="noopener">ChemCollective</a>。'+
      '操作与现象对照参考<a href="https://vcec.ustc.edu.cn/analychem.html" target="_blank" rel="noopener">中国科大分析化学实验</a>，pH 读数参考 <a href="https://phet.colorado.edu/en/simulations/ph-scale" target="_blank" rel="noopener">PhET</a>。</p></details>';
    this.motion=createReactionPlayer(this,(i,frame,drop)=>this.scene?.frame(i,frame,drop));
    this.refreshTray();
    if(this.classList.contains('fl-static'))return;
    const windows=[...this.querySelectorAll('.fl-window')];
    import('./color-lab-scene.js?v=3').then(({createScene})=>{
      if(!this.isConnected || this.el('.fl-window')!==windows[0])return;
      this.scene=createScene(windows);this.render();
    }).catch(()=>{}); // The same observations and fluid levels are drawn by the HTML view.
  }
  disconnectedCallback(){this.motion?.dispose();this.motion=null;this.scene?.dispose();this.scene=null;}
  refreshTray(){
    this.motion?.stop();
    this.querySelectorAll('[data-tray]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tray===this.idKey)));
    this.el('.fl-title').textContent=this.setup.title;
    this.el('.fl-prompt').textContent=this.setup.prompt;
    this.el('.fl-model-text').textContent=this.setup.note+' 扩散和沉降按便于观察的时间展示，读数取混匀后的状态。转移时按混匀后的比例分样。白底比色用等大的窗口展示液色与沉淀，实际体积见杯下读数。';
    this.el('.fl-stocks').innerHTML=this.setup.reagents.map(key=>'<button class="fl-stock" draggable="true" type="button" data-stock="'+key+'"><i style="--stock:'+stocks[key].color+'" aria-hidden="true"></i><span><strong>'+stocks[key].name+'</strong><small>'+stocks[key].label+'</small></span></button>').join('');
    this.el('[name="fl-note"]').value=this.state.note;
    this.say('');this.render();this.showChange();
  }
  showChange(){
    const panel=this.el('.fl-change'),item=this.lastChanges[this.idKey];
    panel.hidden=!item;
    if(!item)return;
    panel.querySelector('strong').textContent=item.label;
    panel.querySelector('[data-fl="replay"]').hidden=item.change.effect==='pour';
    const repeat=panel.querySelector('[data-fl="repeat"]');
    repeat.hidden=!item.dose;
    if(item.dose)repeat.textContent='再向 '+names[item.index]+' 杯加 '+fmt(item.dose.amount)+' mL';
    panel.querySelectorAll('.fl-snapshot').forEach((sample,i)=>{
      const state=i===0 ? item.change.before : item.change.after;
      sample.style.setProperty('--swatch-fluid',state.color);
      sample.style.setProperty('--swatch-bed',(100*state.depositShare)+'%');
      sample.dataset.empty=String(state.ml<1e-8);
      sample.querySelector('b').textContent=state.caption;
    });
  }
  revealCup(index){
    if(!matchMedia('(max-width:800px)').matches)return;
    const vessel=this.el('[data-vessel="'+index+'"] .fl-window');
    const bounds=vessel.getBoundingClientRect(),viewport=this.closest('#viewDoc')?.getBoundingClientRect();
    const visible=Math.min(bounds.bottom,viewport?.bottom??innerHeight,innerHeight)-Math.max(bounds.top,viewport?.top??0,0);
    if(visible<bounds.height*.65)vessel.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
  }
  render() {
    const s=this.state;
    const observations=s.vessels.map(v=>observe(this.idKey,v));
    this.querySelectorAll('[data-vessel]').forEach((b,i)=>{
      const v=s.vessels[i],o=observations[i],cap=capacities[v.kind];
      b.setAttribute('aria-pressed',String(i===s.active));
      b.dataset.kind=v.kind;b.dataset.filled=String(o.ml>1e-8);b.style.setProperty('--fluid',o.color);
      b.style.setProperty('--level',(100*o.ml/cap)+'%');
      b.style.setProperty('--sediment',(100*o.ml/cap*o.depositShare)+'%');
      b.style.setProperty('--sample-sediment',(100*o.depositShare)+'%');
      b.querySelector('[data-sample-label]').textContent=o.ml<1e-8?'空杯':o.solid>1e-8?'上层液与杯底沉淀':'溶液颜色';
      b.querySelector('[data-kind]').textContent=cap+' mL '+vesselNames[v.kind];
      b.querySelector('[data-appearance]').textContent=o.caption;
      b.querySelector('[data-volume]').textContent=fmt(o.ml)+' mL';
      b.querySelector('.fl-reading').textContent=o.reading || '待加入试剂';
    });
    this.scene?.update(s.vessels,observations);
    this.querySelectorAll('[data-stock]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.stock===s.reagent)));
    this.el('[name="fl-tool"]').value=s.tool;
    const dose=this.el('[name="fl-dose"]');
    if(dose.dataset.tool!==s.tool){
      dose.replaceChildren(...doses[s.tool].map(n=>new Option((s.tool==='dropper'?Math.round(n/.05)+' 滴 · ':'')+fmt(n)+' mL',n)));
      dose.dataset.tool=s.tool;
    }
    dose.value=String(s.amount);
    this.el('[data-fl="add"]').textContent='向 '+names[s.active]+' 杯加入 '+fmt(s.amount)+' mL';
    const current=s.vessels[s.active],other=s.vessels[1-s.active];
    const kind=this.el('[name="fl-kind"]');
    kind.value=current.kind;kind.disabled=volume(current)>1e-8;
    this.el('[data-fl="empty"]').disabled=volume(current)<1e-8;
    this.el('[data-fl="split"]').textContent='等分到 '+names[1-s.active]+' 杯';
    this.el('[data-fl="split"]').disabled=volume(current)<1e-8 || volume(other)>1e-8;
    this.el('[data-fl="pour"]').textContent='移取 '+fmt(s.amount)+' mL 到 '+names[1-s.active]+' 杯';
    this.el('[data-fl="pour"]').disabled=volume(current)<1e-8;
    this.el('[data-fl="undo"]').disabled=!this.undoStack[this.idKey].length;
    const initial='起始 A 杯含'+Object.entries(this.setup.start).map(([k,v])=>stocks[k].name+' '+fmt(v)+' mL').join('、')+'，B 杯为空。';
    const lines=[initial,...s.log];
    this.el('.fl-log').replaceChildren(...lines.reverse().map(text=>Object.assign(document.createElement('li'),{textContent:text})));
  }
  clickControl(e) {
    const b=e.target.closest('button');
    if(!b)return;
    const d=b.dataset;
    if(d.tray && d.tray!==this.idKey){this.idKey=d.tray;this.refreshTray();this.save();return;}
    if(d.vessel!==undefined || d.stock){
      if(d.stock)this.state.reagent=d.stock;else this.state.active=Number(d.vessel);
      this.say('');this.render();this.save();return;
    }
    if(d.fl==='download')return this.download();
    if(d.fl==='replay'){
      const item=this.lastChanges[this.idKey];
      if(item){this.revealCup(item.index);this.motion?.play(item.index,item.change,capacities[this.state.vessels[item.index].kind]);}
      return;
    }
    if(d.fl==='repeat'){
      const item=this.lastChanges[this.idKey];
      if(item?.dose){Object.assign(this.state,item.dose,{active:item.index});this.operate('add');}
      return;
    }
    if(d.fl==='undo'){
      const previous=this.undoStack[this.idKey].pop();if(!previous)return;
      this.motion?.stop();delete this.lastChanges[this.idKey];
      Object.assign(this.state,previous);this.say('已撤销上一步。');this.render();this.showChange();this.save();return;
    }
    if(d.fl)this.operate(d.fl);
  }
  changeControl(e){
    const s=this.state,t=e.target;
    if(t.name==='fl-tool'){s.tool=t.value;s.amount=doses[s.tool][s.tool==='pipette'?1:0];}
    else if(t.name==='fl-dose'){s.amount=Number(t.value);}
    else if(t.name==='fl-kind'){this.operate('kind',t.value);return;}
    else return;
    this.say('');this.render();this.save();
  }
  operate(action,value){
    const s=this.state,i=s.active,a=s.vessels[i],b=s.vessels[1-i];
    const prior={vessels:structuredClone(s.vessels),active:i,log:s.log.slice()};
    let error='',message='',affected=i;
    if(action==='add'){
      error=dispense(this.idKey,a,s.reagent,s.amount);
      message=names[i]+' 杯加入'+stocks[s.reagent].name+' '+fmt(s.amount)+' mL';
    } else if(action==='pour'||action==='split'){
      if(action==='split' && volume(b)>1e-8)return;
      const ml=action==='pour'?s.amount:volume(a)/2;
      error=transfer(a,b,ml);message=names[i]+' 杯混匀，移取 '+fmt(ml)+' mL 至 '+names[1-i]+' 杯';
      affected=1-i;
    } else if(action==='kind'){
      if(volume(a)>1e-8 || !Object.hasOwn(capacities,value))return;
      a.kind=value;message=names[i]+' 杯换用'+vesselNames[value];
    } else if(action==='restart'){
      const fresh=newSetup(this.idKey);
      Object.assign(prior,{reagent:s.reagent,tool:s.tool,amount:s.amount});
      Object.assign(s,{vessels:fresh.vessels,active:0,reagent:fresh.reagent,tool:fresh.tool,amount:fresh.amount});
      affected=0;message='重做本实验，A 杯恢复起始试液，B 杯为空';
    } else if(action==='empty'){a.stock={};message='倒空 '+names[i]+' 杯';}
    else return;
    if(error){this.say(error);this.render();return;}
    this.motion?.stop();
    const stack=this.undoStack[this.idKey];stack.push(prior);if(stack.length>16)stack.shift();
    const o=observe(this.idKey,s.vessels[affected]);
    const line=message+'。'+names[affected]+' 杯'+o.caption+(o.reading?'，'+o.reading:'')+'。';
    s.log.push(line);if(s.log.length>100)s.log.shift();
    let change=null;
    if(action==='add'||action==='pour'||action==='split'){
      const before=observe(this.idKey,prior.vessels[affected]);
      const source=action==='add' ? null : observe(this.idKey,prior.vessels[i]);
      const carried=source ? source.solid*(o.ml-before.ml)/source.ml : 0;
      change=describeChange(this.idKey,before,o,source?.color||stocks[s.reagent].color,source ? null : s.reagent,carried);
      const dose=source ? null : {reagent:s.reagent,tool:s.tool,amount:s.amount};
      this.lastChanges[this.idKey]={index:affected,change,label:message,dose};
    }else delete this.lastChanges[this.idKey];
    this.render();this.showChange();this.say(line);this.save();
    if(change){
      if(action==='add')this.revealCup(affected);
      this.motion?.play(affected,change,capacities[s.vessels[affected].kind]);
    }
  }
  download(){
    const s=this.state;
    const lines=[this.setup.title,'起始 A 杯：'+Object.entries(this.setup.start).map(([k,v])=>stocks[k].name+' '+v+' mL').join('、')+'；B 杯为空。',...s.log,''];
    s.vessels.forEach((v,i)=>{const o=observe(this.idKey,v);lines.push(names[i]+' 杯　'+fmt(o.ml)+' mL　'+o.caption+'　'+o.reading);});
    lines.push('','我的结论',s.note||'尚未填写','',this.setup.note);
    const url=URL.createObjectURL(new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/plain;charset=utf-8'}));
    const link=Object.assign(document.createElement('a'),{href:url,download:this.setup.title+'-观察记录.txt'});
    link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
}
if(!customElements.get('chem-color-lab'))customElements.define('chem-color-lab',ColorLab);
