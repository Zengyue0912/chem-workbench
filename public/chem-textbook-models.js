// 课本章节页内嵌 3D 模型：复用工作台的分子建模器（window.B.molecule）
// 与共享查看器（chem-textbook-viewer.js），把每节已标的 model: 链接
// 直接在课本页里渲染成可拖拽旋转的 3D 模型，而不是只给一个跳转链接。

import {mountViews, unmountViews} from './chem-textbook-viewer.js?v=1';

const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[c]);

const MODE_KEY = 'ct-model-mode';

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
        `<button type="button" data-ct-view-chip="${escape(resource.id)}"
          data-ct-view-open="${escape(env.resourceHref(book, selected, resource))}"
          aria-pressed="${i === 0}">${escape(entry.name)}</button>`).join('')}</div>`
    : '';
  return `<section class="ct-models" aria-label="3D 模型">
    <div class="ct-models-head">
      <h3>3D 模型</h3>
      ${chips}
    </div>
    <div class="ct-model-view" data-ct-view data-ct-kind="model" data-ct-items="${models.map(({resource}) => resource.id).join(' ')}">
      <canvas class="ct-model-canvas" data-ct-view-canvas aria-label="${escape(first.entry.name)}三维模型，可拖动旋转"></canvas>
      <p class="ct-model-loading" data-ct-view-loading>正在加载 3D 模型…</p>
      <p class="ct-model-fallback" data-ct-view-fallback hidden>这台设备无法显示 3D 模型，
        <a data-ct-route href="${escape(env.resourceHref(book, selected, first.resource))}">在工作台中打开</a>试试。</p>
      <div class="ct-model-bar">
        <span class="ct-model-name" data-ct-view-name></span>
        <button type="button" data-ct-view-mode aria-label="切换球棍或空间填充模型">空间填充</button>
        <button type="button" data-ct-view-spin aria-pressed="true">旋转</button>
        <button type="button" data-ct-view-reset>复位</button>
        <a data-ct-view-open data-ct-route href="${escape(env.resourceHref(book, selected, first.resource))}">在工作台中打开 ↗</a>
      </div>
    </div>
    <p class="ct-model-hint">拖动旋转 · 滚轮或双指缩放</p>
  </section>`;
}

export function mountModels(host) {
  mountViews(host, 'model', () => {
    let mode = localStorage.getItem(MODE_KEY) === 'space' ? 'space' : 'ball';
    return {
      buildModel(id) {
        const entry = window.DB?.mols?.find(row => row.id === id);
        if (!entry || !window.B?.molecule) return null;
        try {
          const model = window.B.molecule(entry, mode);
          return model && model.parts?.length
            ? {model, nameHtml: `${escape(entry.name)} <i>${entry.formula || ''}</i>`,
               ariaLabel: entry.name + '三维模型，可拖动旋转'}
            : null;
        } catch {
          return null;
        }
      },
      mode: {
        label: () => mode === 'space' ? '球棍模型' : '空间填充',
        toggle() {
          mode = mode === 'space' ? 'ball' : 'space';
          localStorage.setItem(MODE_KEY, mode);
        }
      }
    };
  });
}

export function unmountModels() {
  unmountViews('model');
}
