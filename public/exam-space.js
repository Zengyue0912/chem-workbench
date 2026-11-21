(function () {
'use strict';

const {models, geometry, tally, axisFns, weight} = window.ChemExamModels;
const $ = id => document.getElementById(id);
const escape = text => String(text).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);
const groups = [['shape', '空间构型'], ['cell', '晶胞计算']];
const axes = ['X', 'Y', 'Z', '面上对角线'];
const positionNames = ['顶点', '棱心', '面心', '体内'];
const fractions = ['⅛', '¼', '½', '1'];
const colors = {'C':'#486173','H':'#b2c6ce','N':'#397ad2','O':'#d97865','Na⁺':'#a477c5','Cl⁻':'#4c9e79','Cs⁺':'#b99138'};
const reviewKey = 'chem_exam_space_v1';
let reviews = {};
try {
  const saved = JSON.parse(localStorage.getItem(reviewKey) || '{}');
  if (saved && typeof saved === 'object') {
    for (const model of models) {
      const attempt = saved[model.id];
      if (Number.isInteger(attempt?.choice) && model.choices[attempt.choice] && attempt.choice !== model.answer) {
        reviews[model.id] = {choice: attempt.choice, corrected: attempt.corrected === true};
      }
    }
  }
} catch {}

let entry = models[0], scene, state, clipTimer, clipPhase = 0;
const active = () => window.UI.view === 'exam-space';
const groupOf = model => model.sites ? 'cell' : 'shape';
const pending = () => Object.values(reviews).filter(x => !x.corrected).length;
const cubePoint = p => p.map(x => (x - .5) * 3);
const rangeValue = value => value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

function saveReview(choice) {
  if (choice !== entry.answer) reviews[entry.id] = {choice, corrected: false};
  else if (reviews[entry.id]) reviews[entry.id].corrected = true;
  let saved = true;
  try { localStorage.setItem(reviewKey, JSON.stringify(reviews)); }
  catch { saved = false; }
  const label = $('examReviewCount');
  if (label) label.textContent = pending();
  return saved;
}

class ExamScene extends window.ChemGames.Scene {
  project([x, y, z]) { return super.project([x, y + .6, z]); }

  drawBond([a, b, order, color]) {
    if (order === 0) { this.line(a, b, color, 1); return; }
    const start = this.project(a), end = this.project(b);
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    if (distance < 3) return;
    const ux = (end.x - start.x) / distance, uy = (end.y - start.y) / distance;
    const inset = Math.min(distance * .2, this.scale * .14);
    const offsets = order === 3 ? [-4, 0, 4] : order === 2 ? [-2.5, 2.5] : [0];
    const c = this.ctx;
    c.strokeStyle = color || '#9abcc5';
    c.lineWidth = order === 1 ? 3 : 2;
    c.beginPath();
    for (const offset of offsets) {
      c.moveTo(start.x + ux * inset - uy * offset, start.y + uy * inset + ux * offset);
      c.lineTo(end.x - ux * inset - uy * offset, end.y - uy * inset + ux * offset);
    }
    c.stroke();
  }

  draw() {
    if (!this.w || !this.h) return;
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#10252f';
    c.fillRect(0, 0, this.w, this.h);
    if (!this.frame) return;
    const {guide, bonds, points, lobes} = this.frame;
    if (guide?.length === 2) this.line(...guide, '#ffcf7d', 2);
    if (guide?.length === 4) {
      c.beginPath();
      guide.forEach((p, i) => {
        const {x, y} = this.project(p);
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      });
      c.closePath();
      c.fillStyle = 'rgba(89,219,188,.19)';
      c.strokeStyle = '#64d2b7';
      c.lineWidth = 1.5;
      c.fill();
      c.stroke();
    }
    const marks = [
      ...bonds.map(bond => ({bond, depth: this.project(bond[0]).z + this.project(bond[1]).z})),
      ...points.map(point => ({point, depth: 2 * this.project(point.p).z})),
      ...lobes.map(point => ({lobe: point, depth: 2 * this.project(point.p).z}))
    ].sort((a, b) => a.depth - b.depth);
    for (const {bond, point, lobe} of marks) {
      if (bond) this.drawBond(bond);
      else if (lobe) {
        const p = this.project(lobe.p);
        c.beginPath();
        c.ellipse(p.x, p.y, lobe.r * this.scale * p.k, lobe.r * this.scale * p.k, 0, 0, Math.PI * 2);
        c.fillStyle = lobe.color;
        c.fill();
      } else {
        const p = this.sphere(point);
        if (point.match) {
          c.beginPath();
          c.arc(p.x, p.y, point.r * this.scale * p.k + 3, 0, 2 * Math.PI);
          c.strokeStyle = '#ffcf7d';
          c.lineWidth = 2;
          c.stroke();
        }
      }
    }
  }
}

function sphere(a, p, match = false, small = false) {
  const element = a.element;
  return {
    p, match, r: small ? .145 : element === 'H' ? .20 : entry.sites ? .22 : .29,
    label: element, ink: '#172f40', color: match ? '#efb260' : colors[element]
  };
}

function shapeFrame() {
  const positions = geometry(entry, state.turn, state.tool);
  const points = positions.map(a => sphere(a, a.position, state.tool !== '' && a.match));
  const bonds = entry.model.bonds.map(([a, b, order = 1]) => [
    positions[a].position, positions[b].position, state.product && a === 0 && b === 1 ? 1 : order
  ]);
  let guide;
  if (state.tool === 'line') guide = [[-2.3, 0, 0], [2.3, 0, 0]];
  if (state.tool === 'plane') {
    const plane = entry.id === 'methane' ? ([x, y]) => [x, y * .7, y * .7] :
      entry.id === 'ammonia' ? ([x, y]) => [x, -.18, y] : ([x, y]) => [x, y, 0];
    const x = entry.id === 'styrene' ? 2.65 : 1.65;
    guide = [[-x,-1.42], [x,-1.42], [x,1.65], [-x,1.65]].map(plane);
  }
  const lobes = state.orbitals && !state.product ? [-1, 1].flatMap(sign => [-.55, 0, .55].map(x => ({
    p: [x, 0, sign * .61], r: x ? .35 : .26, color: sign > 0 ? '#5dbbd589' : '#c898ed89'
  }))) : [];
  return {guide, points, bonds, lobes, matched: positions.filter(a => a.match)};
}

function sliceCorners() {
  const t = state.cut;
  if (state.axis === 3) {
    const lo = Math.max(0, 2 * t - 1), hi = Math.min(1, 2 * t);
    return [[lo, hi, 0], [hi, lo, 0], [hi, lo, 1], [lo, hi, 1]];
  }
  return [[0,0], [1,0], [1,1], [0,1]].map(([a,b]) => {
    const p = [a,b];
    p.splice(state.axis, 0, t);
    return p;
  });
}

const corners = Array.from({length: 8}, (_, i) => [i & 1, (i >> 1) & 1, (i >> 2) & 1]);
const cubeEdges = corners.flatMap((p, i) => [1, 2, 4].filter(bit => (i & bit) === 0).map(bit => [
  cubePoint(p), cubePoint(corners[i | bit]), 0, '#7a9ba5'
]));
function cellFrame() {
  const axis = axisFns[state.axis];
  const visible = entry.sites.filter(a => !state.slicing || axis(a.position) <= state.cut + 1e-6);
  const matched = visible.filter(a => Math.abs(axis(a.position) - state.cut) < 1e-6);
  const points = [], bonds = [...cubeEdges];
  const center = [.5, .5, .5];
  const neighbors = state.neighbors ? visible.filter(a => {
    const distance = Math.hypot(...a.position.map((x, i) => x - center[i]));
    return Math.abs(distance - (entry.id === 'nacl' ? .5 : Math.sqrt(3) / 2)) < 1e-6;
  }) : [];
  bonds.push(...neighbors.map(site => [cubePoint(center), cubePoint(site.position), 1, '#edb56c']));
  for (const site of visible) {
    const p = cubePoint(site.position), match = neighbors.includes(site) || (state.slicing && matched.includes(site));
    if (site.direction) {
      const ends = [-1, 1].map(sign => p.map((x, i) => x + sign * .30 * site.direction[i]));
      points.push(sphere({element:'C'}, p, match, true), ...ends.map(end => sphere({element:'O'}, end, false, true)));
      bonds.push(...ends.map(end => [p, end, 2]));
    } else points.push(sphere(site, p, match));
  }
  if (entry.latticeBonds) {
    visible.forEach((a, i) => visible.slice(i + 1).forEach(b => {
      const d = Math.hypot(...a.position.map((v, j) => v - b.position[j]));
      if (Math.abs(d - Math.sqrt(3) / 4) < 1e-6) bonds.push([cubePoint(a.position), cubePoint(b.position), 1]);
    }));
  }
  return {guide: state.slicing ? sliceCorners().map(cubePoint) : null, points, bonds, lobes: [], visible, matched, neighbors};
}

function draw() {
  scene.frame = entry.sites ? cellFrame() : shapeFrame();
  scene.draw();
  if (entry.sites) {
    const {visible, matched, neighbors} = scene.frame;
    $('examModelReadout').textContent = state.neighbors ? '体心离子的最近邻有 ' + neighbors.length + ' 个异号离子 · 橙线表示近邻方向' : state.slicing ?
      '切片经过 ' + matched.length + ' 个位置 · 当前保留 ' + visible.length + ' 个位置' :
      '完整晶胞 · 共画出 ' + entry.sites.length + ' 个位置';
    $('examTally').innerHTML = tallyTable(entry.sites, '完整晶胞') +
      (state.slicing ? tallyTable(visible, '当前可见部分') : '');
  } else {
    const {matched} = scene.frame;
    $('examModelReadout').textContent = state.tool ? '基准' + (state.tool === 'line' ? '线' : '平面') + '上有 ' +
      matched.length + ' 个原子' + (entry.id === 'methane' ? '（其中 ' + matched.filter(a => a.element === 'H').length + ' 个 H）' : '') :
      '拖动模型换视角，或打开高亮查看基准。';
  }
}

function tallyTable(sites, label) {
  return '<p><b>' + label + '</b></p>' + Object.entries(tally(sites)).map(([element, counts]) => {
    const parts = counts.flatMap((n, i) => n ? [n + ' ' + positionNames[i] + ' × ' + fractions[i]] : []);
    const sum = sites.filter(a => a.element === element).reduce((n, a) => n + weight(a.position), 0);
    return '<p>' + element + '　' + parts.join(' + ') + ' = <b>' + sum + '</b></p>';
  }).join('');
}

function control(label, command, pressed = false) {
  return '<button type="button" class="btn-sub" data-exam-action="' + command + '" aria-pressed="' + pressed + '">' + label + '</button>';
}
function tools() {
  const neighbors = ['nacl', 'cscl'].includes(entry.id) ? control('高亮体心离子的近邻', 'neighbors', state.neighbors) : '';
  if (entry.sites) return `
    <div class="exam-controls">${control('晶胞解剖刀', 'slicing', state.slicing)}${neighbors}${control('复位视角', 'reset-view')}</div>
    <div class="exam-controls exam-slice" ${state.slicing ? '' : 'hidden'}>
      <label>切片方向 <select id="examAxis">${axes.map((axis, i) => `<option value="${i}" ${i === state.axis ? 'selected' : ''}>${axis}</option>`).join('')}</select></label>
      <label class="exam-range">切片位置 <output id="examRangeOutput">${rangeValue(state.cut)}</output><input id="examCut" type="range" min="0" max="1" step=".01" value="${state.cut}"></label>
    </div>
    <details id="examTallyPanel"><summary>看均摊过程</summary><div id="examTally"></div><small>均摊按完整晶胞原有位置计算。切片只改变可见范围，粒子的归属权重不会随切面改变。</small></details>`;
  const line = entry.model.line ? control('高亮共线原子', 'line', state.tool === 'line') : '';
  const orbitals = entry.id === 'ethylene' ? control('p 轨道侧向重叠', 'orbitals', state.orbitals) + control('加成后', 'product', state.product) : '';
  return `<div class="exam-controls">${control('高亮共面原子', 'plane', state.tool === 'plane')}${line}${orbitals}${control('复位视角', 'reset-view')}</div>
    ${entry.model.rotating ? `<label class="exam-range">转动 C—C 单键 <output id="examRangeOutput">${state.turn}°</output><input id="examTurn" type="range" min="0" max="180" step="1" value="${state.turn}"></label>` : ''}
    ${entry.id === 'ethylene' ? '<small>蓝色和紫色区分 p 轨道相位。「加成后」只示意原有 C—C 的键级变化，省略新生成的 C—H、C—O 键。</small>' : ''}`;
}

function syncTools() {
  const panel = $('examTallyPanel');
  const wasOpen = panel?.open;
  $('examTools').innerHTML = tools();
  if (wasOpen && $('examTallyPanel')) $('examTallyPanel').open = true;
  draw();
}

function disposeScene() {
  stopClip();
  scene?.stop();
  scene = null;
}

function mountCanvas() {
  const canvas = $('examCanvas');
  scene = new ExamScene(canvas);
  scene.zoom = entry.sites ? 1.26 : 1.32;
  scene.resize();
  const moveView = (x, y) => {
    scene.yaw += x;
    scene.pitch = Math.max(-1.5, Math.min(1.5, scene.pitch + y));
    scene.draw();
  };
  let drag;
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    canvas.focus();
    canvas.setPointerCapture(event.pointerId);
    drag = [event.clientX, event.clientY];
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag) return;
    moveView((event.clientX - drag[0]) * .012, (event.clientY - drag[1]) * .012);
    drag = [event.clientX, event.clientY];
  });
  canvas.addEventListener('lostpointercapture', () => { drag = null; });
  canvas.addEventListener('keydown', event => {
    const direction = {ArrowLeft:[-.13,0], ArrowRight:[.13,0], ArrowUp:[0,-.13], ArrowDown:[0,.13]}[event.key];
    if (!direction) return;
    event.preventDefault();
    moveView(...direction);
  });
  draw();
}

function showProblem(next, review = false) {
  disposeScene();
  entry = next;
  state = {turn: entry.model?.rotating ? 90 : 0, tool: '', orbitals: false, product: false, slicing: false, neighbors: false, cut: .5, axis: 0};
  const choice = review ? reviews[entry.id]?.choice : undefined;
  const tag = ['ethylene', 'ammonia'].includes(entry.id) ? '真题考点改编' : '原创同考点练习';
  $('docBody').innerHTML = `<section class="exam-page">
    <header class="exam-head"><div><span class="paper-label">高中化学 / 选考复习</span><h1>高考真题空间实战</h1><p>左边做题，右边动手验证。</p></div>
      <button class="btn-sub" type="button" data-exam-action="review-list">3D 错题本 <span id="examReviewCount">${pending()}</span></button>
    </header>
    <nav class="exam-catalog" aria-label="3D 考点模型">${groups.map(([group, label]) =>
      `<div><b>${label}</b>${models.filter(model => groupOf(model) === group).map(model =>
        `<button type="button" class="btn-sub" data-exam-model="${model.id}" aria-pressed="${model === entry}">${model.name}</button>`
      ).join('')}</div>`).join('')}</nav>
    <div class="exam-grid">
      <article class="exam-panel exam-question">
        <span class="paper-label">${tag}</span><h2>${entry.topic}</h2>
        <p class="exam-stem">${entry.stem}</p>
        <form id="examAnswer">
          <fieldset><legend>选一个答案</legend>${entry.choices.map((option, i) =>
            `<label class="exam-choice"><input type="radio" required name="examChoice" value="${i}" ${choice === i ? 'checked' : ''}><b>${'ABCD'[i]}</b>${escape(option)}</label>`
          ).join('')}</fieldset>
          <button class="btn-main" type="submit">提交答案</button>
        </form>
        <div id="examFeedback" aria-live="polite"></div>
        <details><summary>卡住了？看一个提示</summary><p>${entry.hint}</p></details>
        <p class="exam-source">关联考题 <a href="${entry.source[1]}" target="_blank" rel="noopener">${entry.source[0]} · 查看评析 ↗</a>
        ${entry.structure ? `<a href="${entry.structure}" target="_blank" rel="noopener">晶体结构来源 ↗</a>` : ''}</p>
      </article>
      <article class="exam-panel exam-view">
        <div class="exam-view-head"><h2>${entry.name} <span>${entry.formula}</span></h2><small>拖动或方向键旋转</small></div>
        <canvas id="examCanvas" tabindex="0" aria-label="${entry.name}三维模型，聚焦后可用方向键旋转"></canvas>
        <p id="examModelReadout" role="status"></p>
        <div id="examTools">${tools()}</div>
        <div id="examClipStatus" role="status"></div>
        <button class="btn-sub" type="button" data-exam-action="clip">${entry.sites ? '30 秒看懂晶胞' : '30 秒看懂这题'}</button>
      </article>
    </div>
    <dialog class="exam-dialog" id="examDialog" aria-labelledby="examDialogTitle"></dialog>
  </section>`;
  $('viewDoc').scrollTop = 0;
  $('examAnswer').addEventListener('submit', event => {
    event.preventDefault();
    const picked = new FormData(event.currentTarget).get('examChoice');
    if (picked !== null) feedback(Number(picked), true);
  });
  mountCanvas();
  if (choice !== undefined) feedback(choice, false);
}

function enter(id, review = false) {
  const next = models.find(model => model.id === id || model.object === id) || models[0];
  window.ChemGames.stop();
  window.UI.view = 'exam-space';
  window.UI.sel = null;
  $('viewDoc').classList.add('show');
  $('viewStage').classList.add('hide');
  $('viewPT').classList.add('hide');
  $('sidebar').classList.remove('show');
  $('mask').classList.remove('show');
  $('inspector').classList.remove('show');
  window.dispatchEvent(new CustomEvent('chem:context'));
  showProblem(next, review);
}

function feedback(choice, fresh) {
  const correct = choice === entry.answer;
  const saved = !fresh || saveReview(choice);
  const result = $('examFeedback');
  const detail = correct ? entry.rule : entry.errors[choice];
  result.innerHTML = `<div class="exam-result ${correct ? 'is-right' : 'is-wrong'}">
    <strong>${correct ? '答对了' : fresh ? '这题需要订正' : '上次答错的地方'}</strong>
    <p>${detail}</p>${correct ? '' : `<p>正确答案为 <b>${'ABCD'[entry.answer]}. ${entry.choices[entry.answer]}</b>。${saved ? '' : '浏览器未能保存错题。'}</p>
    <button type="button" class="btn-sub" data-exam-card="${choice}">生成 3D 错题解析卡</button>`}
  </div>`;
  if (fresh && !correct) {
    const box = $('examDialog');
    box.innerHTML = `<div class="exam-dialog-head"><h2 id="examDialogTitle">这题卡在哪里？</h2><form method="dialog"><button class="btn-sub">关闭</button></form></div>
      <p>${detail}</p><p>${entry.rule}</p><button type="button" class="btn-main" data-exam-card="${choice}">生成 3D 错题解析卡</button>`;
    box.showModal();
  }
}

function reviewList() {
  const box = $('examDialog');
  const buttons = models.filter(model => reviews[model.id]).map(model =>
    `<button class="btn-sub" type="button" data-exam-review="${model.id}">${model.name} · ${reviews[model.id].corrected ? '已订正' : '待订正'}</button>`
  ).join('');
  box.innerHTML = `<div class="exam-dialog-head"><h2 id="examDialogTitle">3D 错题本</h2><form method="dialog"><button class="btn-sub">关闭</button></form></div>
    <p>${buttons ? '点开错题看错因，或选新答案重做。' : '答错的空间实战题会收在这里。'}</p><div class="exam-controls">${buttons}</div><small>记录保存在当前浏览器。</small>`;
  box.showModal();
}

function cardLines(ctx, text, width) {
  const rows = [];
  let line = '';
  for (const char of text) {
    if (line && ctx.measureText(line + char).width > width) {
      rows.push(line);
      line = '';
    }
    line += char;
  }
  if (line) rows.push(line);
  return rows;
}

function card(choice) {
  const box = $('examDialog');
  const canvas = document.createElement('canvas');
  canvas.width = 920;
  const c = canvas.getContext('2d');
  const font = '26px "Microsoft YaHei", system-ui';
  c.font = font;
  const rows = [
    ['题目', entry.stem],
    ['作答', '我的答案 ' + entry.choices[choice] + '　正确答案 ' + entry.choices[entry.answer]],
    ['错因', entry.errors[choice]],
    ['考点公式 / 解题规则', entry.rule],
    ['关联考题', (['ethylene', 'ammonia'].includes(entry.id) ? '真题考点改编 · ' : '原创同考点练习 · ') + entry.source[0]]
  ].map(([label, content]) => [label, cardLines(c, content, 800)]);
  canvas.height = 480 + rows.reduce((height, [, lines]) => height + 54 + lines.length * 38, 0);
  c.fillStyle = '#f7faf8';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#143e36';
  c.fillRect(0, 0, canvas.width, 134);
  c.fillStyle = '#fff';
  c.font = 'bold 39px "Microsoft YaHei", system-ui';
  c.fillText('3D 错题解析卡', 60, 67);
  c.font = font;
  c.fillText(entry.name + '　' + entry.formula + '　/　' + entry.topic, 60, 109);
  const savedFrame = scene.frame;
  const savedState = {...state};
  if (entry.sites) state.slicing = false;
  else {
    state.turn = 0;
    state.tool = entry.model.line ? 'line' : 'plane';
    state.product = false;
    state.orbitals = entry.id === 'ethylene';
  }
  scene.frame = entry.sites ? cellFrame() : shapeFrame();
  scene.draw();
  const modelCanvas = $('examCanvas');
  const h = 294, w = Math.min(800, h * modelCanvas.width / modelCanvas.height);
  c.fillStyle = '#10252f';
  c.fillRect(60, 152, 800, h);
  c.drawImage(modelCanvas, (920 - w) / 2, 152, w, h);
  state = savedState;
  scene.frame = savedFrame;
  scene.draw();
  let y = 485;
  for (const [label, lines] of rows) {
    c.fillStyle = '#166351';
    c.font = 'bold ' + font;
    c.fillText(label, 60, y);
    y += 38;
    c.fillStyle = '#203733';
    c.font = font;
    for (const line of lines) {
      c.fillText(line, 60, y);
      y += 38;
    }
    y += 16;
  }
  box.innerHTML = '<div class="exam-dialog-head"><h2 id="examDialogTitle">3D 错题解析卡</h2><form method="dialog"><button class="btn-sub">关闭</button></form></div>';
  const download = document.createElement('a');
  download.className = 'btn-main';
  download.download = entry.name + '·3D错题解析卡.png';
  download.href = canvas.toDataURL('image/png');
  download.textContent = '下载解析卡 PNG';
  const preview = new Image();
  preview.src = download.href;
  preview.alt = entry.name + '错题解析卡，包含题目、模型图、错因和解题规则';
  box.append(download, preview);
  if (!box.open) box.showModal();
  box.scrollTop = 0;
  download.focus();
}

function stopClip() {
  clearTimeout(clipTimer);
  clipTimer = undefined;
}

function playClip(button) {
  const note = $('examClipStatus');
  if (clipTimer) {
    stopClip();
    button.textContent = '重播 30 秒讲解';
    note.textContent = '已停止，可从头重播。';
    return;
  }
  clipPhase = 0;
  button.textContent = '停止讲解';
  function step() {
    if (!active() || !button.isConnected) { stopClip(); return; }
    const index = clipPhase++;
    if (index === 3) {
      stopClip();
      button.textContent = '重播 30 秒讲解';
      return;
    }
    if (entry.sites) {
      state.slicing = index < 2;
      state.neighbors = false;
      state.axis = 0;
      state.cut = index === 0 ? 0 : .5;
    } else {
      state.tool = entry.model.line ? 'line' : 'plane';
      state.turn = index === 0 ? 90 : 0;
      state.orbitals = entry.id === 'ethylene';
      state.product = entry.id === 'ethylene' && index === 2;
    }
    scene.yaw = index === 1 ? .86 : .35;
    scene.pitch = index === 1 ? -.20 : .30;
    syncTools();
    if (index === 2 && $('examTallyPanel')) $('examTallyPanel').open = true;
    note.textContent = (index + 1) + ' / 3　' + [
      entry.sites ? '先看靠近晶胞边界的粒子。' : entry.hint,
      entry.sites ? '把切面推到中央，比较边界与体内的位置。' : '换个角度看，留意哪些原子仍在基准上。',
      entry.rule
    ][index];
    clipTimer = setTimeout(step, 10000);
  }
  step();
}

document.addEventListener('input', event => {
  if (!active() || !['examCut', 'examTurn', 'examAxis'].includes(event.target.id)) return;
  const field = event.target, value = Number(field.value);
  if (field.id === 'examTurn') {
    state.turn = value;
    state.tool = 'plane';
    $('examTools').querySelector('[data-exam-action="plane"]').setAttribute('aria-pressed', 'true');
    $('examRangeOutput').textContent = value + '°';
  }
  if (field.id === 'examCut') {
    state.cut = value;
    $('examRangeOutput').textContent = rangeValue(value);
  }
  if (field.id === 'examAxis') state.axis = value;
  draw();
});

document.addEventListener('click', event => {
  const button = event.target.closest('[data-exam-model],[data-exam-action],[data-exam-review],[data-exam-card]');
  if (!button) return;
  const {examModel, examAction, examReview, examCard} = button.dataset;
  if (examModel) {
    enter(examModel);
    if (button.hasAttribute('data-exam-open-review')) reviewList();
    return;
  }
  if (examReview) { showProblem(models.find(model => model.id === examReview), true); return; }
  if (!active()) return;
  if (examCard !== undefined) { card(Number(examCard)); return; }
  if (examAction === 'review-list') { reviewList(); return; }
  if (examAction === 'clip') { playClip(button); return; }
  if (examAction === 'reset-view') {
    scene.yaw = .35;
    scene.pitch = .30;
    scene.draw();
    return;
  }
  if (examAction === 'plane' || examAction === 'line') state.tool = state.tool === examAction ? '' : examAction;
  else {
    state[examAction] = !state[examAction];
    if (examAction === 'slicing' && state.slicing) state.neighbors = false;
    if (examAction === 'neighbors' && state.neighbors) state.slicing = false;
  }
  syncTools();
  $('examTools').querySelector('[data-exam-action="' + examAction + '"]')?.focus();
});

window.addEventListener('chem:context', () => { if (!active()) disposeScene(); });
window.ChemExamSpace = {linked: id => models.some(model => model.object === id), enter};
})();
