// 课本章节页内嵌 3D 模型：复用工作台的分子建模器（window.B.molecule）
// 与 WebGL 渲染器（chem-spatial-render.js），把每节已标的 model: 链接
// 直接在课本页里渲染成可拖拽旋转的 3D 模型，而不是只给一个跳转链接。
// 注意：这里自带独立相机状态，绝不碰共享的 window.E3.cam。

const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[c]);

const MODE_KEY = 'ct-model-mode';
const SPIN_KEY = 'ct-model-spin';
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const controllers = new Set();

function modelEntries(selected, env) {
  return selected.links.map(key => env.resource(key))
    .filter(resource => resource && resource.type === 'model')
    .map(resource => {
      const entry = window.DB?.mols?.find(row => row.id === resource.id);
      return entry ? {resource, entry} : null;
    })
    .filter(Boolean);
}

export function modelMarkup(book, selected, env) {
  const models = modelEntries(selected, env);
  if (!models.length) return '';
  const first = models[0];
  const chips = models.length > 1
    ? `<div class="ct-models-chips" role="group" aria-label="选择模型">${models.map(({resource, entry}, i) =>
        `<button type="button" data-ct-model-chip="${escape(resource.id)}"
          data-ct-model-open="${escape(env.resourceHref(book, selected, resource))}"
          aria-pressed="${i === 0}">${escape(entry.name)}</button>`).join('')}</div>`
    : '';
  return `<section class="ct-models" aria-label="3D 模型">
    <div class="ct-models-head">
      <h3>3D 模型</h3>
      ${chips}
    </div>
    <div class="ct-model-view" data-ct-model-view data-ct-models="${models.map(({resource}) => resource.id).join(' ')}">
      <canvas class="ct-model-canvas" data-ct-model-canvas aria-label="${escape(first.entry.name)}三维模型，可拖动旋转"></canvas>
      <p class="ct-model-loading" data-ct-model-loading>正在加载 3D 模型…</p>
      <p class="ct-model-fallback" data-ct-model-fallback hidden>这台设备无法显示 3D 模型，
        <a data-ct-route href="${escape(env.resourceHref(book, selected, first.resource))}">在工作台中打开</a>试试。</p>
      <div class="ct-model-bar">
        <span class="ct-model-name" data-ct-model-name></span>
        <button type="button" data-ct-model-mode aria-label="切换球棍或空间填充模型">空间填充</button>
        <button type="button" data-ct-model-spin aria-pressed="true">旋转</button>
        <button type="button" data-ct-model-reset>复位</button>
        <a data-ct-model-open data-ct-route href="${escape(env.resourceHref(book, selected, first.resource))}">在工作台中打开 ↗</a>
      </div>
    </div>
    <p class="ct-model-hint">拖动旋转 · 滚轮或双指缩放</p>
  </section>`;
}

function fitCamera(camera, model, width, height) {
  camera.yaw = 0.18;
  camera.pitch = 0.26;
  camera.dist = model.span * 1.85 + 2.2;
  camera.fov = Math.min(width, height) * 0.84;
  camera.cx = width / 2;
  camera.cy = height * 0.47;
  camera.minD = model.span * 0.8;
  camera.maxD = model.span * 9;
}

class ModelViewer {
  constructor(view) {
    this.view = view;
    this.canvas = view.querySelector('[data-ct-model-canvas]');
    this.loading = view.querySelector('[data-ct-model-loading]');
    this.fallback = view.querySelector('[data-ct-model-fallback]');
    this.nameEl = view.querySelector('[data-ct-model-name]');
    this.openLink = view.querySelector('[data-ct-model-open]');
    this.modeBtn = view.querySelector('[data-ct-model-mode]');
    this.spinBtn = view.querySelector('[data-ct-model-spin]');
    this.resetBtn = view.querySelector('[data-ct-model-reset]');
    this.chips = [...view.parentElement.querySelectorAll('[data-ct-model-chip]')];
    this.ids = view.dataset.ctModels.split(' ').filter(Boolean);
    this.index = 0;
    this.mode = localStorage.getItem(MODE_KEY) === 'space' ? 'space' : 'ball';
    const savedSpin = localStorage.getItem(SPIN_KEY);
    this.spinning = savedSpin === null ? !reducedMotion() : savedSpin === '1';
    this.camera = {yaw:0.18, pitch:0.26, dist:12, fov:520, cx:0, cy:0, minD:1, maxD:100};
    this.pointers = new Map();
    this.pinchD = 0;
    this.raf = 0;
    this.resumeAt = 0;
    this.renderer = null;
    this.model = null;
    this.options = null;
    this.abort = new AbortController();
    this.ready = false;
    this.dead = false;
  }

  entry() {
    return window.DB.mols.find(row => row.id === this.ids[this.index]);
  }

  async start() {
    if (!window.B?.molecule || !window.DB?.mols) return this.fail();
    let createLabRenderer;
    try {
      ({createLabRenderer} = await import('./chem-spatial-render.js?v=6'));
    } catch {
      return this.fail();
    }
    if (this.dead || !this.view.isConnected) return;
    try {
      this.renderer = createLabRenderer(this.view, this.canvas);
    } catch {
      return this.fail();
    }
    this.buildModel();
    this.wire();
    this.resize = new ResizeObserver(() => this.draw());
    this.resize.observe(this.view);
    if (!this.draw()) return this.fail();
    this.loading.hidden = true;
    this.ready = true;
    this.loop();
  }

  buildModel() {
    const entry = this.entry();
    this.model = window.B.molecule(entry, this.mode);
    this.options = {
      disp: this.model.parts.map(() => [0, 0, 0]),
      extra: [],
      labels: false,
      focusPart: null
    };
    fitCamera(this.camera, this.model, this.canvas.clientWidth || 320, this.canvas.clientHeight || 280);
    this.nameEl.innerHTML = `${escape(entry.name)} <i>${entry.formula || ''}</i>`;
    this.canvas.setAttribute('aria-label', entry.name + '三维模型，可拖动旋转');
    this.modeBtn.textContent = this.mode === 'space' ? '球棍模型' : '空间填充';
    this.spinBtn.setAttribute('aria-pressed', String(this.spinning));
  }

  draw() {
    if (!this.renderer || !this.model) return false;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return false;
    this.camera.fov = Math.min(w, h) * 0.84;
    this.camera.cx = w / 2;
    this.camera.cy = h * 0.47;
    return this.renderer.draw(this.model, this.options, this.camera);
  }

  loop() {
    if (this.dead) return;
    if (this.spinning && performance.now() >= this.resumeAt) {
      this.camera.yaw += 0.0035;
      this.draw();
    }
    this.raf = requestAnimationFrame(() => this.loop());
  }

  wire() {
    const {signal} = this.abort;
    const canvas = this.canvas;
    canvas.addEventListener('pointerdown', event => {
      canvas.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchD = Math.hypot(a.x - b.x, a.y - b.y);
      }
      this.resumeAt = performance.now() + 2500;
    }, {signal});
    canvas.addEventListener('pointermove', event => {
      const prev = this.pointers.get(event.pointerId);
      if (!prev) return;
      const next = {x: event.clientX, y: event.clientY};
      this.pointers.set(event.pointerId, next);
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchD > 0 && d > 0) {
          this.camera.dist = Math.max(this.camera.minD,
            Math.min(this.camera.maxD, this.camera.dist * this.pinchD / d));
        }
        this.pinchD = d;
      } else {
        this.camera.yaw -= (next.x - prev.x) * 0.008;
        this.camera.pitch = Math.max(-1.42, Math.min(1.42,
          this.camera.pitch + (next.y - prev.y) * 0.008));
      }
      this.resumeAt = performance.now() + 2500;
      this.draw();
    }, {signal});
    const release = event => {
      this.pointers.delete(event.pointerId);
      if (this.pointers.size < 2) this.pinchD = 0;
    };
    canvas.addEventListener('pointerup', release, {signal});
    canvas.addEventListener('pointercancel', release, {signal});
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      this.camera.dist = Math.max(this.camera.minD,
        Math.min(this.camera.maxD, this.camera.dist * Math.exp(event.deltaY * 0.001)));
      this.resumeAt = performance.now() + 2500;
      this.draw();
    }, {signal, passive: false});
    canvas.addEventListener('dblclick', () => {
      fitCamera(this.camera, this.model, this.canvas.clientWidth, this.canvas.clientHeight);
      this.draw();
    }, {signal});

    this.chips.forEach((chip, i) => chip.addEventListener('click', () => {
      if (i === this.index) return;
      this.index = i;
      this.chips.forEach((other, j) => other.setAttribute('aria-pressed', String(j === i)));
      this.openLink.href = chip.dataset.ctModelOpen;
      this.buildModel();
      this.draw();
    }, {signal}));
    this.modeBtn.addEventListener('click', () => {
      this.mode = this.mode === 'space' ? 'ball' : 'space';
      localStorage.setItem(MODE_KEY, this.mode);
      this.buildModel();
      this.draw();
    }, {signal});
    this.spinBtn.addEventListener('click', () => {
      this.spinning = !this.spinning;
      localStorage.setItem(SPIN_KEY, this.spinning ? '1' : '0');
      this.spinBtn.setAttribute('aria-pressed', String(this.spinning));
      this.resumeAt = 0;
    }, {signal});
    this.resetBtn.addEventListener('click', () => {
      fitCamera(this.camera, this.model, this.canvas.clientWidth, this.canvas.clientHeight);
      this.draw();
    }, {signal});
  }

  fail() {
    if (this.dead) return;
    this.loading.hidden = true;
    this.fallback.hidden = false;
    this.canvas.hidden = true;
    this.modeBtn.disabled = true;
    this.spinBtn.disabled = true;
    this.resetBtn.disabled = true;
    this.dispose();
  }

  dispose() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.resize?.disconnect();
    this.abort.abort();
    try { this.renderer?.dispose(); } catch { /* 已卸载时忽略 */ }
    this.renderer = null;
    controllers.delete(this);
  }
}

export function mountModels(host) {
  for (const view of host.querySelectorAll('[data-ct-model-view]:not([data-ct-mounted])')) {
    view.dataset.ctMounted = '1';
    const viewer = new ModelViewer(view);
    controllers.add(viewer);
    viewer.start();
  }
}

export function unmountModels() {
  for (const viewer of [...controllers]) viewer.dispose();
}
