import {apparatus, gasAt} from './chem-book-model.js?v=2';

class TextbookLabPreview extends HTMLElement {
  connectedCallback() {
    this.classList.remove('is-live','is-fallback');
    this.innerHTML = `<div class="ct-preview-stage" aria-label="书页上的电解水三维装置">
      <img src="assets/spatial/book-electrolysis.webp" width="763" height="476" alt="展开的电解水装置" hidden>
      <div class="ct-preview-canvas" aria-hidden="true"></div>
      <span class="ct-preview-mode" data-preview-mode hidden>拖动旋转装置</span>
    </div>
    <div class="ct-preview-controls" hidden>
      <button type="button" data-preview="replay">重播展开</button>
      <button type="button" data-preview="rotate">旋转视角</button>
    </div>`;
    this.state = {opened:false, positions:apparatus.map(part=>part.id), running:false, ...gasAt(0), test:null};
    this.onAction = event => {
      const control = event.target.closest('[data-preview]');
      if (control?.dataset.preview === 'replay') this.replay();
      if (control?.dataset.preview === 'rotate' && this.state.opened) this.scene?.orbit(.43);
    };
    this.addEventListener('click',this.onAction);
    this.loadScene(this.querySelector('.ct-preview-canvas'));
  }

  async loadScene(canvasHost) {
    try {
      const {createBookScene} = await import('./chem-book-scene.js?v=4');
      if (!this.isConnected || canvasHost !== this.querySelector('.ct-preview-canvas')) return;
      this.scene = createBookScene(canvasHost, {
        place:()=>{}, miss:()=>{}, manual:()=>{}, contextLost:()=>this.showImage(), wheelZoom:false
      }, new Map());
      this.classList.add('is-live');
      this.querySelector('[data-preview-mode]').hidden = false;
      this.querySelector('.ct-preview-controls').hidden = false;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)');
      const rotateButton = this.querySelector('[data-preview="rotate"]');
      this.lastFrame = 0;
      this.delay = reduced.matches ? 0 : .52;
      this.state.opened = reduced.matches;
      rotateButton.disabled = !this.state.opened;
      this.observer = new IntersectionObserver(([entry]) => {
        this.inView = entry.isIntersecting;
        this.lastFrame = 0;
        if (this.inView && !this.frameId) this.frameId = requestAnimationFrame(this.draw);
      });
      this.observer.observe(canvasHost);
      this.draw = now => {
        this.frameId = 0;
        if (!this.scene || !this.inView) return;
        const delta = this.lastFrame ? Math.min(.055,(now-this.lastFrame)/1000) : .016;
        this.lastFrame = now;
        this.delay -= delta;
        if (!this.state.opened && (this.delay <= 0 || reduced.matches)) {
          this.state.opened = true;
          rotateButton.disabled = false;
        }
        this.scene.frame(this.state,delta);
        this.frameId = requestAnimationFrame(this.draw);
      };
    } catch {
      if (this.isConnected && canvasHost === this.querySelector('.ct-preview-canvas')) this.showImage();
    }
  }

  replay() {
    if (!this.scene) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.scene.view('bench');
      return;
    }
    this.state.opened = false;
    this.delay = 1.17;
    this.querySelector('[data-preview="rotate"]').disabled = true;
  }

  releaseScene() {
    this.observer?.disconnect();
    this.observer = null;
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.scene?.dispose();
    this.scene = null;
    this.inView = false;
  }

  showImage() {
    this.releaseScene();
    this.classList.remove('is-live');
    this.classList.add('is-fallback');
    this.querySelector('.ct-preview-stage img').hidden = false;
    this.querySelector('[data-preview-mode]').hidden = true;
    this.querySelector('.ct-preview-controls').hidden = true;
  }

  disconnectedCallback() {
    this.removeEventListener('click',this.onAction);
    this.releaseScene();
  }
}

if (!customElements.get('textbook-lab-preview')) {
  customElements.define('textbook-lab-preview',TextbookLabPreview);
}
