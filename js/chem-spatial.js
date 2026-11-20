(function () {
'use strict';

const $ = id => document.getElementById(id);
const escape = window.ChemStudio.escape;
const viewport = $('viewport');
const redraw = () => window.needsDraw();
const items = {exp:window.DB.exps,app:window.DB.app,sub:window.DB.subs};
const names = {exp:'化学实验',app:'化学仪器',sub:'化学物品'};
const starts = {exp:'tit',app:'buret',sub:'phen'};
const image = (kind,id) => 'assets/spatial/' + kind + '-' + id + '.webp?v=2';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let renderer = null, loading = null, unavailable = false, sceneKey = '';
let activeTopic = '', returnTopic = '', browserKind = 'exp';
let search = '', chapter = '', page = 0;
const variants = new Map();

const camera = window.ChemLabCamera.create(viewport,(x,y) => {
  const legacy = window.E3.cam;
  legacy.yaw -= x*5.6;
  legacy.pitch = Math.max(-1.42,Math.min(1.42,legacy.pitch+y*4.2));
  redraw();
});

function enableRenderer() {
  if (renderer || loading || unavailable) return;
  loading = import('./chem-spatial-render.js?v=5').then(module => {
    renderer = module.createLabRenderer(viewport,$('cv'));
    if (window.UI.view === 'stage') redraw();
  }).catch(() => {
    unavailable = true;
    camera.stop();
    $('cwCameraButton')?.remove();
    $('cwHandsButton')?.remove();
  });
}

function openScene(kind,id,topic = '') {
  returnTopic = topic;
  window.ChemGames?.stop();
  if (kind === 'exp' && id === 'tit' && topic) window.ChemTitration.enter();
  else window.select(kind,id);
}

function tool(label,fn) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tool-btn cw-tool';
  button.textContent = label;
  button.onclick = fn;
  return button;
}

window.ChemSpatial = {
  sidebar,
  draw(model,options,legacy) {
    if (window.UI.view !== 'stage' || unavailable) return false;
    if (!renderer) { enableRenderer(); return false; }
    try {
      const success = renderer.draw(model,options,legacy);
      if (!success && viewport.classList.contains('cw-webgl-on')) {
        renderer.hide();
        camera.stop();
      }
      return success;
    } catch {
      renderer.dispose();
      renderer = null;
      unavailable = true;
      camera.stop();
      $('cwCameraButton')?.remove();
      $('cwHandsButton')?.remove();
      return false;
    }
  },
  capture:(isolated = false) => renderer?.capture(isolated) || '',
  toolbar(bar) {
    const {kind} = window.UI.sel || {};
    if (!['exp','app','sub','mol'].includes(kind)) return;
    if (!unavailable) {
      const ar = tool('摄像头 AR',null);
      ar.id = 'cwCameraButton';
      const hands = tool('开启手势',null);
      hands.id = 'cwHandsButton';
      bar.append(ar,hands);
      camera.bind({camera:ar,hands},redraw,bar);
    }
    if (returnTopic) bar.append(tool('回到考点',() => openTopic(returnTopic)));
    else if (items[kind]) bar.append(tool('浏览' + names[kind],() => openResources(kind)));
  }
};

window.addEventListener('chem:context',() => {
  const {view,sel} = window.UI;
  const key = view === 'stage' && sel ? sel.kind + ':' + sel.id : '';
  if (key !== sceneKey) camera.stop();
  sceneKey = key;
  if (!key) {
    returnTopic = '';
    renderer?.hide();
  }
  const resourceNav = $('navTree').querySelector('[data-cw-kind="exp"]');
  const viewingResources = (view === 'discovery' && $('cwResourceResults')) || (key && items[sel.kind]);
  if (viewingResources) resourceNav?.setAttribute('aria-current','page');
  else resourceNav?.removeAttribute('aria-current');
});

const topics = [
  {
    id:'titration',name:'滴定误差',book:'选择性必修 1',kind:'exp',model:'tit',tag:'D21',video:'titration',
    title:'哪个操作让测定值偏低？',detail:'看清液面和样品用量，再找出误差是从哪一步进入计算的。',
    observe:'打开滴定实验',focus:'按下滴加按钮，观察滴定管的液面和锥形瓶的颜色。',
    question:{title:'滴定误差',topic:'滴定',stem:'用高锰酸钾滴定测过氧化脲纯度。哪种操作会使测得的纯度偏低？',
      options:['配制样品溶液时加水超过容量瓶刻度线。','水洗滴定管后，没用标准液润洗。','滴定过程中有标准液滴到锥形瓶外。','滴定管尖嘴原来有气泡，滴定后气泡消失。']},
    exercise:'用 NaOH 标准溶液滴定一定体积的盐酸。锥形瓶里残留少量蒸馏水。按原取样体积计算，盐酸浓度的测定值通常怎样？',
    answers:['偏高','偏低','无影响'],correct:2,
    feedback:'残留水只稀释瓶里的溶液，进入锥形瓶的盐酸物质的量不变，恰好反应所需的标准液也不变。'
  },
  {
    id:'shape',name:'分子构型',book:'选择性必修 2',kind:'mol',model:'so2m',tag:'S06',video:'polarity',
    title:'同样是 V 形，电子域排布一样吗？',detail:'转动模型辨认原子位置，再数中心原子的成键域和孤电子域。',
    observe:'转动 SO₂ 模型',focus:'从两个方向看 SO₂，再在 S06 的提示里和 OF₂ 对比。',
    question:{title:'VSEPR 模型和分子构型',topic:'空间构型',stem:'下列粒子的 VSEPR 模型为平面三角形且其空间结构为 V 形的是',
      options:['SO₂','CO₂','BF₃','OF₂']},
    exercise:'已知 H₂S 的中心硫原子有两个成键域和两个孤电子域。它的电子域排布和分子构型分别是什么？',
    answers:['四面体排布，V 形','平面三角形排布，V 形','四面体排布，直线形'],correct:0,
    feedback:'四个电子域指向近似四面体的四个方向。判断分子构型时只看两个氢原子和中心硫的位置，所以是 V 形。'
  },
  {
    id:'crystal',name:'晶胞计算',book:'选择性必修 2',kind:'mol',model:'nacl',tag:'X03',
    title:'顶点有粒子，为什么只数八分之一？',detail:'旋转晶胞辨认顶点、棱心和面心，再用均摊法算一个晶胞的粒子数。',
    observe:'旋转氯化钠晶胞',focus:'把晶胞转到能同时看到三个面的方向，辨认哪些粒子会被相邻晶胞共享。',
    question:{title:'晶胞贡献',topic:'晶胞',stem:'一个立方晶胞的 8 个顶点和体心各有一个相同粒子。按位置均摊，求晶胞中个数。'},
    exercise:'某立方晶胞中，相同粒子位于 8 个顶点和 6 个面心。按均摊法，一个晶胞含多少个粒子？',
    answers:['2 个','4 个','6 个'],correct:1,
    feedback:'八个顶点共有 8×⅛＝1 个，六个面心共有 6×½＝3 个，合计 4 个。'
  }
];
const topicForId = id => topics.find(topic => topic.id === id);
const topicTerms = {
  titration:'酸碱滴定 滴定偏高 滴定偏低 滴定用量 终点 酚酞 浓度 高锰酸钾 偏高 偏低',
  shape:'分子构型 VSEPR 电子域 孤电子对 二氧化硫 形状',
  crystal:'晶胞计算 晶体结构 NaCl 顶点 棱心 面心 均摊'
};

function button(label,attributes,primary = false) {
  return '<button type="button" class="' + (primary ? 'cw-primary' : 'cw-secondary') + '" ' + attributes + '>' + label + '</button>';
}

function picture(kind,id,label,high = false) {
  return '<img class="cw-preview-image" src="' + image(kind,id) + '" alt="' + escape(label) +
    '" width="480" height="270" decoding="async" loading="' + (high ? 'eager' : 'lazy') + '">';
}

function lessonCard(item) {
  return `<button type="button" class="cw-card" data-cw-topic="${item.id}">
    <span class="cw-card-picture">${picture(item.kind,item.model,item.name + '的三维预览')}
      <span class="cw-card-label">${item.book}</span></span>
    <span class="cw-card-copy"><span class="cw-card-name">${item.name}</span>
      <strong>${item.title}</strong><small>${item.detail}</small><span class="cw-link">开始学习 <span aria-hidden="true">→</span></span>
    </span></button>`;
}

function resourceCard(kind) {
  const item = items[kind].find(entry=>entry.id === starts[kind]);
  return `<button type="button" class="cw-card cw-resource-card" data-cw-kind="${kind}">
    <span class="cw-card-picture">${picture(kind,item.id,item.name + '的三维预览')}</span>
    <span class="cw-card-copy"><strong>${names[kind]}</strong>
      <small>${items[kind].length} 项 · ${kind === 'exp' ? '做一次虚拟操作' : '旋转、标注和拆解'}</small>
      <span class="cw-link">打开目录 <span aria-hidden="true">→</span></span></span></button>`;
}

function searchForm() {
  return `<form class="cw-search" data-cw-search="topics"><label for="cwTopicQuery">找一个考点</label>
    <div><input id="cwTopicQuery" type="search" name="query" placeholder="例如：滴定偏高、VSEPR、均摊法" value="${escape(search)}">
      <button class="cw-primary" type="submit">搜索</button></div></form>`;
}

function home(root) {
  const shell = root.querySelector('.studio-home');
  if (!shell) return;
  if (shell.querySelector('.cw-discover')) return;
  const progress = shell.querySelector('.home-progress');
  const masthead = shell.querySelector('.university-masthead');
  if (!masthead) return;
  shell.replaceChildren(masthead);
  search = '';
  shell.insertAdjacentHTML('beforeend',`<div class="cw-discover">
    <header class="cw-hero">
      <div class="cw-hero-copy"><h1>高中化学 3D 考点工作台</h1>
        <p>在模型里看清现象，跟着题型 SOP 做题，再换一道自己试。</p>
        ${searchForm()}
        <div class="cw-actions">${button('贴一道题','data-cw-action="paste"',true)}
        ${button('进入虚拟实验室','data-cw-kind="exp"')}</div>
      </div>
      <button class="cw-hero-visual" type="button" data-cw-topic="shape">
        ${picture('mol','so2m','可旋转的二氧化硫球棍模型',true)}
        <span class="cw-hero-caption"><strong>SO₂ · 分子构型</strong><small>打开专题 →</small></span>
      </button>
    </header>
    <section aria-label="找考点"><div class="cw-head-row"><h2>从一个考点开始</h2>
      ${button('查解题步骤','data-cw-action="library"')}</div>
      <div class="cw-grid">${topics.map(lessonCard).join('')}</div></section>
    <section aria-label="虚拟实验室"><h2>虚拟实验室</h2><div class="cw-grid">${Object.keys(items).map(resourceCard).join('')}</div></section>
    <div class="cw-home-links">
      ${button('高考真题空间实战','data-exam-model="styrene"')}
      ${button('同步练习','data-lab="practice"')}
      ${button('化学小游戏','data-lab="games"')}
      ${button('错题本','data-teach="mistakes"')}
      ${button('教师备课','data-teach="lessons"')}
    </div></div>`);
  if (progress) shell.append(progress);
}

const oldHome = window.ChemEnhance.home;
window.ChemEnhance.home = root => { oldHome(root); home(root); };

function mount(title,content,target) {
  window.ChemGames?.stop();
  window.UI.view = 'discovery';
  window.UI.sel = null;
  $('viewStage').classList.add('hide');
  $('viewDoc').classList.add('show');
  $('viewPT')?.classList.add('hide');
  $('sidebar').classList.remove('show');
  $('mask').classList.remove('show');
  $('inspector')?.classList.remove('show');
  $('docBody').innerHTML = '<section class="cw-discover cw-page" aria-label="' + escape(title) + '">' + content + '</section>';
  window.dispatchEvent(new CustomEvent('chem:context'));
  if (target) {
    $('viewDoc').scrollTop = 0;
    const heading = $('docBody').querySelector(target);
    heading?.setAttribute('tabindex','-1');
    heading?.focus();
  }
}

function openCenter(value = '') {
  search = value.trim();
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  const result = topics.filter(topic=>{
    const searchable = [topic.name,topic.title,topic.detail,topic.tag,topicTerms[topic.id]].join(' ').toLowerCase();
    return terms.every(term=>searchable.includes(term));
  });
  const related = search ? window.ChemPreparedSop.catalog.filter(item => {
    const text = [item.title,item.id,item.topic,...item.context,...item.ask].join(' ').toLowerCase();
    return terms.every(term=>text.includes(term));
  }).slice(0,8) : [];
  mount('找考点',`<div class="cw-head-row"><h1>找考点</h1>${button('贴一道题','data-cw-action="paste"')}</div>
    ${searchForm()}
    ${result.length ? `<div class="cw-grid">${result.map(lessonCard).join('')}</div>` : '<p class="cw-quiet">可以换个关键词，或点「查解题步骤」继续找。</p>'}
    ${related.length ? `<section><h2>相关题型 SOP</h2><div class="cw-result-list">${related.map(item=>
      button(escape(item.id + ' · ' + item.title),'data-cw-sop="' + item.id + '"')).join('')}</div></section>` : ''}
    <div class="cw-actions">${button('查解题步骤','data-cw-action="library"')}</div>`,'h1');
}

function openTopic(id,focus = 'h1') {
  const topic = topicForId(id);
  if (!topic) return;
  activeTopic = topic.id;
  const result = variants.get(id);
  mount(topic.name,`<button class="cw-back" type="button" data-cw-action="center">← 找考点</button>
    <header class="cw-topic-hero"><div class="cw-topic-intro"><p class="cw-kicker">${topic.book} / ${topic.name}</p>
      <h1>${topic.title}</h1><p>${topic.detail}</p>
      ${button(topic.observe,'data-cw-action="observe"',true)}</div>
      <div class="cw-topic-picture">${picture(topic.kind,topic.model,topic.name + '三维预览',true)}</div></header>
    <ol class="cw-topic-path">
      <li><div><h2>观察三维模型</h2><p>${topic.focus}</p></div>
        ${topic.id === 'crystal' ? button('另用切片观察','data-exam-model="nacl"') : ''}
        ${topic.video ? `<details class="cw-clip"><summary>看本专题微课</summary><video controls playsinline preload="none"
          poster="${image(topic.kind,topic.model)}" src="assets/study-videos/${topic.video}.mp4" aria-label="${topic.name}微课"></video></details>` : ''}</li>
      <li><div><h2>跟着 SOP 做题</h2><p>${topic.tag} · ${topic.question.title}</p></div>
        ${button('按步骤开始','data-cw-action="solve"',true)}</li>
      <li id="cwVariant"><div><h2>独立做一道变式</h2><p>${topic.exercise}</p>
        <div class="cw-actions">${topic.answers.map((answer,index) =>
          button(escape(answer),'data-cw-answer="' + index + '" aria-pressed="' + (result?.choice === index) + '"')).join('')}</div>
        ${result ? `<p class="cw-feedback ${result.correct ? 'is-correct' : ''}" role="status">
          <strong>${result.correct ? '答对了' : '再试一次'}</strong> ${result.correct ? topic.feedback : '先圈出变式的已知条件，再用同一套考法。'}</p>` : ''}
      </div></li>
    </ol>`,focus);
}

function drawResources() {
  const kind = browserKind;
  const source = items[kind];
  const listing = source.filter(item => (!chapter || item.subName === chapter) &&
    (!search || [item.name,item.subName,item.formula,...(item.tags || [])].join(' ').toLowerCase().includes(search.toLowerCase())));
  const size = 12;
  const count = Math.max(1,Math.ceil(listing.length/size));
  page = Math.min(page,count-1);
  const grid = $('cwResourceResults');
  $('cwResourceCount').textContent = '找到 ' + listing.length + ' 项 · 第 ' + (page+1) + ' / ' + count + ' 页';
  grid.innerHTML = listing.slice(page*size,(page+1)*size).map(item=>{
    const tags = (item.tags || []).slice(0,2);
    if (window.UI.isFavorite(kind,item.id)) tags.push('已收藏');
    return `<button type="button" class="cw-card cw-object-card"
    data-cw-open="${kind}" data-cw-id="${escape(item.id)}"><span class="cw-card-picture">
      ${picture(kind,item.id,item.name + '的三维预览')}<span class="cw-card-label">${escape(item.subName || names[kind])}</span></span>
      <span class="cw-card-copy"><strong>${escape(item.name)}</strong>
      <small>${escape(tags.join(' · '))}</small>
      <span class="cw-link">${kind === 'exp' ? '进入实验' : '打开 3D 模型'} <span aria-hidden="true">→</span></span></span></button>`;
  }).join('') ||
    '<p class="cw-quiet">没有符合条件的内容，试试换个关键词。</p>';
  $('cwPageBack').disabled = page === 0;
  $('cwPageNext').disabled = page + 1 >= count;
}

function openResources(kind) {
  if (!items[kind]) return;
  browserKind = kind;
  search = chapter = '';
  page = 0;
  const chapters = [...new Set(items[kind].map(item=>item.subName).filter(Boolean))];
  mount(names[kind],`<div class="cw-head-row"><h1>虚拟实验室</h1>${button('返回工作台','data-cw-action="home"')}</div>
    <nav class="cw-actions" aria-label="实验室资源类型">${Object.keys(names).map(key => button(names[key],
      'data-cw-kind="' + key + '" aria-pressed="' + (key === kind) + '"')).join('')}</nav>
    <div class="cw-filters"><label>搜${names[kind]}<input id="cwResourceSearch" type="search" placeholder="输入名称或用途"></label>
    <label>教材章节<select id="cwResourceChapter"><option value="">全部章节</option>${chapters.map(title=>
      '<option>' + escape(title) + '</option>').join('')}</select></label></div>
    <p id="cwResourceCount" class="cw-quiet" role="status"></p><div class="cw-grid" id="cwResourceResults"></div>
    <div class="cw-actions"><button class="cw-secondary" type="button" id="cwPageBack" data-cw-page="-1">上一页</button>
    <button class="cw-secondary" type="button" id="cwPageNext" data-cw-page="1">下一页</button></div>`,'h1');
  drawResources();
}

document.addEventListener('submit',event=>{
  if (event.target.dataset.cwSearch !== 'topics') return;
  event.preventDefault();
  openCenter(new FormData(event.target).get('query') || '');
});
document.addEventListener('input',event=>{
  if (event.target.id !== 'cwResourceSearch' && event.target.id !== 'cwResourceChapter') return;
  if (event.target.id === 'cwResourceSearch') search = event.target.value.trim();
  else chapter = event.target.value;
  page = 0;
  drawResources();
});
document.addEventListener('click',event=>{
  const control = event.target.closest('[data-cw-topic],[data-cw-kind],[data-cw-open],[data-cw-action],[data-cw-answer],[data-cw-page],[data-cw-sop]');
  if (!control) return;
  const {cwTopic,cwKind,cwOpen,cwId,cwAction,cwAnswer,cwPage,cwSop} = control.dataset;
  if (cwTopic) return openTopic(cwTopic);
  if (cwKind) return openResources(cwKind);
  if (cwOpen) return openScene(cwOpen,cwId);
  if (cwPage) { page += Number(cwPage); drawResources(); return; }
  if (cwSop) return window.ChemStudentStudy.openLibrary(cwSop);
  if (cwAction === 'home') return window.showHome();
  if (cwAction === 'paste') return window.ChemStudentStudy.openOwnQuestion();
  if (cwAction === 'library') return window.ChemStudentStudy.openLibrary();
  if (cwAction === 'center') return openCenter();
  const topic = topicForId(activeTopic);
  if (!topic) return;
  if (cwAction === 'observe') return openScene(topic.kind,topic.model,topic.id);
  if (cwAction === 'solve') return window.ChemStudentStudy.openQuestion(topic.question,'',{
    analyze:true,practice:() => openTopic(topic.id,'#cwVariant h2')
  });
  if (cwAnswer !== undefined) {
    const choice = Number(cwAnswer);
    variants.set(topic.id,{choice,correct:choice === topic.correct});
    openTopic(topic.id,'#cwVariant h2');
  }
});

function sidebar() {
  const tree = $('navTree');
  if (!tree.querySelector('[data-cw-action="center"]')) {
    tree.insertAdjacentHTML('afterbegin',
      '<div class="nav-group"><button type="button" class="nav-cat new-nav" data-cw-action="center"><span class="ni" aria-hidden="true">◈</span><span>找考点</span></button></div>' +
      '<div class="nav-group"><button type="button" class="nav-cat new-nav" data-cw-kind="exp"><span class="ni" aria-hidden="true">◫</span><span>虚拟实验室</span></button></div>');
  }
  for (const category of ['exps','apps','subs']) {
    const group = tree.querySelector('[data-mod="' + category + '"]')?.closest('.nav-group');
    if (group) group.hidden = true;
  }
  window.reorderNav?.();
}
sidebar();
if (window.UI.view === 'home') home($('docBody'));
})();
