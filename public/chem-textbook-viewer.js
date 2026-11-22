// 课本内嵌 3D 查看器（分子 / 实验装置共用）：
// 复用工作台的 WebGL 渲染器（chem-spatial-render.js），自带独立相机状态，
// 绝不碰共享的 window.E3.cam。模型由调用方通过 buildModel 提供。
// 视图结构（调用方在 markup 里生成）：
//   [data-ct-view][data-ct-items="id1 id2"] > canvas[data-ct-view-canvas]
//     + p[data-ct-view-loading] + fallback[data-ct-view-fallback]
//     + .ct-model-bar（name/open/mode?/spin/reset）
//   切换 chips 在 view 的父容器里：[data-ct-view-chip][data-ct-view-open]

const SPIN_KEY = 'ct-view-spin';
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const registries = {model: new Set(), lab: new Set()};

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

export class TextbookViewer {
  constructor(view, options) {
    this.view = view;
    this.options = options;
    this.canvas = view.querySelector('[data-ct-view-canvas]');
    this.loading = view.querySelector('[data-ct-view-loading]');
    this.fallback = view.querySelector('[data-ct-view-fallback]');
    this.nameEl = view.querySelector('[data-ct-view-name]');
    this.openLink = view.querySelector('[data-ct-view-open]');
    this.modeBtn = view.querySelector('[data-ct-view-mode]');
    this.spinBtn = view.querySelector('[data-ct-view-spin]');
    this.resetBtn = view.querySelector('[data-ct-view-reset]');
    this.chips = [...view.parentElement.querySelectorAll('[data-ct-view-chip]')];
    this.ids = (view.dataset.ctItems || '').split(' ').filter(Boolean);
    this.index = 0;
    const savedSpin = localStorage.getItem(SPIN_KEY);
    this.spinning = savedSpin === null ? !reducedMotion() : savedSpin === '1';
    this.camera = {yaw:0.18, pitch:0.26, dist:12, fov:520, cx:0, cy:0, minD:1, maxD:100};
    this.pointers = new Map();
    this.pinchD = 0;
    this.raf = 0;
    this.resumeAt = 0;
    this.renderer = null;
    this.model = null;
    this.options3d = null;
    this.abort = new AbortController();
    this.ready = false;
    this.dead = false;
  }

  async start() {
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
    if (!this.buildModel()) return this.fail();
    this.wire();
    this.resize = new ResizeObserver(() => this.draw());
    this.resize.observe(this.view);
    if (!this.draw()) return this.fail();
    this.loading.hidden = true;
    this.ready = true;
    this.loop();
  }

  buildModel() {
    const built = this.options.buildModel(this.ids[this.index]);
    if (!built || !built.model) return false;
    this.model = built.model;
    this.options3d = {
      disp: this.model.parts.map(() => [0, 0, 0]),
      extra: [],
      labels: false,
      focusPart: null
    };
    fitCamera(this.camera, this.model, this.canvas.clientWidth || 320, this.canvas.clientHeight || 280);
    if (built.nameHtml !== undefined) this.nameEl.innerHTML = built.nameHtml;
    if (built.ariaLabel) this.canvas.setAttribute('aria-label', built.ariaLabel);
    if (this.modeBtn && this.options.mode) this.modeBtn.textContent = this.options.mode.label();
    this.spinBtn.setAttribute('aria-pressed', String(this.spinning));
    return true;
  }

  draw() {
    if (!this.renderer || !this.model) return false;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return false;
    this.camera.fov = Math.min(w, h) * 0.84;
    this.camera.cx = w / 2;
    this.camera.cy = h * 0.47;
    return this.renderer.draw(this.model, this.options3d, this.camera);
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
      this.openLink.href = chip.dataset.ctViewOpen;
      if (!this.buildModel()) return this.fail();
      this.draw();
      this.options.onSwitch?.(this.ids[i]);
    }, {signal}));
    if (this.modeBtn && this.options.mode) this.modeBtn.addEventListener('click', () => {
      this.options.mode.toggle();
      if (!this.buildModel()) return this.fail();
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
    if (this.modeBtn) this.modeBtn.disabled = true;
    this.spinBtn.disabled = true;
    this.resetBtn.disabled = true;
    this.options.onFail?.(this.ids[this.index]);
    this.dispose();
  }

  dispose() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.resize?.disconnect();
    this.abort.abort();
    try { this.renderer?.dispose(); } catch { /* 已卸载时忽略 */ }
    this.renderer = null;
    registries[this.view.dataset.ctKind]?.delete(this);
  }
}

export function mountViews(host, kind, createOptions) {
  for (const view of host.querySelectorAll(`[data-ct-view][data-ct-kind="${kind}"]:not([data-ct-mounted])`)) {
    view.dataset.ctMounted = '1';
    const viewer = new TextbookViewer(view, createOptions(view));
    registries[kind].add(viewer);
    viewer.start();
  }
}

export function unmountViews(kind) {
  for (const viewer of [...registries[kind]]) viewer.dispose();
}
