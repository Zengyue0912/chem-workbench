// 课本章节页内嵌实验模拟：把每节已标的 lab: 链接直接在课本页里展开——
// 3D 实验装置（可拖拽旋转）+ 分步操作 + 现象与注意事项，一键进入工作台做完整虚拟操作。
// 装置模型复用工作台 SIM.setup 的建模逻辑：调用时快照并还原 VW/E3 的共享状态，
// 绝不干扰工作台舞台；完整动画（钠游动、滴定、焰色等）仍在工作台舞台里运行。
// 注意：lab:water（电解池）已有专属互动课，不走这里。

import {mountViews, unmountViews} from './chem-textbook-viewer.js?v=1';

const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[c]);

function labEntries(selected, env) {
  return selected.links.map(key => env.resource(key))
    .filter(resource => resource && resource.type === 'lab' && resource.id !== 'water')
    .map(resource => {
      const exp = window.DB?.exps?.find(row => row.id === resource.id);
      return exp ? {resource, exp} : null;
    })
    .filter(Boolean);
}

// 借 SIM.setup 生成装置模型：setup 会写 VW.model/VW.asm/VW.expPitch 并调 fitModel
// （改 E3.cam 与 VW 的缩放基准），调用前后完整快照还原，工作台舞台不受影响。
function buildApparatus(exp) {
  const {VW, E3, SIM} = window;
  if (!VW || !E3?.cam || !SIM?.setup) return null;
  const save = {model:VW.model, asm:VW.asm, expPitch:VW.expPitch,
    minD:VW.minD, maxD:VW.maxD, baseD:VW.baseD, vyaw:VW.vyaw, vpitch:VW.vpitch,
    cam:{...E3.cam}};
  try {
    SIM.setup(exp, {item:exp, step:0, stepT:0, playing:false, done:false, st:{}});
    const model = VW.model;
    return model && model.parts?.length ? model : null;
  } catch {
    return null;
  } finally {
    VW.model = save.model; VW.asm = save.asm; VW.expPitch = save.expPitch;
    VW.minD = save.minD; VW.maxD = save.maxD; VW.baseD = save.baseD;
    VW.vyaw = save.vyaw; VW.vpitch = save.vpitch;
    Object.assign(E3.cam, save.cam);
  }
}

const openLabel = exp => exp.sim === 'static' ? '打开 3D 装置 ↗' : '进入虚拟操作 ↗';

export function labMarkup(book, selected, env) {
  const labs = labEntries(selected, env);
  if (!labs.length) return '';
  const first = labs[0];
  const chips = labs.length > 1
    ? `<div class="ct-models-chips" role="group" aria-label="选择实验">${labs.map(({resource, exp}, i) =>
        `<button type="button" data-ct-view-chip="${escape(resource.id)}"
          data-ct-view-open="${escape(env.resourceHref(book, selected, resource))}"
          aria-pressed="${i === 0}">${escape(exp.name)}</button>`).join('')}</div>`
    : '';
  return `<section class="ct-labs" data-ct-labs aria-label="实验模拟">
    <div class="ct-models-head">
      <h3>实验模拟</h3>
      ${chips}
    </div>
    <div class="ct-model-view" data-ct-view data-ct-kind="lab" data-ct-items="${labs.map(({resource}) => resource.id).join(' ')}">
      <canvas class="ct-model-canvas" data-ct-view-canvas aria-label="${escape(first.exp.name)}三维实验装置，可拖动旋转"></canvas>
      <p class="ct-model-loading" data-ct-view-loading>正在加载实验装置…</p>
      <div class="ct-model-fallback" data-ct-view-fallback hidden>
        <img data-ct-lab-fallback-img src="assets/spatial/exp-${escape(first.exp.id)}.webp" alt="${escape(first.exp.name)}装置图">
        <p>这台设备无法显示 3D 装置，
          <a data-ct-route href="${escape(env.resourceHref(book, selected, first.resource))}">在工作台中打开</a>试试。</p>
      </div>
      <div class="ct-model-bar">
        <span class="ct-model-name" data-ct-view-name></span>
        <button type="button" data-ct-view-spin aria-pressed="true">旋转</button>
        <button type="button" data-ct-view-reset>复位</button>
        <a data-ct-view-open data-ct-route href="${escape(env.resourceHref(book, selected, first.resource))}">${openLabel(first.exp)}</a>
      </div>
    </div>
    <div class="ct-lab-steps" data-ct-lab-steps>
      <div class="ct-lab-strip" role="group" aria-label="实验步骤" data-ct-lab-strip></div>
      <p class="ct-lab-step-text" data-ct-lab-step-text></p>
    </div>
    <details class="ct-lab-more"><summary>实验原理、现象与注意事项</summary>
      <div data-ct-lab-more></div>
    </details>
  </section>`;
}

function showStep(section, exp, index) {
  const strip = section.querySelector('[data-ct-lab-strip]');
  const text = section.querySelector('[data-ct-lab-step-text]');
  strip.querySelectorAll('button').forEach((button, i) =>
    button.setAttribute('aria-pressed', String(i === index)));
  const step = exp.steps[index];
  text.innerHTML = `<strong>第 ${index + 1} 步 · ${escape(step.t)}</strong>${escape(step.txt)}`;
}

function showLab(section, id) {
  const exp = window.DB.exps.find(row => row.id === id);
  if (!exp) return;
  const strip = section.querySelector('[data-ct-lab-strip]');
  strip.replaceChildren(...exp.steps.map((step, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = String(i + 1);
    button.setAttribute('aria-label', `第 ${i + 1} 步：${step.t}`);
    button.setAttribute('aria-pressed', String(i === 0));
    button.addEventListener('click', () => showStep(section, exp, i));
    return button;
  }));
  showStep(section, exp, 0);
  const more = section.querySelector('[data-ct-lab-more]');
  const list = items => items?.length
    ? `<ul>${items.map(item => `<li>${escape(item)}</li>`).join('')}</ul>` : '';
  more.innerHTML = (exp.principle ? `<p><strong>原理：</strong>${escape(exp.principle)}</p>` : '') +
    (exp.phenomena?.length ? `<p><strong>现象：</strong></p>${list(exp.phenomena)}` : '') +
    (exp.safety?.length ? `<p><strong>注意：</strong></p>${list(exp.safety)}` : '');
  const openLink = section.querySelector('[data-ct-view] [data-ct-view-open]');
  if (openLink) openLink.textContent = openLabel(exp);
  const fallbackImg = section.querySelector('[data-ct-lab-fallback-img]');
  if (fallbackImg) {
    fallbackImg.src = `assets/spatial/exp-${exp.id}.webp`;
    fallbackImg.alt = exp.name + '装置图';
  }
}

export function mountLabs(host) {
  for (const section of host.querySelectorAll('[data-ct-labs]:not([data-ct-mounted])')) {
    section.dataset.ctMounted = '1';
    const firstId = section.querySelector('[data-ct-view]')?.dataset.ctItems?.split(' ')[0];
    if (firstId) showLab(section, firstId);
  }
  mountViews(host, 'lab', view => ({
    buildModel(id) {
      const exp = window.DB?.exps?.find(row => row.id === id);
      if (!exp) return null;
      const model = buildApparatus(exp);
      return model
        ? {model,
           nameHtml: `${escape(exp.name)} <i>${exp.sim === 'static' ? '3D 观察' : '虚拟操作'}</i>`,
           ariaLabel: exp.name + '三维实验装置，可拖动旋转'}
        : null;
    },
    onSwitch(id) {
      const section = view.closest('[data-ct-labs]');
      if (section) showLab(section, id);
    }
  }));
}

export function unmountLabs() {
  unmountViews('lab');
}
