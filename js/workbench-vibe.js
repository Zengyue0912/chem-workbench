/* ============================================================================
 * 高中化学 3D 考点工作台 — 考点分步动画演示 + “3 分钟讲透一个考点”
 * （工作流 4 · A 组追加：参考抖音“Vibe 知识”做法）
 *
 * 内容：
 *   1. 首页“3 分钟讲透一个考点”卡片区（桌面横向卡片；移动端竖屏
 *      scroll-snap 卡片流），点击进入对应考点动画。
 *   2. 三个分步短动画（VSEPR 排斥过程 / 滴定曲线绘制 / 电子云形成）：
 *      播放·暂停·进度拖动·分步解说，叙事按“背景 → 可视化推导 →
 *      联系日常生活”。VSEPR 复用现有 E3 引擎与 B.molecule 真实分子
 *      模型；滴定曲线直接调用 window.ChemTitration.ph(v)（与练习模块
 *      同款 25°C 理想强酸强碱模型）；电子云复用周期表原子视图的
 *      “按电子层权重撒点”画法。无新依赖。
 *   3. SOP 解题步骤逐步动画呈现：给现有 .method-steps / .study-sop-detail
 *      加逐个高亮出现的效果（只包装渲染，不改原 SOP 文件）。
 *
 * 文案来源：全部取自现有考点数据（见每条 steps 下方的来源注释），不编造。
 * 不修改任何原有文件：只读取 window.E3 / window.B / window.DB /
 * window.ChemLazy / window.ChemTitration 等公开命名空间，并监听 DOM 变化。
 * ========================================================================== */
(function () {
'use strict';

/* ================= 工具 ================= */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const easeIO = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reducedMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const TAU = Math.PI * 2;
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function theme() {
  const dark = document.body.dataset.theme === 'dark';
  return dark
    ? { ink: '#d7ece6', dim: '#7ca39b', grid: 'rgba(45,212,191,.14)', line: '#2dd4bf',
        accent: '#5eead4', accentSoft: 'rgba(94,234,212,.16)', card: '#132521', danger: '#f87171',
        cloud: 'rgba(94,234,212,.55)', cloudHot: 'rgba(251,191,36,.85)', band: 'rgba(244,114,182,.16)' }
    : { ink: '#134e4a', dim: '#5b8a85', grid: 'rgba(14,107,87,.12)', line: '#0e6b57',
        accent: '#0e6b57', accentSoft: 'rgba(20,184,166,.14)', card: '#ffffff', danger: '#dc2626',
        cloud: 'rgba(13,148,136,.5)', cloudHot: 'rgba(217,119,6,.85)', band: 'rgba(236,72,153,.13)' };
}

/* ================= 内容：三个考点（文案均取自现有数据，来源见注释） ================= */
/* VSEPR 四选项表：student-vsepr-study.js particles + arrangements（SO₂/CO₂/BF₃/OF₂） */
const VSEPR_OPTIONS = [
  { f: 'SO₂', bonded: 2, lone: 1, domains: 3, arrange: '平面三角形', shape: 'V 形' },
  { f: 'CO₂', bonded: 2, lone: 0, domains: 2, arrange: '直线形', shape: '直线形' },
  { f: 'BF₃', bonded: 3, lone: 0, domains: 3, arrange: '平面三角形', shape: '平面三角形' },
  { f: 'OF₂', bonded: 2, lone: 2, domains: 4, arrange: '正四面体形', shape: 'V 形' }
];

const TOPICS = [
  {
    id: 'vsepr', tag: '空间构型', art: 'vsepr',
    title: 'VSEPR：电子域互相排斥',
    blurb: '同样是 V 形，电子域排布一样吗？',
    steps: [
      /* chem-spatial.js topics.shape：title + detail */
      { t: '同样是 V 形，电子域排布一样吗？', dur: 16, scene: 'vsepr-compare',
        txt: '转动模型辨认原子位置，再数中心原子的成键域和孤电子域。SO₂ 与 H₂O 都是 V 形，但电子域数不同。' },
      /* student-sop-structure-data.js S04：标题 + 步骤 + 注意 */
      { t: '数电子域判 VSEPR 模型', dur: 20, scene: 'vsepr-count',
        txt: '每个相邻原子方向记一个成键域，另加中心孤电子对 → 总域数。双键、三键不是额外的成键方向。' },
      /* student-vsepr-study.js makePlan 第 3 步提示 */
      { t: '排斥推开电子域', dur: 18, scene: 'vsepr-repel',
        txt: '2 个电子域对应直线形，3 个对应平面三角形，4 个对应正四面体形。电子域互相排斥，排布随之展开。' },
      /* student-sop-structure-data.js S05 + student-vsepr-study.js 第 1 步提示 */
      { t: '由成键和孤对确定分子空间构型', dur: 20, scene: 'vsepr-shape',
        txt: '确定 VSEPR 理想排布，并标出孤对占据位置；以实际原子位置给出形状。中心原子上的每一对孤电子各占一个电子域。描述空间构型时，只看原子所在的位置。' },
      /* chem-spatial.js topics.shape.question + student-vsepr-study.js reference */
      { t: '回到真题：哪个粒子同时满足两个条件？', dur: 20, scene: 'vsepr-quiz',
        txt: '下列粒子的 VSEPR 模型为平面三角形且其空间结构为 V 形的是：SO₂、CO₂、BF₃、OF₂。SO₂：2 个成键方向、1 对孤电子，共 3 个电子域；VSEPR 模型为平面三角形，空间构型为 V 形。' }
    ]
  },
  {
    id: 'titration', tag: '定量实验', art: 'titration',
    title: '滴定曲线：半滴之差',
    blurb: '当滴入最后半滴，溶液变为浅红色且半分钟内不褪色。',
    steps: [
      /* inline-04-db-exps.js tit.principle + inline-09-studio.js TP.snapshot().model */
      { t: '酸碱中和滴定', dur: 18, scene: 'tit-axes',
        txt: '酸碱恰好完全反应时，H⁺ 与 OH⁻ 的物质的量相等：c(酸)·V(酸) = c(碱)·V(碱）。用已知浓度的标准液滴定待测液，借指示剂颜色突变判断终点，即可算出未知浓度。25°C 理想强酸强碱：HCl / NaOH，Kw=1e-14。' },
      /* inline-04-db-exps.js tit.steps[3] + phenomena[0] */
      { t: '滴定操作：先快后慢', dur: 18, scene: 'tit-rise',
        txt: '左手控制活塞，右手旋摇锥形瓶，眼睛注视瓶内颜色变化；先快后慢，逐滴滴加。滴入碱液处局部出现红色旋即扩散消失（酸过量时）。' },
      /* inline-04-db-exps.js tit.steps[4] + student-sop-practice-data.js 03 */
      { t: '判断终点：半滴之差', dur: 18, scene: 'tit-jump',
        txt: '当滴入最后半滴，溶液变为浅红色且半分钟内不褪色，即为终点。找当量点附近快速变 pH 的区段 → 选择范围。' },
      /* inline-09-studio.js TP.configure() 说明 + ai-config.js 滴定答案 + practice 03 注意 */
      { t: '按酸碱滴定曲线选指示剂', dur: 16, scene: 'tit-band',
        txt: '酚酞约在 pH 8.2–10 变色。指示剂的选择要让变色范围落在滴定突跃内。不能只按中性或 pH＝7 选。' },
      /* inline-04-db-exps.js tit.quiz 终点判断 why + tit.steps[5] */
      { t: '终点与当量点', dur: 18, scene: 'tit-review',
        txt: '终点是指示剂变色的时刻，与理论中和点存在微小差异，这是系统误差之一。同法滴定 2～3 次，取体积平均値代入 c·V 关系式计算待测浓度。' }
    ]
  },
  {
    id: 'cloud', tag: '原子结构', art: 'cloud',
    title: '电子云：从轨道到成键',
    blurb: '一对共用电子被两个同种原子均等吸引，电子云对称分布。',
    steps: [
      /* inline-03-db-elem.js h2.desc（首句） */
      { t: '最简单的双原子分子', dur: 14, scene: 'cloud-h2',
        txt: '最简单的双原子分子，也是“共价键”概念的第一个模型：一对共用电子被两个同种原子均等吸引。' },
      /* student-sop-structure-data.js S10：标题 + 步骤 + 注意 */
      { t: '用侧向与轴向重叠判断键类型', dur: 18, scene: 'cloud-overlap',
        txt: '看电子云重叠沿成键轴还是分居轴两侧 → 重叠位置。区分轨道种类与重叠方式。p 轨道也能轴向形成 σ。' },
      /* inline-03-db-elem.js h2.desc */
      { t: '电子云对称分布', dur: 16, scene: 'cloud-bond',
        txt: '一对共用电子被两个同种原子均等吸引，电子云对称分布，因此没有极性。' },
      /* inline-03-db-elem.js h2o.desc */
      { t: '电子云偏向氧一端', dur: 18, scene: 'cloud-polar',
        txt: '氧原子吸电子能力强，电子云偏向氧一端，分子一端略负一端略正。正是这份极性带来氢键、高沸点与“相似相溶”等水的奇特性质。' },
      /* inline-03-db-elem.js c6h6.desc */
      { t: '离域大 π 键', dur: 18, scene: 'cloud-benzene',
        txt: '六个 p 轨道肩并肩形成离域大 π 键，电子云像两个甜甜圈铺在环上下。这份“平均化”正是苯环特殊稳定性（芳香性）的来源。' }
    ]
  }
];
TOPICS.forEach(t => { t.total = t.steps.reduce((s, x) => s + x.dur, 0); });
const topicById = id => TOPICS.find(t => t.id === id);

/* ================= 引擎访问（E3 / B，与 workbench-3d-preview.js 同款委托） ================= */
let bundlePromise = null;
function ensureEngine() {
  if (window.B && window.E3) return Promise.resolve(true);
  if (bundlePromise) return bundlePromise;
  if (window.ChemLazy && window.ChemLazy.load) {
    bundlePromise = window.ChemLazy.load('viewer3d').then(() => !!(window.B && window.E3))
      .catch(() => { bundlePromise = null; return false; });
  } else {
    bundlePromise = Promise.resolve(false);
  }
  return bundlePromise;
}
const molCache = {};
function molItem(id) {
  const list = window.DB && window.DB.mols;
  if (!list) return null;
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}
function molModel(id) {
  if (id in molCache) return molCache[id];
  let model = null;
  try {
    const item = molItem(id);
    if (window.B && item) model = window.B.molecule(item, 'ball');
  } catch (e) { model = null; }
  molCache[id] = model;
  return model;
}
function elemColor(e, fallback) {
  const el = window.DB && window.DB.ELEM && window.DB.ELEM[e];
  return (el && el.c) || fallback || '#888888';
}

/* ================= 滴定 pH 数学（直接调用 ChemTitration.ph，缺失时用同款公式兜底） ================= */
function titConfig() {
  return (window.ChemTitration && window.ChemTitration.config) || { base: 0.1, acidVolume: 25, acid: 0.1 };
}
function titPh(v) {
  if (window.ChemTitration && typeof window.ChemTitration.ph === 'function') {
    return window.ChemTitration.ph(v);
  }
  /* 与 inline-09-studio.js TP.ph 相同的公式：25°C 理想强酸强碱，Kw=1e-14 */
  const c = titConfig();
  const excess = (c.base * v - c.acid * c.acidVolume) / (v + c.acidVolume);
  const root = Math.sqrt(excess * excess + 4e-14);
  const h = excess >= 0 ? 2e-14 / (root + excess) : (root - excess) / 2;
  return -Math.log10(h);
}

/* ================= 2D 绘制小工具 ================= */
function chip(ctx, text, cx, y, C, accent) {
  ctx.font = '600 12px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
  const w = ctx.measureText(text).width + 20;
  const x = cx - w / 2, h = 24;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 12); else ctx.rect(x, y, w, h);
  ctx.fillStyle = accent ? C.accent : C.card;
  ctx.fill();
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = accent ? '#ffffff' : C.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y + h / 2 + 0.5);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
/* 电子云撒点：与周期表原子视图（inline-08-ui.js atomDraw）相同的金角螺旋撒点 */
function dotCloud(ctx, cx, cy, R, n, seed, color, spin) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = i * 2.399963 + (spin || 0);
    const rr = R * (0.18 + 0.82 * ((i * 37 % 100) / 100));
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * 0.92;
    ctx.beginPath();
    ctx.arc(x, y, 1.3, 0, TAU);
    ctx.fill();
  }
}
/* 2D 球棍示意（E3 不可用时的兜底；用 DB 原子坐标做正交投影） */
function drawMol2D(ctx, item, cx, cy, scale, yaw, C, opts) {
  opts = opts || {};
  const atoms = item.atoms || [];
  const proj = atoms.map(a => {
    const x1 = a.x * Math.cos(yaw) - a.z * Math.sin(yaw);
    const z1 = a.x * Math.sin(yaw) + a.z * Math.cos(yaw);
    const y1 = a.y * 0.96 - z1 * 0.18;
    return { x: cx + x1 * scale, y: cy - y1 * scale, z: z1, e: a.e };
  });
  (item.bonds || []).forEach(bd => {
    const A = proj[bd[0]], B = proj[bd[1]];
    if (!A || !B) return;
    ctx.strokeStyle = C.dim;
    ctx.lineWidth = Math.max(2, scale * 0.09);
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();
  });
  const order = proj.map((p, i) => ({ p, i })).sort((a, b) => a.p.z - b.p.z);
  order.forEach(({ p }) => {
    const el = (window.DB && window.DB.ELEM && window.DB.ELEM[p.e]) || { r: 0.3 };
    const r = Math.max(5, (opts.space ? el.vdw * 0.8 : el.r) * scale);
    const g = ctx.createRadialGradient(p.x - r * 0.33, p.y - r * 0.38, r * 0.12, p.x, p.y, r * 1.02);
    const col = elemColor(p.e, '#888888');
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, col);
    g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.18)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    if (r > 9) {
      ctx.fillStyle = p.e === 'H' || p.e === 'C' ? C.ink : '#ffffff';
      ctx.font = '700 ' + Math.round(r * 0.9) + 'px -apple-system,"PingFang SC",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.e, p.x, p.y + 0.5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  });
  return proj;
}

/* ================= E3 绘制小工具（相机现场保存 / 恢复，与主舞台互不干扰） ================= */
function saveCam() {
  const c = window.E3.cam;
  return { yaw: c.yaw, pitch: c.pitch, dist: c.dist, fov: c.fov, cx: c.cx, cy: c.cy };
}
function restoreCam(s) {
  const c = window.E3.cam;
  c.yaw = s.yaw; c.pitch = s.pitch; c.dist = s.dist;
  c.fov = s.fov; c.cx = s.cx; c.cy = s.cy;
}
/* 在画布的某个横向分區渲染一个模型（cxFrac 为分區中心横坐标占比，wFrac 为分區宽度占比） */
function renderMol(g, model, cxFrac, wFrac, yaw, pitch, extra, labels) {
  const E3 = window.E3;
  const saved = saveCam();
  try {
    E3.fit(model, Math.max(2, g.W * wFrac), Math.max(2, g.H), 0.8);
    E3.cam.cx = g.W * cxFrac;
    E3.cam.cy = g.H * 0.48;
    E3.cam.yaw = yaw;
    E3.cam.pitch = pitch;
    E3.render(g.ctx, model, { explode: 0, labels: !!labels, extra: extra || [] });
  } catch (e) { /* 单帧失败不中断播放 */ }
  restoreCam(saved);
}
/* SO₂ 电子域位置：由 DB 原子坐标推导（S 为中心，O 为成键域，孤对在角平分线反方向） */
function so2Domains() {
  const item = molItem('so2m');
  if (!item) return null;
  const S = item.atoms.find(a => a.e === 'S') || { x: 0, y: 0, z: 0 };
  const Os = item.atoms.filter(a => a.e === 'O');
  const dirs = Os.map(o => {
    const d = [o.x - S.x, o.y - S.y, o.z - S.z];
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    return [d[0] / l, d[1] / l, d[2] / l];
  });
  let bx = 0, by = 0, bz = 0;
  dirs.forEach(d => { bx += d[0]; by += d[1]; bz += d[2]; });
  const bl = Math.hypot(bx, by, bz) || 1;
  const lone = [-bx / bl * 1.35, -by / bl * 1.35, -bz / bl * 1.35];
  return {
    center: [S.x, S.y, S.z],
    bonds: Os.map(o => [o.x, o.y, o.z]),
    lone: [S.x + lone[0], S.y + lone[1], S.z + lone[2]]
  };
}
/* 排斥动画的三域方向：起点聚在北极附近，终点为平面三角形（120° 均分） */
function repelDirs(k) {
  const e = easeIO(k);
  const out = [];
  for (let i = 0; i < 3; i++) {
    const az = (90 + i * 120) * Math.PI / 180;
    const sx = Math.cos(az) * 0.3, sy = 0.95, sz = Math.sin(az) * 0.3;
    const ex = Math.cos(az), ey = 0.12, ez = Math.sin(az);
    let x = lerp(sx, ex, e), y = lerp(sy, ey, e), z = lerp(sz, ez, e);
    const l = Math.hypot(x, y, z) || 1;
    out.push([x / l * 1.9, y / l * 1.9, z / l * 1.9]);
  }
  return out;
}

/* ================= 场景：VSEPR ================= */
function sceneVseprCompare(g, k) {
  const C = g.C;
  if (g.hasE3) {
    const so2 = molModel('so2m'), h2o = molModel('h2o');
    if (so2 && h2o) {
      renderMol(g, so2, 0.25, 0.5, 0.55 + g.t * 0.25, 0.3);
      renderMol(g, h2o, 0.75, 0.5, 0.55 + g.t * 0.25, 0.3);
    }
  } else {
    const so2 = molItem('so2m'), h2o = molItem('h2o');
    if (so2) drawMol2D(g.ctx, so2, g.W * 0.25, g.H * 0.46, Math.min(g.W, g.H) * 0.16, g.t * 0.25, C);
    if (h2o) drawMol2D(g.ctx, h2o, g.W * 0.75, g.H * 0.46, Math.min(g.W, g.H) * 0.16, g.t * 0.25, C);
  }
  chip(g.ctx, 'SO₂ · 3 个电子域 · V 形', g.W * 0.25, g.H - 44, C, false);
  chip(g.ctx, 'H₂O · 4 个电子域 · V 形', g.W * 0.75, g.H - 44, C, false);
}
function sceneVseprCount(g, k) {
  const C = g.C;
  const dom = so2Domains();
  const showBond = [k > 0.18, k > 0.45];
  const showLone = k > 0.72;
  if (g.hasE3) {
    const model = molModel('so2m');
    if (model && dom) {
      const extra = [];
      dom.bonds.forEach((p, i) => {
        if (!showBond[i]) return;
        extra.push({ t: 'glow', c: p, r: 0.85, col: 'rgba(45,212,191,0.45)' });
        extra.push({ t: 'lbl', p: [p[0], p[1] + 0.62, p[2]], txt: '成键域' });
      });
      if (showLone) {
        extra.push({ t: 'glow', c: dom.lone, r: 0.8, col: 'rgba(251,191,36,0.55)' });
        extra.push({ t: 'sph', c: dom.lone, r: 0.22, col: '#d97706' });
        extra.push({ t: 'lbl', p: [dom.lone[0], dom.lone[1] - 0.55, dom.lone[2]], txt: '孤电子对' });
      }
      renderMol(g, model, 0.5, 1, 0.55 + g.t * 0.12, 0.3, extra, true);
    }
  } else {
    const item = molItem('so2m');
    if (item && dom) {
      const scale = Math.min(g.W, g.H) * 0.17;
      const cx = g.W / 2, cy = g.H * 0.46;
      drawMol2D(g.ctx, item, cx, cy, scale, g.t * 0.12, C);
      const toXY = p => [cx + p[0] * scale, cy - p[1] * scale];
      dom.bonds.forEach((p, i) => {
        if (!showBond[i]) return;
        const [x, y] = toXY(p);
        g.ctx.strokeStyle = C.line;
        g.ctx.lineWidth = 2;
        g.ctx.beginPath();
        g.ctx.arc(x, y, 26, 0, TAU);
        g.ctx.stroke();
        chip(g.ctx, '成键域', x, y - 44, C, false);
      });
      if (showLone) {
        const [x, y] = toXY(dom.lone);
        g.ctx.fillStyle = 'rgba(251,191,36,.5)';
        g.ctx.beginPath();
        g.ctx.arc(x, y, 18, 0, TAU);
        g.ctx.fill();
        chip(g.ctx, '孤电子对', x, y + 22, C, false);
      }
    }
  }
  const n = (showBond[0] ? 1 : 0) + (showBond[1] ? 1 : 0) + (showLone ? 1 : 0);
  chip(g.ctx, '已数出 ' + n + ' / 3 个电子域', g.W / 2, g.H - 44, C, n === 3);
}
function sceneVseprRepel(g, k) {
  const C = g.C;
  const dirs = repelDirs(k);
  const sCol = elemColor('S', '#e8c832');
  if (g.hasE3) {
    const saved = saveCam();
    try {
      const cam = window.E3.cam;
      cam.yaw = 0.5 + g.t * 0.2;
      cam.pitch = 0.85;
      cam.dist = 8.6;
      cam.fov = Math.min(g.W, g.H) * 0.8;
      cam.cx = g.W / 2;
      cam.cy = g.H * 0.5;
      const extra = [{ t: 'sph', c: [0, 0, 0], r: 0.42, col: sCol }];
      dirs.forEach(p => {
        extra.push({ t: 'line', a: [0, 0, 0], b: p, r: 0.03, col: '#8fb8ad' });
        extra.push({ t: 'glow', c: p, r: 0.62, col: 'rgba(45,212,191,0.5)' });
        extra.push({ t: 'sph', c: p, r: 0.17, col: '#14b8a6' });
      });
      window.E3.render(g.ctx, { parts: [] }, { explode: 0, labels: false, extra });
    } catch (e) {}
    restoreCam(saved);
  } else {
    const cx = g.W / 2, cy = g.H * 0.48, R = Math.min(g.W, g.H) * 0.3;
    g.ctx.strokeStyle = C.grid;
    g.ctx.lineWidth = 1;
    g.ctx.beginPath();
    g.ctx.arc(cx, cy, R, 0, TAU);
    g.ctx.stroke();
    dirs.forEach(p => {
      const x = cx + p[0] / 1.9 * R, y = cy + p[2] / 1.9 * R * 0.9 - p[1] / 1.9 * R * 0.35;
      g.ctx.strokeStyle = C.dim;
      g.ctx.lineWidth = 1.5;
      g.ctx.beginPath();
      g.ctx.moveTo(cx, cy);
      g.ctx.lineTo(x, y);
      g.ctx.stroke();
      g.ctx.fillStyle = 'rgba(20,184,166,.45)';
      g.ctx.beginPath();
      g.ctx.arc(x, y, 20, 0, TAU);
      g.ctx.fill();
      g.ctx.fillStyle = '#14b8a6';
      g.ctx.beginPath();
      g.ctx.arc(x, y, 6, 0, TAU);
      g.ctx.fill();
    });
    g.ctx.fillStyle = sCol;
    g.ctx.beginPath();
    g.ctx.arc(cx, cy, 13, 0, TAU);
    g.ctx.fill();
  }
  if (k > 0.85) chip(g.ctx, '3 个电子域 → 平面三角形', g.W / 2, g.H - 44, C, true);
  else chip(g.ctx, '电子域互相排斥…', g.W / 2, g.H - 44, C, false);
}
function sceneVseprShape(g, k) {
  const C = g.C;
  const dom = so2Domains();
  const alpha = 0.55 * (1 - k * 0.85);
  if (g.hasE3) {
    const model = molModel('so2m');
    if (model && dom) {
      const extra = [
        { t: 'glow', c: dom.lone, r: 0.8, col: 'rgba(251,191,36,' + alpha.toFixed(2) + ')' },
        { t: 'lbl', p: [dom.lone[0], dom.lone[1] - 0.55, dom.lone[2]], txt: '孤电子对（不看）' }
      ];
      renderMol(g, model, 0.5, 1, 0.55 + g.t * 0.12, 0.3, extra, k < 0.8);
    }
  } else {
    const item = molItem('so2m');
    if (item && dom) {
      const scale = Math.min(g.W, g.H) * 0.17;
      const cx = g.W / 2, cy = g.H * 0.46;
      drawMol2D(g.ctx, item, cx, cy, scale, g.t * 0.12, C);
      const x = cx + dom.lone[0] * scale, y = cy - dom.lone[1] * scale;
      g.ctx.fillStyle = 'rgba(251,191,36,' + alpha.toFixed(2) + ')';
      g.ctx.beginPath();
      g.ctx.arc(x, y, 18, 0, TAU);
      g.ctx.fill();
    }
  }
  if (k > 0.7) chip(g.ctx, '只看原子位置：V 形 · 键角约 119°', g.W / 2, g.H - 44, C, true);
  else chip(g.ctx, '孤电子对渐渐隐去…', g.W / 2, g.H - 44, C, false);
}
function sceneVseprQuiz(g, k) {
  const C = g.C;
  const ctx = g.ctx;
  const W = g.W, H = g.H;
  ctx.font = '600 14px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'center';
  ctx.fillText('VSEPR 模型为平面三角形，且空间结构为 V 形的是？', W / 2, 34);
  ctx.textAlign = 'left';
  const rowH = Math.min(52, (H - 90) / 4);
  const y0 = 58;
  const colW = W - 48;
  VSEPR_OPTIONS.forEach((o, i) => {
    const appear = 0.08 + i * 0.16;
    if (k < appear) return;
    const y = y0 + i * (rowH + 8);
    const correct = i === 0 && k > 0.78;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(24, y, colW, rowH, 10); else ctx.rect(24, y, colW, rowH);
    ctx.fillStyle = correct ? C.accentSoft : C.card;
    ctx.fill();
    ctx.strokeStyle = correct ? C.line : C.grid;
    ctx.lineWidth = correct ? 2 : 1;
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.font = '700 16px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('ABCD'[i] + '. ' + o.f, 40, y + rowH / 2 - 8);
    ctx.font = '12px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = C.dim;
    ctx.fillText(o.bonded + ' 个成键方向 · ' + o.lone + ' 对孤电子 · 共 ' + o.domains + ' 个电子域', 40, y + rowH / 2 + 12);
    ctx.fillStyle = correct ? C.accent : C.ink;
    ctx.font = '600 12px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(o.arrange + ' · ' + o.shape + (correct ? '  ✓' : ''), W - 40, y + rowH / 2 + 4);
    ctx.textAlign = 'left';
  });
}

/* ================= 场景：滴定曲线 ================= */
function titGeometry(g) {
  const P = g.P;
  const m = { l: 46, r: 18, t: 26, b: 34 };
  const x0 = m.l, x1 = g.W - m.r, y0 = m.t, y1 = g.H - m.b;
  return {
    x: v => x0 + (v / P.xMax) * (x1 - x0),
    y: p => y1 - (p / 14) * (y1 - y0),
    x0, x1, y0, y1
  };
}
function drawTitAxes(g, geo) {
  const C = g.C, ctx = g.ctx;
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  ctx.font = '11px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillStyle = C.dim;
  ctx.textAlign = 'right';
  for (let p = 0; p <= 14; p += 2) {
    const y = geo.y(p);
    ctx.beginPath();
    ctx.moveTo(geo.x0, y);
    ctx.lineTo(geo.x1, y);
    ctx.stroke();
    ctx.fillText(String(p), geo.x0 - 8, y + 4);
  }
  ctx.textAlign = 'center';
  [0, 10, 20, 30, 40, 50].forEach(v => {
    if (v > g.P.xMax) return;
    ctx.fillText(String(v), geo.x(v), geo.y1 + 18);
  });
  ctx.textAlign = 'left';
  ctx.fillText('pH', 8, geo.y0 - 8);
  ctx.textAlign = 'right';
  ctx.fillText('加入 NaOH 体积 / mL', geo.x1, geo.y1 + 18);
  ctx.strokeStyle = C.dim;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(geo.x0, geo.y0 - 6);
  ctx.lineTo(geo.x0, geo.y1);
  ctx.lineTo(geo.x1 + 6, geo.y1);
  ctx.stroke();
  ctx.textAlign = 'left';
}
function drawTitCurve(g, geo, vMax, C) {
  const ctx = g.ctx;
  const pts = g.P.curve;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i][0] > vMax) break;
    const x = geo.x(pts[i][0]), y = geo.y(pts[i][1]);
    if (!started) { ctx.moveTo(x, y); started = true; }
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  if (vMax > 0) {
    const ph = titPh(vMax);
    ctx.fillStyle = C.danger;
    ctx.beginPath();
    ctx.arc(geo.x(vMax), geo.y(ph), 4.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.font = '600 12px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'left';
    const label = 'V = ' + vMax.toFixed(1) + ' mL · pH = ' + ph.toFixed(2);
    const lx = Math.min(geo.x(vMax) + 10, geo.x1 - ctx.measureText(label).width - 4);
    const ly = clamp(geo.y(ph) - 12, geo.y0 + 4, geo.y1 - 8);
    ctx.fillText(label, lx, ly);
  }
}
function sceneTitAxes(g, k) {
  const geo = titGeometry(g);
  drawTitAxes(g, geo);
  chip(g.ctx, '25°C 理想强酸强碱：HCl / NaOH，Kw=1e-14', g.W / 2, g.H - 46, g.C, false);
  const ph0 = titPh(0);
  g.ctx.fillStyle = g.C.danger;
  g.ctx.beginPath();
  g.ctx.arc(geo.x(0), geo.y(ph0), 4.5, 0, TAU);
  g.ctx.fill();
  g.ctx.fillStyle = g.C.ink;
  g.ctx.font = '600 12px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
  g.ctx.fillText('起点 pH = ' + ph0.toFixed(2), geo.x(0) + 10, geo.y(ph0) - 10);
}
function sceneTitRise(g, k) {
  const geo = titGeometry(g);
  drawTitAxes(g, geo);
  drawTitCurve(g, geo, g.P.eqV * 0.8 * easeIO(k), g.C);
}
function sceneTitJump(g, k) {
  const geo = titGeometry(g);
  drawTitAxes(g, geo);
  const v = lerp(g.P.eqV * 0.8, g.P.eqV * 1.2, easeIO(k));
  drawTitCurve(g, geo, v, g.C);
  if (k > 0.55) {
    const C = g.C, ctx = g.ctx;
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = C.danger;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(geo.x(g.P.eqV), geo.y(0));
    ctx.lineTo(geo.x(g.P.eqV), geo.y(14));
    ctx.stroke();
    ctx.setLineDash([]);
    chip(ctx, '当量点 V = ' + g.P.eqV.toFixed(1) + ' mL', geo.x(g.P.eqV), geo.y0 + 8, C, true);
  }
}
function sceneTitBand(g, k) {
  const geo = titGeometry(g);
  const C = g.C, ctx = g.ctx;
  ctx.fillStyle = C.band;
  ctx.fillRect(geo.x0, geo.y(10), geo.x1 - geo.x0, geo.y(8.2) - geo.y(10));
  ctx.fillStyle = C.danger;
  ctx.font = '600 12px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('酚酞变色范围 pH 8.2–10', geo.x0 + 8, geo.y(10) - 8);
  drawTitAxes(g, geo);
  drawTitCurve(g, geo, g.P.xMax, C);
  if (k > 0.5) chip(ctx, '变色范围落在滴定突跃内 ✓', g.W / 2, g.H - 46, C, true);
}
function sceneTitReview(g, k) {
  const geo = titGeometry(g);
  const C = g.C, ctx = g.ctx;
  drawTitAxes(g, geo);
  drawTitCurve(g, geo, g.P.xMax, C);
  const eq = g.P.eqV, end = g.P.endV;
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = C.danger;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(geo.x(eq), geo.y(0));
  ctx.lineTo(geo.x(eq), geo.y(7));
  ctx.stroke();
  ctx.strokeStyle = '#d97706';
  ctx.beginPath();
  ctx.moveTo(geo.x(end), geo.y(0));
  ctx.lineTo(geo.x(end), geo.y(8.2));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = C.danger;
  ctx.beginPath();
  ctx.arc(geo.x(eq), geo.y(7), 5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#d97706';
  ctx.beginPath();
  ctx.arc(geo.x(end), geo.y(8.2), 5, 0, TAU);
  ctx.fill();
  ctx.font = '600 12px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillStyle = C.danger;
  ctx.fillText('当量点 pH 7', geo.x(eq) + 8, geo.y(7) - 10);
  ctx.fillStyle = '#d97706';
  ctx.fillText('终点（指示剂变色）', Math.min(geo.x(end) + 8, geo.x1 - 110), geo.y(8.2) - 10);
  if (k > 0.5) chip(ctx, '终点 ≠ 当量点：只差一点点体积', g.W / 2, g.H - 46, C, false);
}

/* ================= 场景：电子云 ================= */
function nucleus(ctx, x, y, r, label, C) {
  ctx.fillStyle = C.accent;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 ' + Math.round(r * 1.05) + 'px -apple-system,"PingFang SC",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 0.5);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
function sceneCloudH2(g, k) {
  const C = g.C, ctx = g.ctx;
  const cx = g.W / 2, cy = g.H * 0.48, D = Math.min(110, g.W * 0.22);
  dotCloud(ctx, cx - D, cy, 62, 90, 11, C.cloud, g.t * 0.1);
  dotCloud(ctx, cx + D, cy, 62, 90, 23, C.cloud, -g.t * 0.1);
  nucleus(ctx, cx - D, cy, 11, 'H', C);
  nucleus(ctx, cx + D, cy, 11, 'H', C);
  chip(ctx, '两个氢原子，各带 1 个电子', cx, g.H - 46, C, false);
}
function sceneCloudOverlap(g, k) {
  const C = g.C, ctx = g.ctx;
  const cx = g.W / 2, cy = g.H * 0.48;
  const D = lerp(Math.min(110, g.W * 0.22), 52, easeIO(k));
  const R = 62;
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = C.dim;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - D - R - 14, cy);
  ctx.lineTo(cx + D + R + 14, cy);
  ctx.stroke();
  ctx.setLineDash([]);
  dotCloud(ctx, cx - D, cy, R, 90, 11, C.cloud, g.t * 0.1);
  dotCloud(ctx, cx + D, cy, R, 90, 23, C.cloud, -g.t * 0.1);
  /* 重叠区：同时落在两个云内的点用亮色标出 */
  const rnd = mulberry32(7);
  ctx.fillStyle = C.cloudHot;
  for (let i = 0; i < 46; i++) {
    const a = rnd() * TAU, rr = R * Math.sqrt(rnd()) * 0.62;
    const x = cx + Math.cos(a) * rr * 0.5, y = cy + Math.sin(a) * rr;
    if (Math.hypot(x - (cx - D), y - cy) < R && Math.hypot(x - (cx + D), y - cy) < R) {
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, TAU);
      ctx.fill();
    }
  }
  nucleus(ctx, cx - D, cy, 11, 'H', C);
  nucleus(ctx, cx + D, cy, 11, 'H', C);
  if (k > 0.45) {
    ctx.fillStyle = C.dim;
    ctx.font = '600 12px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('成键轴', cx, cy - R - 18);
    ctx.textAlign = 'left';
    chip(ctx, '电子云沿成键轴重叠', cx, g.H - 46, C, true);
  }
}
function sceneCloudBond(g, k) {
  const C = g.C, ctx = g.ctx;
  const cx = g.W / 2, cy = g.H * 0.48, D = 52, R = 62;
  dotCloud(ctx, cx - D, cy, R, 80, 11, C.cloud, g.t * 0.1);
  dotCloud(ctx, cx + D, cy, R, 80, 23, C.cloud, -g.t * 0.1);
  /* 共用电子对：集中在两核之间的云 */
  const rnd = mulberry32(31);
  ctx.fillStyle = C.cloudHot;
  for (let i = 0; i < 60; i++) {
    const a = rnd() * TAU, rr = 34 * Math.sqrt(rnd());
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rr * 0.8, cy + Math.sin(a) * rr, 1.6, 0, TAU);
    ctx.fill();
  }
  nucleus(ctx, cx - D, cy, 11, 'H', C);
  nucleus(ctx, cx + D, cy, 11, 'H', C);
  if (k > 0.55) {
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = C.dim;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - R - 16);
    ctx.lineTo(cx, cy + R + 16);
    ctx.stroke();
    ctx.setLineDash([]);
    chip(ctx, '电子云对称分布 · 没有极性', cx, g.H - 46, C, true);
  }
}
function sceneCloudPolar(g, k) {
  const C = g.C, ctx = g.ctx;
  const cx = g.W / 2, cy = g.H * 0.5;
  const ox = cx - 30, oy = cy + 6;
  const h1 = [cx + 52, cy - 52], h2 = [cx + 58, cy + 56];
  const bias = easeIO(k);
  /* 云密度随 k 向氧一端集中：氧周的点增多变亮，氢周的点减少变淡 */
  dotCloud(ctx, ox, oy, 74, Math.round(60 + 90 * bias), 41, C.cloud, g.t * 0.08);
  ctx.globalAlpha = 1 - bias * 0.55;
  dotCloud(ctx, h1[0], h1[1], 26, 22, 53, C.cloud, g.t * 0.1);
  dotCloud(ctx, h2[0], h2[1], 26, 22, 67, C.cloud, -g.t * 0.1);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = C.dim;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(h1[0], h1[1]);
  ctx.moveTo(ox, oy);
  ctx.lineTo(h2[0], h2[1]);
  ctx.stroke();
  nucleus(ctx, ox, oy, 17, 'O', C);
  nucleus(ctx, h1[0], h1[1], 10, 'H', C);
  nucleus(ctx, h2[0], h2[1], 10, 'H', C);
  if (k > 0.55) {
    ctx.font = '700 15px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = C.danger;
    ctx.fillText('δ⁻', ox - 34, oy - 22);
    ctx.fillStyle = C.accent;
    ctx.fillText('δ⁺', h1[0] + 12, h1[1] - 10);
    ctx.fillText('δ⁺', h2[0] + 12, h2[1] + 18);
    chip(ctx, '极性分子：氢键 · 高沸点 · 相似相溶', cx, g.H - 46, C, true);
  }
}
function sceneCloudBenzene(g, k) {
  const C = g.C, ctx = g.ctx;
  const cx = g.W / 2, cy = g.H * 0.5, R = Math.min(g.W, g.H) * 0.22;
  const verts = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 3;
    verts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.86]);
  }
  /* 两个“甜甜圈”：环平面上下各一个扁椭圆云 */
  const donuts = [[cy - R * 0.52, 1], [cy + R * 0.52, -1]];
  donuts.forEach(([dy], di) => {
    const alpha = clamp((k - di * 0.15) * 2.2, 0, 1);
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = C.cloud;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.ellipse(cx, dy, R * 1.02, R * 0.24, 0, 0, TAU);
    ctx.stroke();
    const rnd = mulberry32(90 + di);
    ctx.fillStyle = C.cloudHot;
    for (let i = 0; i < 46; i++) {
      const a = rnd() * TAU;
      const rr = R * (0.86 + rnd() * 0.3);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * rr, dy + Math.sin(a) * rr * 0.24, 1.5, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  verts.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = C.dim;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.52, 0, TAU);
  ctx.stroke();
  verts.forEach(([x, y]) => nucleus(ctx, x, y, 10, 'C', C));
  if (k > 0.6) chip(ctx, '电子云像两个甜甜圈铺在环上下', cx, g.H - 46, C, true);
}

const SCENES = {
  'vsepr-compare': sceneVseprCompare,
  'vsepr-count': sceneVseprCount,
  'vsepr-repel': sceneVseprRepel,
  'vsepr-shape': sceneVseprShape,
  'vsepr-quiz': sceneVseprQuiz,
  'tit-axes': sceneTitAxes,
  'tit-rise': sceneTitRise,
  'tit-jump': sceneTitJump,
  'tit-band': sceneTitBand,
  'tit-review': sceneTitReview,
  'cloud-h2': sceneCloudH2,
  'cloud-overlap': sceneCloudOverlap,
  'cloud-bond': sceneCloudBond,
  'cloud-polar': sceneCloudPolar,
  'cloud-benzene': sceneCloudBenzene
};

/* ================= 播放器 ================= */
let P = null; /* 当前播放器状态 */
const fmtTime = s => {
  s = Math.max(0, Math.round(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};
function stepAt(topic, time) {
  let acc = 0;
  for (let i = 0; i < topic.steps.length; i++) {
    if (time < acc + topic.steps[i].dur || i === topic.steps.length - 1) {
      return { index: i, start: acc, k: clamp((time - acc) / topic.steps[i].dur, 0, 1) };
    }
    acc += topic.steps[i].dur;
  }
  return { index: 0, start: 0, k: 0 };
}
function stepStart(topic, index) {
  let acc = 0;
  for (let i = 0; i < index && i < topic.steps.length; i++) acc += topic.steps[i].dur;
  return acc;
}

function buildTitrationData() {
  const cfg = titConfig();
  const eqV = (cfg.acid * cfg.acidVolume) / cfg.base;
  const xMax = Math.max(50, eqV * 1.25);
  const curve = [];
  for (let i = 0; i <= 240; i++) {
    const v = (xMax * i) / 240;
    curve.push([v, titPh(v)]);
  }
  /* 终点体积：pH 达到 8.2 时的体积（二分法，沿用同一 ph 函数） */
  let lo = eqV, hi = xMax, endV = eqV * 1.02;
  if (titPh(hi) >= 8.2) {
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (titPh(mid) >= 8.2) { hi = mid; endV = mid; } else lo = mid;
    }
  }
  return { eqV, xMax, curve, endV };
}

function drawFrame() {
  if (!P || !P.canvas) return;
  const ctx = P.ctx;
  const W = P.w, H = P.h;
  if (W < 2 || H < 2) return;
  ctx.setTransform(P.dpr, 0, 0, P.dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const st = stepAt(P.topic, P.time);
  const scene = SCENES[P.topic.steps[st.index].scene];
  if (scene) {
    scene({ ctx, W, H, t: P.time, C: theme(), P, hasE3: P.hasE3 }, st.k);
  }
}
function syncNarration(force) {
  if (!P) return;
  const st = stepAt(P.topic, P.time);
  if (!force && st.index === P.stepIndex) return;
  P.stepIndex = st.index;
  const step = P.topic.steps[st.index];
  P.titleEl.textContent = '第 ' + (st.index + 1) + ' 步 · ' + step.t;
  P.textEl.textContent = step.txt;
  const box = P.narrationEl;
  box.classList.remove('vibe-nar-fade');
  void box.offsetWidth; /* 重启动画 */
  box.classList.add('vibe-nar-fade');
  P.dotsEl.querySelectorAll('.vibe-dot').forEach((d, i) => {
    d.classList.toggle('on', i === st.index);
    d.classList.toggle('done', i < st.index);
    d.setAttribute('aria-current', i === st.index ? 'step' : 'false');
  });
}
function syncControls() {
  if (!P) return;
  P.seekEl.value = Math.round((P.time / P.topic.total) * 1000);
  P.timeEl.textContent = fmtTime(P.time) + ' / ' + fmtTime(P.topic.total);
  P.playEl.textContent = P.playing ? '暂停' : (P.time >= P.topic.total - 0.01 ? '重播' : '播放');
  P.playEl.setAttribute('aria-label', P.playing ? '暂停' : '播放');
}
function playerTick(ts) {
  if (!P) return;
  const dt = Math.min(0.05, (ts - P.lastTs) / 1000 || 0.016);
  P.lastTs = ts;
  if (!P.canvas.isConnected) { stopPlayer(); return; }
  if (P.playing && !document.hidden) {
    P.time = Math.min(P.topic.total, P.time + dt);
    if (P.time >= P.topic.total) P.playing = false;
    syncNarration(false);
    syncControls();
  }
  drawFrame();
  P.rafId = requestAnimationFrame(playerTick);
}
function resizePlayer() {
  if (!P) return;
  const r = P.canvas.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  P.w = r.width;
  P.h = r.height;
  P.dpr = dpr;
  P.canvas.width = Math.max(2, Math.round(r.width * dpr));
  P.canvas.height = Math.max(2, Math.round(r.height * dpr));
  drawFrame();
}
function seekTo(time, keepPlaying) {
  if (!P) return;
  P.time = clamp(time, 0, P.topic.total);
  if (P.time >= P.topic.total) P.playing = false;
  else if (keepPlaying) P.playing = true;
  syncNarration(true);
  syncControls();
  drawFrame();
}
function stopPlayer() {
  if (!P) return;
  if (P.rafId) cancelAnimationFrame(P.rafId);
  if (P.ro) P.ro.disconnect();
  if (P.abort) P.abort.abort();
  P = null;
}

function openTopic(id) {
  const topic = topicById(id);
  if (!topic) return;
  stopPlayer();
  if (window.ChemGames) window.ChemGames.stop();
  window.UI.view = 'vibe';
  window.UI.sel = null;
  $('viewStage').classList.add('hide');
  $('viewDoc').classList.add('show');
  const pv = $('viewPT');
  if (pv) pv.classList.add('hide');
  $('sidebar').classList.remove('show');
  $('mask').classList.remove('show');
  const insp = $('inspector');
  if (insp) insp.classList.remove('show');

  const totalLabel = '约 ' + Math.ceil(topic.total / 60) + ' 分钟 · ' + topic.steps.length + ' 步';
  $('docBody').innerHTML =
    '<section class="vibe-player" aria-label="考点动画：' + esc(topic.title) + '">' +
    '<div class="vibe-player-head"><button type="button" class="vibe-back" data-vibe-back>← 返回首页</button>' +
    '<div class="vibe-player-titles"><span class="paper-label">3 分钟讲透一个考点 · ' + esc(topic.tag) + '</span>' +
    '<h1>' + esc(topic.title) + '</h1></div>' +
    '<span class="vibe-total">' + totalLabel + '</span></div>' +
    '<div class="vibe-stage"><canvas class="vibe-canvas" role="img" aria-label="' + esc(topic.title) + '分步动画"></canvas>' +
    '<div class="vibe-loading"><span class="wb3d-spin"></span><span>正在准备动画…</span></div></div>' +
    '<div class="vibe-narration"><div class="vibe-dots">' +
    topic.steps.map((s, i) => '<button type="button" class="vibe-dot" data-vibe-dot="' + i + '" aria-label="第 ' + (i + 1) + ' 步：' + esc(s.t) + '">' + (i + 1) + '</button>').join('') +
    '</div><h2 class="vibe-step-title"></h2><p class="vibe-step-text"></p></div>' +
    '<div class="vibe-controls">' +
    '<button type="button" class="vibe-btn" data-vibe-prev>上一步</button>' +
    '<button type="button" class="vibe-btn vibe-play" data-vibe-play>播放</button>' +
    '<button type="button" class="vibe-btn" data-vibe-next>下一步</button>' +
    '<input type="range" class="vibe-seek" min="0" max="1000" value="0" aria-label="动画进度">' +
    '<span class="vibe-time">0:00 / ' + fmtTime(topic.total) + '</span></div>' +
    '<p class="vibe-note">解说文案取自工作台现有考点数据与教材实验；动画为教学示意。</p>' +
    '</section>';
  $('viewDoc').scrollTop = 0;
  window.dispatchEvent(new CustomEvent('chem:context'));

  const root = $('docBody').querySelector('.vibe-player');
  const abort = new AbortController();
  const sig = { signal: abort.signal };
  P = {
    topic, time: 0, playing: !reducedMotion, stepIndex: -1,
    canvas: root.querySelector('.vibe-canvas'),
    ctx: root.querySelector('.vibe-canvas').getContext('2d'),
    narrationEl: root.querySelector('.vibe-narration'),
    titleEl: root.querySelector('.vibe-step-title'),
    textEl: root.querySelector('.vibe-step-text'),
    dotsEl: root.querySelector('.vibe-dots'),
    seekEl: root.querySelector('.vibe-seek'),
    timeEl: root.querySelector('.vibe-time'),
    playEl: root.querySelector('[data-vibe-play]'),
    veil: root.querySelector('.vibe-loading'),
    w: 0, h: 0, dpr: 1, rafId: 0, lastTs: performance.now(),
    ro: null, abort, hasE3: false,
    eqV: 25, xMax: 50, curve: [], endV: 25.5
  };
  if (topic.id === 'titration') Object.assign(P, buildTitrationData());

  const goHome = () => { stopPlayer(); window.showHome(); };
  root.querySelector('[data-vibe-back]').addEventListener('click', goHome, sig);
  P.playEl.addEventListener('click', () => {
    if (!P) return;
    if (!P.playing && P.time >= P.topic.total - 0.01) P.time = 0;
    P.playing = !P.playing;
    syncNarration(true);
    syncControls();
  }, sig);
  root.querySelector('[data-vibe-prev]').addEventListener('click', () => {
    if (!P) return;
    const st = stepAt(P.topic, P.time);
    seekTo(stepStart(P.topic, Math.max(0, st.index - (P.time - st.start > 1.5 ? 0 : 1))), P.playing);
  }, sig);
  root.querySelector('[data-vibe-next]').addEventListener('click', () => {
    if (!P) return;
    const st = stepAt(P.topic, P.time);
    seekTo(stepStart(P.topic, Math.min(P.topic.steps.length - 1, st.index + 1)), P.playing);
  }, sig);
  P.dotsEl.querySelectorAll('.vibe-dot').forEach(d => {
    d.addEventListener('click', () => {
      if (!P) return;
      seekTo(stepStart(P.topic, Number(d.getAttribute('data-vibe-dot'))), P.playing);
    }, sig);
  });
  let scrubWasPlaying = false, scrubbing = false;
  P.seekEl.addEventListener('pointerdown', () => {
    scrubbing = true;
    scrubWasPlaying = P.playing;
    P.playing = false;
  }, sig);
  P.seekEl.addEventListener('input', () => {
    if (!P) return;
    P.time = (Number(P.seekEl.value) / 1000) * P.topic.total;
    syncNarration(true);
    syncControls();
    drawFrame();
  }, sig);
  const endScrub = () => {
    if (!scrubbing) return;
    scrubbing = false;
    if (P && scrubWasPlaying && P.time < P.topic.total) P.playing = true;
    syncControls();
  };
  P.seekEl.addEventListener('pointerup', endScrub, sig);
  P.seekEl.addEventListener('change', endScrub, sig);
  root.addEventListener('keydown', e => {
    if (!P) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    /* 空格在按钮上有原生点击行为，只在非按钮焦点时接管，避免双重切换 */
    if (e.key === ' ') { if (e.target.tagName === 'BUTTON') return; e.preventDefault(); P.playEl.click(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); root.querySelector('[data-vibe-prev]').click(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); root.querySelector('[data-vibe-next]').click(); }
    else if (e.key === 'Escape') { goHome(); }
  }, sig);

  if ('ResizeObserver' in window) {
    P.ro = new ResizeObserver(resizePlayer);
    P.ro.observe(P.canvas);
  }
  resizePlayer();
  syncNarration(true);
  syncControls();
  P.rafId = requestAnimationFrame(playerTick);

  /* VSEPR 需要 3D 引擎；加载失败时用 2D 球棍示意兜底，仍可播放 */
  const finishLoad = () => {
    if (!P) return;
    P.veil.classList.add('hide');
    drawFrame();
  };
  if (topic.id === 'vsepr') {
    ensureEngine().then(ok => {
      if (!P) return;
      P.hasE3 = ok && !!molModel('so2m') && !!molModel('h2o');
      finishLoad();
    });
  } else {
    finishLoad();
  }
}

/* ================= 首页卡片区 ================= */
const ZONE_ART = {
  vsepr: '<svg viewBox="0 0 120 72" fill="none" aria-hidden="true"><circle cx="60" cy="38" r="10" fill="#e8c832"/><circle cx="28" cy="20" r="8" fill="#e0442e"/><circle cx="92" cy="20" r="8" fill="#e0442e"/><circle cx="60" cy="62" r="7" fill="#fbbf24" opacity=".75"/><path d="M60 38 28 20M60 38l32-18M60 38v24" stroke="#8fb8ad" stroke-width="2"/></svg>',
  titration: '<svg viewBox="0 0 120 72" fill="none" aria-hidden="true"><path d="M14 58h92M14 58V12" stroke="#8fb8ad" stroke-width="2"/><path d="M14 52C40 50 52 48 60 34c8-14 10-16 22-16 10 0 18-2 24-4" stroke="#14b8a6" stroke-width="3" stroke-linecap="round"/><circle cx="60" cy="34" r="4" fill="#dc2626"/></svg>',
  cloud: '<svg viewBox="0 0 120 72" fill="none" aria-hidden="true"><ellipse cx="60" cy="26" rx="34" ry="9" stroke="#5eead4" stroke-width="2" opacity=".8"/><ellipse cx="60" cy="46" rx="34" ry="9" stroke="#5eead4" stroke-width="2" opacity=".8"/><path d="M60 14l24 11v22l-24 11-24-11V25z" stroke="#d7ece6" stroke-width="2"/></svg>'
};
function zoneHTML() {
  const cards = TOPICS.map(t =>
    '<button type="button" class="vibe-card" data-vibe-topic="' + t.id + '">' +
    '<span class="vibe-card-art vibe-art-' + t.art + '">' + ZONE_ART[t.art] + '</span>' +
    '<span class="vibe-card-copy"><span class="vibe-card-tag">' + esc(t.tag) + '</span>' +
    '<strong>' + esc(t.title) + '</strong><small>' + esc(t.blurb) + '</small>' +
    '<span class="vibe-card-meta">约 ' + Math.ceil(t.total / 60) + ' 分钟 · ' + t.steps.length + ' 步分步演示 <span aria-hidden="true">→</span></span>' +
    '</span></button>').join('');
  return '<section class="vibe-zone" aria-label="3 分钟讲透一个考点">' +
    '<div class="vibe-zone-head"><h2>3 分钟讲透一个考点</h2>' +
    '<p>背景 → 可视化推导 → 联系生活，一段动画讲透一个考点。</p></div>' +
    '<div class="vibe-zone-list">' + cards + '</div></section>';
}
function injectZoneIn(root) {
  if (!root || !root.querySelector) return;
  const discover = root.querySelector('.cw-discover') || (root.classList && root.classList.contains('cw-discover') ? root : null);
  if (discover) {
    if (discover.querySelector('.vibe-zone')) return;
    const hero = discover.querySelector('.cw-hero');
    if (hero) hero.insertAdjacentHTML('afterend', zoneHTML());
    else discover.insertAdjacentHTML('afterbegin', zoneHTML());
    return;
  }
  const studio = root.querySelector('.studio-home') || (root.classList && root.classList.contains('studio-home') ? root : null);
  if (studio && !studio.querySelector('.vibe-zone')) {
    const welcome = studio.querySelector('.home-welcome');
    if (welcome) welcome.insertAdjacentHTML('afterend', zoneHTML());
    else studio.insertAdjacentHTML('afterbegin', zoneHTML());
  }
}

/* ================= SOP 步骤逐步呈现（包装现有渲染，不改 SOP 文件） ================= */
function tagSop(root) {
  if (!root || !root.querySelectorAll) return;
  /* 候选 = root 本身（新增节点本身就是目标时）+ 其后代，按选择器分别收集 */
  const collect = sel => {
    const out = Array.prototype.slice.call(root.querySelectorAll(sel));
    if (root.matches && root.matches(sel)) out.unshift(root);
    return out;
  };
  /* 总控 SOP 路线图：步骤逐个高亮出现 */
  collect('.method-steps:not([data-vibe-sop])').forEach(ol => {
    ol.setAttribute('data-vibe-sop', '1');
    ol.classList.add('wb3d-sop-anim');
    ol.querySelectorAll(':scope > li').forEach((li, i) => {
      li.style.setProperty('--wb3d-i', String(i));
    });
  });
  /* SOP 详情卡片（<details> 展开时逐个出现，由 CSS 的 details[open] 选择器触发） */
  collect('.method-sop-overview:not([data-vibe-sop])').forEach(box => {
    box.setAttribute('data-vibe-sop', '1');
    box.classList.add('wb3d-sop-anim');
    box.querySelectorAll(':scope > section').forEach((sec, i) => {
      sec.style.setProperty('--wb3d-i', String(i));
    });
  });
  /* 复习清单：同样逐个出现 */
  collect('.method-review:not([data-vibe-sop])').forEach(ol => {
    ol.setAttribute('data-vibe-sop', '1');
    ol.classList.add('wb3d-sop-anim');
    ol.querySelectorAll(':scope > li').forEach((li, i) => {
      li.style.setProperty('--wb3d-i', String(i));
    });
  });
}

/* ================= 启动 ================= */
function scan(root) {
  injectZoneIn(root);
  tagSop(root);
  if (root !== document) {
    injectZoneIn(document);
    tagSop(document);
  }
}
document.addEventListener('click', event => {
  const btn = event.target && event.target.closest ? event.target.closest('[data-vibe-topic]') : null;
  if (!btn) return;
  openTopic(btn.getAttribute('data-vibe-topic'));
});
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
function init() {
  scan(document);
  const docBody = $('docBody');
  if (docBody && 'MutationObserver' in window) {
    const mo = new MutationObserver(mutations => {
      for (let i = 0; i < mutations.length; i++) {
        const added = mutations[i].addedNodes;
        for (let j = 0; j < added.length; j++) {
          const node = added[j];
          if (!node || node.nodeType !== 1) continue;
          scan(node);
        }
      }
    });
    mo.observe(docBody, { childList: true, subtree: true });
  }
}

window.ChemVibe = {
  version: 'w4-1',
  open: openTopic,
  stop: stopPlayer,
  refresh: () => scan(document),
  topics: TOPICS.map(t => ({ id: t.id, title: t.title, total: t.total }))
};
})();
