import {apparatus, gasAt, maxTime, sampleTime, stages} from './chem-book-model.js?v=2';

const steps = ['预测', '搭装置', '看电极', '读曲线', '验气体', '归纳'];
const fields = [['情境', 'context'], ['要点', 'key'], ['结论', 'result'], ['易错', 'trap']];
const predictions = {h: '阴极更多', equal: '两边一样多', o: '阳极更多'};
const testText = {h: '点燃的木条靠近试样，发出短促的「噗」声。', o: '原本只有火星的木条重新燃烧。'};
const chart = {left: 43, base: 105, width: 382, height: 78};
const x = t => chart.left + t * chart.width / maxTime;
const y = ml => chart.base - ml * chart.height / 12;
const initial = () => ({opened: false, positions: [], running: false, ...gasAt(0), test: null, tested: []});

const chartMarkup = `<svg viewBox="0 0 453 132" role="img" aria-label="气体体积随通电时间变化曲线。实线表示氢气，虚线表示氧气。">
  <path d="M43 27V105H425" class="cb-axis"/>
  <path d="M43 27H425M43 66H425M234 27V105M425 27V105" class="cb-grid"/>
  <g class="cb-ticks"><text x="10" y="19">mL</text><text x="21" y="31">12</text><text x="26" y="70">6</text>
    <text x="26" y="109">0</text><text x="40" y="125">0</text><text x="226" y="125">12</text><text x="409" y="125">24 s</text></g>
  <path class="cb-line cb-blue" data-curve="h"/><path class="cb-line cb-orange" data-curve="o"/>
  <circle r="3.5" data-point="h" fill="#187d82"/><circle r="3.5" data-point="o" fill="#b6532b"/>
</svg>`;

const fallbackMarkup = `<div class="cb-fallback" aria-hidden="true">
  <div class="cb-flat-book"><div></div><div></div></div>
  <div class="cb-flat-apparatus">
    <div class="cb-tubes">
      <div><i class="cb-cell hydrogen"><span data-fill="h"></span><em>−</em></i><b>阴极 H₂</b></div>
      <div><i class="cb-cell oxygen"><span data-fill="o"></span><em>+</em></i><b>阳极 O₂</b></div>
    </div>
    <div class="cb-flat-base"></div>
  </div>
  <div class="cb-flat-test" hidden><i></i><b>验气试样</b></div>
</div>`;

class ChemistryBook extends HTMLElement {
  constructor() {
    super();
    this.state = initial();
    this.step = 0;
    this.frameId = 0;
    this.scene = null;
    this.audio = null;
    this.audioShot = null;
    this.guideEpoch = 0;
    this.view = 'bench';
    this.lastReading = '';
  }

  connectedCallback() {
    const context = this.pick('[data-book-context]');
    const reading = this.pick('[data-book-reading]');
    const inline = this.hasAttribute('embedded');
    this.innerHTML = `<header class="cb-header">
      ${context ? '' : '<div class="cb-heading"><div class="cb-subtitle">3D 化学课本 <span>／</span> 电化学</div><h1>电解水</h1></div>'}
      <div class="cb-head-actions">
        <button type="button" data-book="notes" aria-controls="cb-handout" aria-expanded="true">收起讲义</button>
        <button type="button" data-book="fullscreen">课堂全屏</button>
        <button type="button" data-book="reset">从头再来</button>
      </div>
    </header>
    <nav class="cb-stages" aria-label="课堂进度">${steps.map((label, i) =>
      `<button type="button" data-step="${i}"><span aria-hidden="true">${i + 1}</span>${label}</button>`).join('')}</nav>
    <div class="cb-spread">
      <article class="cb-left" id="cb-handout" aria-label="左页讲义">
        <div class="cb-lesson-count" data-role="progress"></div>
        <h2 data-role="title"></h2>
        <dl class="cb-notes">${fields.map(([label, key]) =>
          `<div><dt>${label}</dt><dd data-lesson="${key}"></dd></div>`).join('')}</dl>
        <div class="cb-page-actions"><button type="button" data-book="prev">上一步</button><button type="button" data-book="next">下一步</button></div>
        <section class="cb-guide">
          <div><button type="button" data-book="hint">给个提示</button><button type="button" data-book="model" hidden>问在线助教</button></div>
          <p data-role="hint" role="status" hidden></p>
        </section>
      </article>
      <section class="cb-right" aria-label="右页实验">
        <div class="cb-stage-shell">
          <div class="cb-stage" aria-hidden="true"></div>
          ${fallbackMarkup}
          <div class="cb-stage-heading">
            <b data-role="view-title">书页上的电解装置</b>
            <span data-role="render-mode" hidden>平面视图</span>
          </div>
          <div class="cb-markers" aria-hidden="true">
            <span data-marker="hydrogen" hidden>阴极 <strong>−</strong></span>
            <span data-marker="oxygen" hidden>阳极 <strong>＋</strong></span>
            <span data-marker="power" hidden>电源</span>
          </div>
          <div class="cb-camera" hidden aria-label="视角操作">
            <button type="button" data-book="focus" aria-pressed="false">电极近景</button>
            <button type="button" data-book="turn" aria-label="向右旋转视角" title="旋转视角">↻</button>
            <button type="button" data-book="zoom" aria-label="放大视角" title="放大">＋</button>
            <button type="button" data-book="out" aria-label="缩小视角" title="缩小">−</button>
            <button type="button" data-book="overview">全景</button>
          </div>
          <div class="cb-stage-legend" hidden>
            <span class="cb-h"><i></i>阴极 − · H₂</span><span class="cb-o"><i></i>阳极 ＋ · O₂</span>
          </div>
          <div class="cb-test-caption" hidden><b data-role="sample-title"></b><p data-role="sample-text"></p></div>
          ${inline ? '<button class="cb-primary cb-illustration-trigger" type="button" data-book="open">让装置立起来</button>' : ''}
        </div>
        <div class="cb-intro">
          <div class="cb-predict" role="group" aria-label="预测哪侧气体更多">${Object.entries(predictions).map(([key, label]) =>
            `<button type="button" data-predict="${key}" aria-pressed="false">${label}</button>`).join('')}</div>
          ${inline ? '' : '<button class="cb-primary cb-open" type="button" data-book="open">展开立体实验 <span aria-hidden="true">↗</span></button>'}
        </div>
        <div class="cb-controls" hidden>
          <div class="cb-build" aria-label="器材选择">${apparatus.map(part =>
            `<button type="button" data-part="${part.id}">放上${part.name}</button>`).join('')}</div>
          <div class="cb-actions">
            <button class="cb-primary" type="button" data-book="power">通电</button>
            <button type="button" data-book="test-h">检验氢气</button><button type="button" data-book="test-o">检验氧气</button>
            <label><input type="checkbox" data-role="sound" checked> 声音</label>
          </div>
        </div>
        <p class="cb-state" data-role="status" role="status"></p>
        <div class="cb-data" hidden>
          <div class="cb-data-head"><h2>集气体积</h2><span>理想模拟值 · 同温同压</span></div>
          <div class="cb-meters">
            <div class="cb-h"><span>阴极 H₂</span><output data-gas="h" aria-live="off">0.0 mL</output></div>
            <div class="cb-o"><span>阳极 O₂</span><output data-gas="o" aria-live="off">0.0 mL</output></div>
            <div><span>氢气∶氧气</span><output data-gas="ratio" aria-live="off">—</output></div>
          </div>
          ${chartMarkup}
          <p class="cb-prediction-result" data-role="prediction-result" hidden></p>
        </div>
      </section>
    </div>`;
    if (context) this.pick('.cb-header').prepend(context);
    if (reading) this.pick('.cb-left').append(reading);
    this.onClick = event => this.click(event);
    this.onFullscreen = () => this.updateFullscreen();
    this.onKey = event => {
      if (event.key === 'Escape' && this.classList.contains('cb-present')) this.setPresentation(false);
    };
    this.addEventListener('click', this.onClick);
    document.addEventListener('fullscreenchange', this.onFullscreen);
    document.addEventListener('keydown', this.onKey);
    this.setNotes(this.clientWidth > 690);
    this.reset();
    this.loadScene();
    this.checkModel();
    this.startLoop();
  }

  disconnectedCallback() {
    this.guideEpoch++;
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.removeEventListener('click', this.onClick);
    document.removeEventListener('fullscreenchange', this.onFullscreen);
    document.removeEventListener('keydown', this.onKey);
    this.setPresentation(false);
    this.scene?.dispose();
    this.scene = null;
    this.stopSound();
    this.audio?.close().catch(() => {});
    this.audio = null;
  }

  pick(selector) { return this.querySelector(selector); }
  book(action) { return this.pick('[data-book="' + action + '"]'); }
  role(key) { return this.pick('[data-role="' + key + '"]'); }
  setStatus(value) { this.role('status').textContent = value; }

  setStep(next) {
    this.step = Math.max(0, Math.min(stages.length - 1, next));
    this.guideEpoch++;
    const page = stages[this.step];
    this.role('title').textContent = page.title;
    this.role('progress').textContent = '课堂讲义 · ' + steps[this.step];
    for (const [, key] of fields) this.pick('[data-lesson="' + key + '"]').textContent = page[key];
    this.querySelectorAll('[data-step]').forEach(button => {
      button.setAttribute('aria-current', Number(button.dataset.step) === this.step ? 'step' : 'false');
    });
    this.book('prev').disabled = this.step === 0;
    this.book('next').disabled = this.step === stages.length - 1;
    this.role('hint').hidden = true;
  }

  async loadScene() {
    const canvasHost = this.pick('.cb-stage');
    try {
      const {createBookScene} = await import('./chem-book-scene.js?v=4');
      if (!this.isConnected || canvasHost !== this.pick('.cb-stage')) return;
      const markers = new Map([...this.querySelectorAll('[data-marker]')].map(node => [node.dataset.marker, node]));
      this.scene = createBookScene(canvasHost, {
        place: id => this.place(id),
        miss: id => this.miss(id),
        manual: () => { if (this.view !== 'manual') this.setView('manual'); },
        contextLost: () => this.useFlatView(),
        inline: this.hasAttribute('embedded')
      }, markers);
      this.classList.add('cb-has-3d');
      this.update();
    } catch {
      if (this.isConnected && canvasHost === this.pick('.cb-stage')) this.useFlatView();
    }
  }

  useFlatView() {
    this.scene?.dispose();
    this.scene = null;
    this.classList.remove('cb-has-3d');
    this.role('render-mode').hidden = false;
    this.querySelectorAll('[data-marker]').forEach(node => { node.hidden = true; });
    this.update();
  }

  openExperiment() {
    if (this.state.opened) return;
    this.state.opened = true;
    this.setStep(1);
    this.setView('bench');
    this.setStatus('拖器材到对应位置，或点下方名称。拖空白处可转动视角。');
    this.update();
    this.pick('[data-part]').focus({preventScroll: true});
  }

  place(id) {
    const part = apparatus.find(item => item.id === id);
    if (!part || !this.state.opened || this.state.positions.includes(id)) return;
    this.state.positions = [...this.state.positions, id];
    if (this.state.positions.length === apparatus.length) {
      this.setStep(2);
      this.setStatus('装置已接好。点「通电」，观察电极附近先发生了什么。');
    } else {
      this.setStatus(part.name + '已就位。');
    }
    this.update();
    if (document.activeElement?.dataset.part === id) {
      (this.pick('[data-part]:enabled') ?? this.book('power')).focus({preventScroll: true});
    }
  }

  miss(id) {
    const part = apparatus.find(item => item.id === id);
    this.setStatus(part.name + '回到原位。拖动时，目标位置会亮起。');
  }

  setNotes(visible) {
    this.classList.toggle('cb-hide-notes', !visible);
    this.book('notes').setAttribute('aria-expanded', String(visible));
    this.book('notes').textContent = visible ? '收起讲义' : '展开讲义';
  }

  setView(name) {
    this.view = name;
    if (name !== 'manual') this.scene?.view(name);
    this.book('focus').setAttribute('aria-pressed', String(name === 'electrodes'));
    this.renderViewTitle();
  }

  renderViewTitle() {
    const mode = {bench: '装置全景', electrodes: '电极近景', sample: '气体检验', manual: '自由视角'};
    this.role('view-title').textContent = this.state.opened ? mode[this.view] : '书页上的电解装置';
  }

  power() {
    const state = this.state;
    if (state.positions.length < apparatus.length || state.time >= maxTime || state.test) return;
    state.running = !state.running;
    if (state.running) {
      this.setView('electrodes');
      this.setStep(2);
      this.setStatus('已通电。看气泡从电极处升起，再比较两根管子的液面。');
    } else {
      if (state.time >= 1) this.setStep(3);
      this.setStatus(state.time >= sampleTime
        ? '已暂停。比较同一时刻的读数，也可以开始验气。'
        : '已暂停。继续通电一会儿，收集到试样后即可检验。');
    }
    this.update();
  }

  stopSound() {
    if (!this.audioShot) return;
    try { this.audioShot.stop(); } catch {}
    this.audioShot = null;
  }

  sound(test) {
    if (!this.role('sound').checked) return;
    const Engine = window.AudioContext || window.webkitAudioContext;
    if (!Engine) return;
    try {
      this.audio ??= new Engine();
      const audio = this.audio;
      audio.resume().then(() => {
        if (!this.isConnected || this.state.test !== test || audio.state !== 'running') return;
        const rate = audio.sampleRate;
        const samples = audio.createBuffer(1, Math.floor(rate * .14), rate);
        const data = samples.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          const t = i / rate;
          const crack = (Math.random() * 2 - 1) * .67 + Math.sin(2 * Math.PI * 370 * t) * .33;
          data[i] = crack * Math.exp(-t * 54) * Math.min(1, t * 1800);
        }
        const shot = audio.createBufferSource(), gain = audio.createGain();
        shot.buffer = samples;
        gain.gain.value = .32;
        shot.connect(gain).connect(audio.destination);
        this.audioShot = shot;
        shot.start(audio.currentTime + Math.max(0, .65 - test.elapsed));
      }).catch(() => {});
    } catch {}
  }

  test(gas) {
    if (this.state.running || this.state.time < sampleTime || this.state.test) return;
    this.setStep(4);
    this.state.test = {gas, elapsed: 0, showedResult: false};
    this.setView('sample');
    this.setStatus(gas === 'h' ? '正在检验阴极的氢气试样。' : '正在检验阳极的氧气试样。');
    if (gas === 'h') this.sound(this.state.test);
    this.update();
  }

  async checkModel() {
    if (location.protocol === 'file:') return;
    const button = this.book('model');
    try {
      const response = await fetch('/api/data/study/status', {cache: 'no-store'});
      if (!response.ok) return;
      const status = await response.json();
      if (this.isConnected && this.book('model') === button && status.configured && status.available) button.hidden = false;
    } catch {}
  }

  showHint(online = false) {
    const out = this.role('hint'), page = stages[this.step], token = ++this.guideEpoch;
    const {time, h, o} = this.state;
    out.hidden = false;
    out.textContent = online ? '正在准备提示…' : page.hint;
    if (!online) return;
    const context = time > 0 ? ' 当前模拟值是氢气 ' + h.toFixed(1) + ' mL、氧气 ' + o.toFixed(1) + ' mL。' : '';
    fetch('/api/data/study/guide', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        mode: 'practice',
        question: '电解水课堂提示。' + page.context + ' ' + page.key + context,
        thought: '请用一个问题引导我观察当前步骤。'
      })
    }).then(response => response.ok ? response.json() : null).then(data => {
      if (this.isConnected && token === this.guideEpoch) out.textContent = data?.answer || page.hint;
    }).catch(() => {
      if (this.isConnected && token === this.guideEpoch) out.textContent = page.hint;
    });
  }

  reset() {
    this.stopSound();
    this.lastReading = '';
    this.predicted = null;
    this.state = initial();
    this.querySelectorAll('[data-predict]').forEach(button => button.setAttribute('aria-pressed', 'false'));
    this.setStep(0);
    this.setView('paper');
    this.update();
    this.setStatus('先选一个猜想，再展开装置找证据。');
  }

  updateFullscreen() {
    const active = document.fullscreenElement === this || this.classList.contains('cb-present');
    this.book('fullscreen').textContent = active ? '退出全屏' : '课堂全屏';
  }

  setPresentation(active) {
    this.classList.toggle('cb-present', active);
    this.updateFullscreen();
  }

  async toggleFullscreen() {
    if (document.fullscreenElement === this) {
      await document.exitFullscreen();
    } else if (this.classList.contains('cb-present')) {
      this.setPresentation(false);
    } else {
      try {
        if (!this.requestFullscreen) throw new Error();
        await this.requestFullscreen();
      } catch {
        this.setPresentation(true);
      }
    }
  }

  click(event) {
    const button = event.target.closest('button');
    if (!button || !this.contains(button)) return;
    if (button.dataset.step !== undefined) {
      this.setStep(Number(button.dataset.step));
      this.setNotes(true);
      return;
    }
    if (button.dataset.part) return this.place(button.dataset.part);
    if (button.dataset.predict) {
      this.predicted = button.dataset.predict;
      this.querySelectorAll('[data-predict]').forEach(item =>
        item.setAttribute('aria-pressed', String(item === button)));
      this.setStatus('已记录猜想。展开装置后，用读数核对。');
      return;
    }
    switch (button.dataset.book) {
      case 'open': this.openExperiment(); break;
      case 'prev': this.setStep(this.step - 1); break;
      case 'next': this.setStep(this.step + 1); break;
      case 'notes': this.setNotes(this.classList.contains('cb-hide-notes')); break;
      case 'focus': this.setView(this.view === 'electrodes' ? 'bench' : 'electrodes'); break;
      case 'overview': this.setView('bench'); break;
      case 'turn': this.setView('manual'); this.scene?.orbit(.35); break;
      case 'zoom': this.setView('manual'); this.scene?.zoom(-.49); break;
      case 'out': this.setView('manual'); this.scene?.zoom(.49); break;
      case 'power': this.power(); break;
      case 'test-h': this.test('h'); break;
      case 'test-o': this.test('o'); break;
      case 'hint': this.showHint(); break;
      case 'model': this.showHint(true); break;
      case 'reset': this.reset(); break;
      case 'fullscreen': this.toggleFullscreen().catch(() => this.updateFullscreen()); break;
    }
  }

  update() {
    const {opened, positions, running, time, test, tested} = this.state;
    this.classList.toggle('cb-opened', opened);
    this.classList.toggle('cb-running', running);
    this.pick('.cb-intro').hidden = opened;
    if (this.hasAttribute('embedded')) this.book('open').hidden = opened;
    this.pick('.cb-controls').hidden = !opened;
    this.pick('.cb-data').hidden = !opened;
    this.pick('.cb-camera').hidden = !(opened && this.scene && !test);
    this.pick('.cb-stage-legend').hidden = !(opened && positions.length === apparatus.length && !test);
    this.pick('.cb-test-caption').hidden = !test;
    this.pick('.cb-flat-test').hidden = !test;
    this.pick('.cb-flat-test').dataset.result = test?.showedResult ? test.gas : '';
    this.pick('.cb-flat-apparatus').hidden = !opened || Boolean(test);
    this.pick('.cb-build').hidden = positions.length === apparatus.length;
    this.querySelectorAll('[data-part]').forEach(button => {
      const part = apparatus.find(item => item.id === button.dataset.part);
      button.disabled = positions.includes(part.id);
      button.textContent = button.disabled ? part.name + '已就位' : '放上' + part.name;
    });
    this.book('power').textContent = running ? '暂停通电' : time >= maxTime ? '采样完成' : time > 0 ? '继续通电' : '通电';
    this.book('power').disabled = positions.length < apparatus.length || time >= maxTime || Boolean(test);
    for (const [id, name] of [['h', '氢气'], ['o', '氧气']]) {
      const button = this.book('test-' + id);
      button.disabled = running || time < sampleTime || Boolean(test);
      button.textContent = (tested.includes(id) ? '重看' : '检验') + name;
    }
    if (test) {
      this.role('sample-title').textContent = test.gas === 'h' ? '阴极试样 · 氢气' : '阳极试样 · 氧气';
      this.role('sample-text').textContent = test.showedResult ? testText[test.gas] :
        test.gas === 'h' ? '观察点燃的木条。' : '观察只有火星的木条。';
    }
    this.renderViewTitle();
    this.updateReadings();
  }

  updateReadings() {
    const {time, h, o} = this.state;
    const sampledO = Math.floor((o + 1e-8) * 10) / 10;
    const key = sampledO.toFixed(1);
    if (this.lastReading !== key) {
      this.lastReading = key;
      this.pick('[data-gas="h"]').textContent = (sampledO * 2).toFixed(1) + ' mL';
      this.pick('[data-gas="o"]').textContent = key + ' mL';
      this.pick('[data-gas="ratio"]').textContent = sampledO > 0 ? '2∶1' : '—';
    }
    for (const [gas, value] of [['h', h], ['o', o]]) {
      const dot = this.pick('[data-point="' + gas + '"]');
      this.pick('[data-curve="' + gas + '"]').setAttribute('d', `M${x(0)} ${y(0)} L${x(time)} ${y(value)}`);
      dot.setAttribute('cx', x(time));
      dot.setAttribute('cy', y(value));
      this.pick('[data-fill="' + gas + '"]').style.height = (100 - value * 5.45) + '%';
    }
    const result = this.role('prediction-result');
    const checked = time >= sampleTime && this.predicted;
    result.hidden = !checked;
    if (checked && !result.textContent) {
      result.textContent = '你的猜想是「' + predictions[this.predicted] + '」。读数显示阴极气体体积更大。';
    } else if (!checked && result.textContent) {
      result.textContent = '';
    }
  }

  startLoop() {
    let last = performance.now();
    const render = now => {
      const elapsed = Math.max(0, (now - last) / 1000);
      const dt = Math.min(.05, elapsed);
      last = now;
      const state = this.state;
      if (state.running) {
        Object.assign(state, gasAt(state.time + Math.min(.25, elapsed)));
        this.updateReadings();
        if (state.time >= maxTime) {
          state.running = false;
          this.setStep(3);
          this.update();
          this.setStatus('采样完成。用曲线读出体积比，或分别检验两份试样。');
        }
      } else if (state.test) {
        state.test.elapsed += Math.min(.25, elapsed);
        if (!state.test.showedResult && state.test.elapsed >= .65) {
          state.test.showedResult = true;
          this.setStatus(testText[state.test.gas]);
          this.update();
        } else if (state.test.elapsed >= 3.15) {
          const gas = state.test.gas;
          state.test = null;
          if (!state.tested.includes(gas)) state.tested.push(gas);
          this.setView('bench');
          if (state.tested.length === 2) {
            this.setStep(5);
            this.setStatus('两种气体都已检验。结合体积比和木条的现象，说说你的结论。');
          }
          this.update();
        }
      }
      this.scene?.frame(state, dt);
      this.frameId = requestAnimationFrame(render);
    };
    this.frameId = requestAnimationFrame(render);
  }
}

if (!customElements.get('chemistry-book')) customElements.define('chemistry-book', ChemistryBook);
