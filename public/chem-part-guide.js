(function () {
'use strict';

// Keys match the parts in the apparatus model, so the drawing and the guide stay in sync.
const guides = {
  'exp:tit': {
    '滴定管刻度':'零刻度在上方。平视液面，末读数减去初读数就是这次放出的体积。',
    '碱式滴定管':'本次标准液是氢氧化钠。靠近终点时，用下方的滴加按钮控制每次加入的量。',
    '锥形瓶':'瓶中是盐酸和指示剂。观察整瓶溶液的颜色，再决定是否停止滴加。',
    '铁架台与滴定管夹':'管夹固定滴定管，使管身保持竖直，方便平视刻度。'
  },
  'app:buret': {
    '刻度管':'酸式滴定管的零刻度在上方，刻度值向下增大。',
    '活塞':'旋转玻璃活塞可以调节液体流出的速度。',
    '尖嘴':'检查尖嘴是否充满液体。若开始时有气泡，读数差可能大于实际进入锥形瓶的体积。'
  },
  'app:vflask': {
    '梨形瓶体':'容量瓶用来配制固定体积的溶液。瓶颈细，液面的微小变化也容易看见。',
    '标线环':'把容量瓶放平，视线与标线齐平。',
    '定容液面':'配制无色水溶液时，凹液面的最低处应与标线相切。'
  },
  'app:pipette': {
    '胖肚管体':'中部膨大的管体用来容纳液体，细管便于调节液面。',
    '环状标线':'平视标线，让无色水溶液的凹液面最低处与标线相切。',
    '溶液':'这是一支单标线移液管，按器具规定的方式放液，移取标示体积。'
  },
  'app:cyl': {
    '底座':'把量筒平放在水平桌面上再读数。',
    '刻度':'先看相邻刻线相差多少毫升，再读液面的位置。',
    '液体':'对于水这类形成凹液面的液体，平视弯月面的最低处。'
  }
};
let notes = null;
let selected = '';
let sceneId = '';
let gesture = null;
const canvas = document.getElementById('cv');

function choose(name) {
  if (!notes || !Object.hasOwn(notes,name)) return;
  selected = name;
  const guide = document.getElementById('cwPartGuide');
  if (!guide) return;
  for (const control of guide.querySelectorAll('[data-part]')) {
    control.setAttribute('aria-pressed',String(control.dataset.part === selected));
  }
  guide.querySelector('.cw-part-note').textContent = notes[name];
  window.needsDraw();
}

function mount(inspector,kind,id,model) {
  const key = kind + ':' + id;
  const previous = sceneId === key ? selected : '';
  sceneId = key;
  notes = guides[key];
  selected = '';
  if (!notes || !model?.parts) return;
  const names = Object.keys(notes).filter(name => model.parts.some(part => part.name === name));
  if (!names.length) return;
  const guide = document.createElement('section');
  guide.id = 'cwPartGuide';
  guide.className = 'cw-part-guide';
  guide.setAttribute('aria-labelledby','cwPartTitle');
  guide.innerHTML = '<h3 id="cwPartTitle">认识装置部件</h3><p>选择部件，查看它的位置和用途。</p>' +
    '<div class="cw-part-options"></div><p class="cw-part-note" role="status"></p>';
  const options = guide.querySelector('.cw-part-options');
  for (const name of names) {
    const control = document.createElement('button');
    control.type = 'button';
    control.dataset.part = name;
    control.textContent = name;
    control.addEventListener('click',() => choose(name));
    options.append(control);
  }
  inspector.querySelector('.insp-body').prepend(guide);
  choose(names.includes(previous) ? previous : names[0]);
}

function drawPointer(ctx,model,offsets) {
  const index = model.parts.findIndex(part => part.name === selected && !part.hide);
  const center = model.parts[index]?.cen;
  if (!center) return;
  const offset = offsets[index];
  const [x,y,depth] = window.E3.proj(center[0]+offset[0],center[1]+offset[1],center[2]+offset[2]);
  if (depth <= 0) return;
  ctx.save();
  ctx.font = '600 13px system-ui';
  const width = ctx.measureText(selected).width + 16;
  const left = x+width+18 > ctx.canvas.clientWidth;
  const edge = x+(left ? -18 : 18);
  const box = left ? edge-width : edge;
  ctx.fillStyle = '#18323b';
  ctx.strokeStyle = '#ffe19c';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(edge,y); ctx.stroke();
  ctx.fillRect(box,y-12,width,24);
  ctx.strokeRect(box,y-12,width,24);
  ctx.fillStyle = '#fff5d5';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(selected,box+width/2,y);
  ctx.restore();
}

// A click selects a part. Dragging, pinching or tapping the experiment controls keeps its own meaning.
canvas.addEventListener('pointerdown',event => {
  if (!notes || !event.isPrimary || event.button !== 0) { gesture = null; return; }
  gesture = {id:event.pointerId,x:event.clientX,y:event.clientY};
});
canvas.addEventListener('pointermove',event => {
  if (gesture?.id === event.pointerId && Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y) > 5) gesture = null;
});
canvas.addEventListener('pointercancel',() => { gesture = null; });
canvas.addEventListener('pointerup',event => {
  const start = gesture;
  gesture = null;
  if (!notes || start?.id !== event.pointerId || Math.hypot(event.clientX-start.x,event.clientY-start.y) > 5) return;
  const part = window.ChemSpatial?.pickPart(event.clientX,event.clientY,notes);
  if (part) {
    choose(part);
    const toggle = document.getElementById('inspToggle');
    if (toggle.getClientRects().length && !document.getElementById('inspector').classList.contains('show')) toggle.click();
  }
});
window.addEventListener('chem:context',() => {
  const {view,sel} = window.UI;
  if (view !== 'stage' || sceneId !== sel?.kind + ':' + sel?.id) {
    notes = null; selected = sceneId = ''; gesture = null;
  }
});
window.ChemPartGuide = {mount,drawPointer,get selected() { return selected; }};
})();
