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
let textbookModule, resourceReturn = '', openingBookResource = false;
const variants = new Map();

const camera = window.ChemLabCamera.create(viewport,(x,y) => {
  const legacy = window.E3.cam;
  legacy.yaw -= x*5.6;
  legacy.pitch = Math.max(-1.42,Math.min(1.42,legacy.pitch+y*4.2));
  redraw();
});

function enableRenderer() {
  if (renderer || loading || unavailable) return;
  loading = import('./chem-spatial-render.js?v=6').then(module => {
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
  pickPart:(x,y,parts) => renderer?.pickPart(x,y,parts),
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
    const linkedKind = {mol:'model',exp:'lab'}[kind];
    if (resourceReturn && new URLSearchParams(location.search).get('resource') === linkedKind + ':' + window.UI.sel.id) {
      const origin = resourceReturn;
      bar.append(tool('返回本节课本',() => navigateBook(origin)));
    }
    else if (returnTopic) bar.append(tool('回到考点',() => openTopic(returnTopic)));
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
  const inFreeLab = view === 'discovery' && Boolean($('cwFreeLab'));
  const inBook = view === 'discovery' && Boolean($('cwBook'));
  const locationUrl = new URL(location.href);
  if (!inBook && !openingBookResource && locationUrl.searchParams.has('book')) {
    for (const field of ['book','volume','section','resource','bookQuery']) locationUrl.searchParams.delete(field);
    history.replaceState(history.state,'',locationUrl);
    resourceReturn = '';
    $('ct-resource-back')?.remove();
  }
  if (inFreeLab !== (locationUrl.searchParams.get('lab') === 'colors')) {
    if (inFreeLab) locationUrl.searchParams.set('lab','colors');
    else locationUrl.searchParams.delete('lab');
    history.replaceState(history.state,'',locationUrl);
  }
  const viewingResources = inFreeLab || (view === 'discovery' && $('cwResourceResults')) || (key && items[sel.kind]);
  if (viewingResources) resourceNav?.setAttribute('aria-current','page');
  else resourceNav?.removeAttribute('aria-current');
  const bookNav=$('navTree').querySelector('[data-cw-action="book"]');
  if(inBook)bookNav?.setAttribute('aria-current','page');
  else bookNav?.removeAttribute('aria-current');
  const topicNav = $('navTree').querySelector('[data-cw-action="center"]');
  if (view === 'discovery' && !viewingResources && !inBook) topicNav?.setAttribute('aria-current','page');
  else topicNav?.removeAttribute('aria-current');
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
    <div><input id="cwTopicQuery" type="search" name="query" placeholder="搜索考点或题型" value="${escape(search)}">
      <button class="cw-primary" type="submit">搜索</button></div></form>`;
}

function updateClassCard() {
  const card = $('cwClassCard');
  if (!card) return;
  const state = window.ChemClassroom?.homeState();
  const title = card.querySelector('h2');
  const copy = card.querySelector('p');
  const entry = card.querySelector('button');
  const hero = card.parentElement.querySelector('.cw-lab-hero');
  if (state?.joined && card.nextElementSibling !== hero) hero.before(card);
  if (!state?.joined && hero.nextElementSibling !== card) hero.after(card);
  title.textContent = state?.lesson?.title || state?.className || '我的课堂';
  if (state?.lesson) {
    const lesson = state.lesson;
    copy.textContent = [state.className,
      lesson.questions ? lesson.questions + ' 道练习' : '',
      lesson.experiments ? lesson.experiments + (lesson.report ? ' 份实验报告' : ' 个实验') : ''
    ].filter(Boolean).join(' · ');
  } else if (state?.joined) {
    copy.textContent = state.available ? '有 ' + state.available + ' 项课堂任务可选。' : '打开课堂查看老师发布的任务。';
  } else if (state?.offline) {
    copy.textContent = '课堂暂时未连接。你可以先做实验或练习。';
  } else {
    copy.textContent = '用班级参加码和学号领取老师布置的任务。';
  }
  entry.textContent = state?.lesson ? '打开本次任务' : state?.joined ? '查看课堂任务' : state?.offline ? '查看连接状态' : '加入课堂';
}
window.addEventListener('chem:classroom',updateClassCard);

function home(root) {
  const shell = root.querySelector('.studio-home');
  if (!shell) return;
  if (shell.querySelector('.cw-discover')) return;
  const progress = shell.querySelector('.home-progress');
  const masthead = shell.querySelector('.university-masthead');
  if (!masthead) return;
  shell.replaceChildren(masthead);
  masthead.querySelector('.university-course-label')?.remove();
  const teacherLink = document.createElement('a');
  teacherLink.className = 'cw-teacher-entry';
  teacherLink.href = 'teacher.html';
  teacherLink.textContent = '进入教师后台 ↗';
  masthead.append(teacherLink);
  search = '';
  shell.insertAdjacentHTML('beforeend',`<div class="cw-discover cw-home">
    <header class="cw-hero cw-lab-hero">
      <div class="cw-hero-copy"><h1>高中化学<br>3D 考点工作台</h1>
        <p>从酸碱中和滴定开始。看清装置，亲手读数，再用自己的数据算一次浓度。</p>
        <div class="cw-actions">${button('开始手动滴定','data-cw-action="titrate"',true)}
        ${button('打开高中化学课本','data-cw-action="book"')}</div>
      </div>
      <button class="cw-hero-visual" type="button" data-cw-open="exp" data-cw-id="tit" aria-label="查看酸碱中和滴定装置">
        ${picture('exp','tit','铁架台上的滴定管和下方的锥形瓶',true)}
        <span class="cw-hero-caption"><strong>酸碱中和滴定装置</strong><small>查看部件 ↗</small></span>
      </button>
    </header>
    <section class="cw-class-card" id="cwClassCard" aria-label="我的课堂">
      <div class="cw-class-icon" aria-hidden="true"></div><div><h2>我的课堂</h2><p></p></div>
      <button type="button" class="cw-secondary" data-cloud="open">加入课堂</button>
    </section>
    <section class="cw-study-row" aria-label="学习入口">
      <div><h2>AI 授课</h2><p>看微课，跟着步骤学一类题。</p>${button('去学习','data-study-enter="lesson"')}</div>
      <div><h2>AI 解题</h2><p>贴上题目，检查自己卡住的那一步。</p>${button('贴一道题','data-cw-action="paste"')}</div>
      <div>${searchForm()}</div>
    </section>
    <section aria-label="找考点"><div class="cw-head-row"><h2>从一个考点开始</h2>
      ${button('查解题步骤','data-cw-action="library"')}</div>
      <div class="cw-grid">${topics.map(lessonCard).join('')}</div></section>
    <section aria-label="虚拟实验室"><div class="cw-head-row"><h2>虚拟实验室</h2><div class="cw-actions">${button('3D 化学课本目录','data-cw-action="book"',true)}${button('翻开《电解水》','data-cw-lesson="water"')}${button('进入自由实验台','data-cw-action="free-lab"')}</div></div><div class="cw-grid">${Object.keys(items).map(resourceCard).join('')}</div></section>
    <div class="cw-home-links">
      ${button('高考真题空间实战','data-exam-model="styrene"')}
      <a class="cw-secondary" href="papers.html" style="text-decoration:none">做一整套真题</a>
      ${button('同步练习','data-lab="practice"')}
      ${button('化学小游戏','data-lab="games"')}
      ${button('错题本','data-teach="mistakes"')}
      ${button('教师备课','data-teach="lessons"')}
    </div></div>`);
  if (progress) shell.append(progress);
  updateClassCard();
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
    <div class="cw-lab-entry"><div><strong>3D 化学课本</strong><p>左页讲义，右页实验。从电解水开始试讲。</p></div>${button('打开课本','data-cw-action="book"',true)}</div>
    <div class="cw-lab-entry"><div><strong>自由实验台</strong><p>选择试剂和用量，在两个容器里比较变色和沉淀。</p></div>${button('进入自由实验台','data-cw-action="free-lab"',true)}</div>
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

function openFreeLab() {
  mount('自由实验台','<div id="cwFreeLab"><h1>自由实验台</h1><p role="status">正在准备实验器材…</p></div>','h1');
  const host = $('cwFreeLab');
  import('./color-lab.js?v=3').then(() => {
    if (!host.isConnected) return;
    host.replaceChildren(document.createElement('chem-color-lab'));
    const title = host.querySelector('h1');
    title.tabIndex = -1;
    title.focus({preventScroll:true});
  }).catch(() => {
    if (!host.isConnected) return;
    host.innerHTML='<h1>自由实验台</h1><p role="status">实验器材加载失败。</p>' +
      button('重新打开','data-cw-action="free-lab"') + button('返回虚拟实验室','data-cw-kind="exp"');
  });
}

function bookHref({book='pep', volume='', section='', resource='', bookQuery=''} = {}) {
  const url = new URL(location.href);
  url.searchParams.delete('lab');
  for (const [key,value] of Object.entries({book,volume,section,resource,bookQuery})) {
    if (value) url.searchParams.set(key,value);
    else url.searchParams.delete(key);
  }
  return url.pathname + url.search + url.hash;
}
const electrolysisHref = () => bookHref({volume:'selective-1',section:'electrolysis'});

function bookResource(key) {
  const [type,id] = key.split(':');
  let name, kindLabel;
  if (type === 'lab') {
    const item = items.exp.find(row => row.id === id);
    name = id === 'water' ? '电解水' : item?.name;
    kindLabel = item?.sim === 'static' ? '3D 观察' : '虚拟操作';
  } else if (type === 'model') {
    name = window.DB.mols.find(row => row.id === id)?.name;
    kindLabel = '3D 模型';
  } else if (type === 'practice') {
    name = window.CHEM_PRACTICE_DEFAULT?.questions.find(row => row.id === id)?.title;
    kindLabel = '原创练习';
  } else if (type === 'study') {
    const lessons = window.ChemStudyContent?.topics;
    name = lessons && Object.hasOwn(lessons,id) ? lessons[id].name : '';
    kindLabel = '微课';
  } else if (type === 'topic') {
    name = topicForId(id)?.name;
    kindLabel = '考点训练';
  } else if (type === 'tool' && id === 'periodic') {
    name = '元素周期表';
    kindLabel = '查阅工具';
  } else if (type === 'sop') {
    name = window.ChemPreparedSop?.byId.get(id)?.title;
    kindLabel = '解题 SOP';
  }
  return name ? {key,type,id,name,kindLabel} : null;
}

function resourceHref(book, section, resource) {
  const context = {volume:book.id, section:section.id};
  if (resource.type !== 'lab') return bookHref({...context,book:'resource',resource:resource.key});
  return resource.id === 'water' ? electrolysisHref() :
    bookHref({...context,book:'experiment',resource:resource.id});
}

function mountBookCatalog(route) {
  mount('3D 化学课本','<div id="cwBook" class="ct-book"><h1>高中化学课本</h1><p role="status">正在打开课本目录…</p></div>','h1');
  const host = $('cwBook');
  textbookModule ??= import('./chem-textbook.js?v=11');
  textbookModule.then(({mountTextbook}) => {
    if (!host.isConnected) return;
    mountTextbook(host,route,{
      href:bookHref, resource:bookResource, resourceHref,
      onQuery:value=>history.replaceState(history.state,'',bookHref({bookQuery:value})),
      experiments:()=>items.exp.map(item=>button(escape(item.name)+' · '+(item.sim==='static'?'3D 观察':'虚拟操作'),
        'data-cw-lesson="'+escape(item.id)+'"')).join('')
    });
  }).catch(()=>{
    textbookModule = null;
    if (!host.isConnected) return;
    host.innerHTML = '<h1>高中化学课本</h1><p role="status">目录加载失败。</p>' +
      button('重新打开课本','data-cw-action="book"');
  });
}

function openAttachedResource(resource, context) {
  resourceReturn = bookHref(context);
  openingBookResource = true;
  try {
    if (resource.type === 'model') openScene('mol',resource.id);
    if (resource.type === 'lab') {
      if (resource.id === 'tit') window.ChemTitration.enter();
      else openScene('exp',resource.id);
    }
    if (resource.type === 'topic') openTopic(resource.id);
    if (resource.type === 'study') window.ChemStudentStudy.openLesson(resource.id);
    if (resource.type === 'tool') {
      window.UI.view='textbook-tool';
      window.UI.sel=null;
      window.enterPT();
      window.dispatchEvent(new CustomEvent('chem:context'));
    }
    if (resource.type === 'practice' && !window.ChemPractice.openAssigned(resource.id)) {
      const item = window.CHEM_PRACTICE_DEFAULT.questions.find(row=>row.id===resource.id);
      window.ChemStudentStudy.openQuestion(item,'',{analyze:true});
    }
    if (resource.type === 'sop') window.ChemStudentStudy.openLibrary(resource.id);
  } finally {
    openingBookResource = false;
  }

  if (resource.type === 'model' || resource.type === 'lab') return;
  const link = document.createElement('a');
  link.id = 'ct-resource-back';
  link.className = 'ct-resource-back';
  link.dataset.ctRoute = '';
  link.href = resourceReturn;
  link.textContent = '← 返回本节课本';
  (resource.type === 'tool' ? $('viewPT') : $('viewDoc')).prepend(link);
}

function renderBookAddress() {
  const query = new URLSearchParams(location.search);
  const book = query.get('book');
  const context = {volume:query.get('volume') || '',section:query.get('section') || ''};
  const resource = query.get('resource') || '';
  $('ct-resource-back')?.remove();
  resourceReturn = '';
  if (book === 'water') return openBookLesson('water',context);
  if (book === 'experiment' && items.exp.some(item=>item.id===resource)) return openBookLesson(resource,context);
  if (book === 'resource') {
    const item = bookResource(resource);
    if (item && item.id !== 'water') return openAttachedResource(item,context);
  }
  if (book) return mountBookCatalog({...context,bookQuery:query.get('bookQuery') || ''});
}

function navigateBook(href) {
  const previous = location.pathname + location.search + location.hash;
  if (previous !== href) history.pushState(history.state,'',href);
  renderBookAddress();
}

function openBookLesson(id,context = {}) {
  const label = context.section ? '← 返回本节课本' : '← 返回课本目录';
  const back = '<a class="ct-secondary cb-return" data-ct-route href="'+escape(bookHref(context))+'">'+label+'</a>';
  if(id==='water'){
    mount('电解水','<div id="cwBook">'+back+'<div id="cwWaterLesson"><h1>电解水</h1><p role="status">正在打开课本…</p></div></div>','h1');
    const host=$('cwWaterLesson');
    import('./chem-book.js?v=4').then(()=>{
      if(!host.isConnected)return;
      host.replaceChildren(document.createElement('chemistry-book'));
      const heading=host.querySelector('h1');
      heading.tabIndex=-1;heading.focus({preventScroll:true});
    }).catch(()=>{
      if(host.isConnected)host.textContent='课本加载失败。请刷新网页重试。';
    });
    return;
  }
  const exp=items.exp.find(item=>item.id===id);
  if(!exp)return;
  const isStatic=exp.sim==='static';
  const launch=id==='tit'?'data-cw-action="titrate"':'data-cw-open="exp" data-cw-id="'+escape(id)+'"';
  const launchLabel = isStatic ? '打开 3D 装置' : '进入虚拟操作';
  const launchControl = context.section
    ? '<a class="ct-secondary" data-ct-route href="'+escape(bookHref({...context,book:'resource',resource:'lab:'+id}))+'">'+launchLabel+'</a>'
    : button(launchLabel,launch,true);
  mount(exp.name,'<div id="cwBook">'+back+
    '<div class="cb-reference"><header class="cb-header"><div><span class="cb-subtitle">'+escape(exp.subName)+
    '</span><h1>'+escape(exp.name)+'</h1></div></header>'+
    '<div class="cb-spread"><article class="cb-left" aria-label="左页讲义"><h2>课堂讲义</h2><dl class="cb-notes" id="cwBookNotes"></dl></article>'+
    '<section class="cb-right" aria-label="右页实验">'+picture('exp',exp.id,exp.name+'三维装置',true)+
    '<p class="cb-state">'+(isStatic?'装置可旋转，课堂上可结合左页讨论。':'打开装置后，用场景中的控制完成虚拟操作。')+'</p>'+
    launchControl+'</section></div></div></div>','h1');
  const host=$('cwBookNotes');
  import('./chem-book-model.js').then(({experimentNotes})=>{
    if(!host.isConnected)return;
    const notes=experimentNotes[id];
    if(notes)host.innerHTML=['情境','要点','结论','易错'].map((label,i)=>
      '<div><dt>'+label+'</dt><dd>'+escape(notes[i])+'</dd></div>').join('');
  }).catch(()=>{if(host.isConnected)host.textContent='讲义加载失败。请刷新网页重试。';});
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
  const route = event.target.closest('[data-ct-route]');
  if (route && !event.defaultPrevented && event.button === 0 &&
      !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    const href = route.pathname + route.search + route.hash;
    if (!reduced.matches && route.classList.contains('ct-volume')) {
      if (route.classList.contains('ct-opening')) return;
      route.closest('.ct-shelf').querySelector('.ct-opening')?.classList.remove('ct-opening');
      route.classList.add('ct-opening');
      setTimeout(()=>{
        if (route.isConnected && route.classList.contains('ct-opening')) navigateBook(href);
      },440);
      return;
    }
    return navigateBook(href);
  }
  const control = event.target.closest('[data-cw-topic],[data-cw-kind],[data-cw-open],[data-cw-action],[data-cw-answer],[data-cw-page],[data-cw-sop],[data-cw-lesson]');
  if (!control) return;
  const {cwTopic,cwKind,cwOpen,cwId,cwAction,cwAnswer,cwPage,cwSop} = control.dataset;
  if (control.dataset.cwLesson) {
    const id = control.dataset.cwLesson;
    return navigateBook(id==='water' ? electrolysisHref() : bookHref({book:'experiment',resource:id}));
  }
  if (cwTopic) return openTopic(cwTopic);
  if (cwKind) return openResources(cwKind);
  if (cwOpen) return openScene(cwOpen,cwId);
  if (cwPage) { page += Number(cwPage); drawResources(); return; }
  if (cwSop) return window.ChemStudentStudy.openLibrary(cwSop);
  if (cwAction === 'home') return window.showHome();
  if (cwAction === 'book') return navigateBook(bookHref());
  if (cwAction === 'free-lab') return openFreeLab();
  if (cwAction === 'paste') return window.ChemStudentStudy.openOwnQuestion();
  if (cwAction === 'titrate') {
    window.ChemGames?.stop();
    return window.ChemTitration.enter();
  }
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
      '<div class="nav-group"><button type="button" class="nav-cat new-nav" data-cw-action="book"><span class="ni" aria-hidden="true">▤</span><span>3D 化学课本</span></button></div>' +
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
if (new URLSearchParams(location.search).has('book')) renderBookAddress();
else if (new URLSearchParams(location.search).get('lab') === 'colors') openFreeLab();
window.addEventListener('popstate',()=>{
  if (new URLSearchParams(location.search).has('book')) renderBookAddress();
  else if ($('cwBook') || resourceReturn) {
    resourceReturn = '';
    $('ct-resource-back')?.remove();
    window.showHome();
  }
});
})();
