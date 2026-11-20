/* ============================================================================
 * 高中化学 3D 考点工作台 — 拍照解题 OCR（CDN 版）+ 解题历史与错题联动（v2.2.0 / C 组）
 *
 * 背景：原 js/student-question-ocr.js（禁止修改）从本站 assets/question-ocr/
 * 加载 Tesseract，但该目录资源缺失，拍照功能是断的。本模块不改动原文件，
 * 而是在 window 上用 Object.defineProperty 定义 ChemQuestionOCR 访问器：
 * getter 始终返回本模块的 CDN 版实现，setter 吞掉原模块懒加载时的赋值，
 * 因此无论加载顺序如何，student-study.js 拿到的 recognize 都是可用的。
 * （原模块是 plain 赋值，可配置，故 defineProperty 一定能覆盖；万一失败则
 * 降级为直接赋值 + 1 秒轮询守护。）
 *
 * 本模块须在首次 ChemLazy.load('study') 之前加载（协调员集成时放入首屏
 * 核心脚本），否则首次进入解题页时原模块会先占位（之后本模块加载仍可接管）。
 *
 * CDN（版本号写死，不用 latest）：
 *   脚本/worker：tesseract.js@5.1.1（jsdelivr）
 *   核心：tesseract.js-core@5.1.1（jsdelivr 目录；worker 按设备选 SIMD/LSTM 构建）
 *   语言包：不显式传 langPath——tesseract.js v5 在 langPath 缺省时按语言分别
 *   从 jsdelivr 的 @tesseract.js-data/<lang>/4.0.0_best_int 拉取 LSTM 专用数据
 *   （chi_sim 约 1.7 MB、eng 约 3 MB）；单个 langPath 无法同时服务两个语言包，
 *   故沿用库内建默认值（源码见 tesseract.js@5.1.1 src/worker-script/index.js
 *   loadLanguage）。语言包只走 jsdelivr，不走 tessdata.projectnaptha.com。
 * 引擎按需懒加载：只在用户点拍照/选择图片时加载，不进首屏。
 *
 * 隐私：图片只在本机经 Tesseract.js 本地运算，不上传任何服务器；仅从
 * jsdelivr 下载引擎/语言包文件（与加载普通 CDN 脚本相同）。
 *
 * 对外接口：
 *   window.ChemQuestionOCR.recognize(file, {signal, onProgress})
 *     与原接口签名兼容，返回 {text, confidence}，支持 AbortSignal 取消与超时。
 *   window.ChemSolveOCR.openPhotoSolve()
 *     v2.2.0 拍照入口：选图（移动端调后置摄像头）→ 识别 → 可编辑确认框 →
 *     “开始解题”调用 ChemSolveFlow.start()（B 组未交付时回退为填入
 *     #studyQuestion 并提示手动提交）；CDN 不可达时给中文提示 + 手动输入兜底。
 *   window.ChemSolveOCR.startSolve(text, source)：确认后的启动逻辑（可复用）。
 *   window.ChemSolveHistory：解题历史（localStorage 键
 *     chem3d_v2_solve_history_v1，上限 100 条），list()/record()/clear()；
 *     B 组可在解题完成时调用 record()，或派发 CustomEvent('chem:solve-complete',
 *     {detail:{question, method, result, source}})，本模块自动记入。
 *   window.ChemSolveMistakes：错题联动，复用现有错题本存储 chem_mistakes_v1
 *    （与 ChemMistakes.record 同结构，见 js/inline-09-studio.js），
 *     markNotUnderstood()/markVariantWrong()/markUnderstood()/list()。
 * ========================================================================== */
(function () {
'use strict';

/* ---------- CDN 配置（版本号写死；config 仅供测试与紧急切换，正常使用不要改） ---------- */
var TESS_VERSION = '5.1.1';
var CORE_VERSION = '5.1.1';
var CDN = 'https://cdn.jsdelivr.net/npm/';
var CFG = {
  scriptUrl: CDN + 'tesseract.js@' + TESS_VERSION + '/dist/tesseract.min.js',
  workerUrl: CDN + 'tesseract.js@' + TESS_VERSION + '/dist/worker.min.js',
  coreUrl: CDN + 'tesseract.js-core@' + CORE_VERSION
};
var LANGS = ['chi_sim', 'eng'];
var SCRIPT_TIMEOUT_MS = 15000;      /* CDN 脚本加载超时 */
var RECOGNIZE_TIMEOUT_MS = 45000;   /* 单次识别超时（与原模块一致） */
var MAX_IMAGE_BYTES = 10 * 1024 * 1024;
var IMAGE_TYPE_RE = /^image\/(?:png|jpeg|webp|bmp|gif)$/;

/* ---------- 小工具 ---------- */
function $(id) { return document.getElementById(id); }
function toast(msg) {
  var t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
}

/* ---------- 引擎懒加载（只在首次识别时从 CDN 拉取脚本） ---------- */
var enginePromise = null;
function loadEngine() {
  if (enginePromise) return enginePromise;
  enginePromise = new Promise(function (resolve, reject) {
    if (window.Tesseract && typeof window.Tesseract.createWorker === 'function') {
      resolve(window.Tesseract);
      return;
    }
    var script = document.createElement('script');
    var done = false;
    var timer = setTimeout(function () { fail(new Error('CDN_TIMEOUT')); }, SCRIPT_TIMEOUT_MS);
    function cleanup() {
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
    }
    function fail(err) {
      if (done) return;
      done = true;
      cleanup();
      if (script.parentNode) script.parentNode.removeChild(script);
      enginePromise = null; /* 允许下次重试 */
      reject(err);
    }
    script.onload = function () {
      if (done) return;
      done = true;
      cleanup();
      if (window.Tesseract && typeof window.Tesseract.createWorker === 'function') {
        resolve(window.Tesseract);
      } else {
        enginePromise = null;
        reject(new Error('CDN_BAD_LIB'));
      }
    };
    script.onerror = function () { fail(new Error('CDN_LOAD_FAIL')); };
    script.src = CFG.scriptUrl;
    script.async = true;
    document.head.appendChild(script);
  });
  return enginePromise;
}

/* ---------- 图片预处理（与原模块同逻辑：限像素、缩放、白底） ---------- */
function prepareImage(file) {
  var objectUrl = URL.createObjectURL(file);
  return Promise.resolve().then(function () {
    var img = new Image();
    img.src = objectUrl;
    return img.decode().then(function () {
      var width = img.naturalWidth, height = img.naturalHeight;
      if (width * height > 40000000) throw new Error('图片像素太大，请截取题目所在区域后再试。');
      var scale = Math.min(width < 1000 ? 1.5 : 1, 2800 / Math.max(width, height));
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas;
    });
  }).finally(function () {
    URL.revokeObjectURL(objectUrl);
  });
}

/* 去掉汉字之间的多余空格，压缩空行（与原模块同逻辑）。 */
function cleanText(value) {
  return String(value || '').split(/\r?\n/).map(function (line) {
    return line.trim().replace(/(?<=\p{Script=Han})[ \t]+(?=\p{Script=Han})/gu, '');
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ---------- recognize：与原接口签名兼容 ---------- */
async function recognize(file, opts) {
  opts = opts || {};
  var signal = opts.signal || null;
  var onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
  var worker = null;
  var timeoutId = null;
  var release = function () {
    var current = worker;
    worker = null;
    if (current) {
      try {
        var p = current.terminate();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (e) { /* 忽略释放异常 */ }
    }
  };
  var stop = new AbortController();
  var cancel = function () { stop.abort(signal.reason); };
  if (signal) {
    if (signal.aborted) cancel();
    else signal.addEventListener('abort', cancel, { once: true });
  }
  var pending = new Promise(function (_, reject) {
    var rejectRun = function () { release(); reject(stop.signal.reason); };
    if (stop.signal.aborted) rejectRun();
    else stop.signal.addEventListener('abort', rejectRun, { once: true });
  });
  timeoutId = setTimeout(function () {
    stop.abort(new Error('识别超时，请只截取一道题再试。'));
  }, RECOGNIZE_TIMEOUT_MS);
  var run = async function () {
    var parts = await Promise.all([loadEngine(), prepareImage(file)]);
    var lib = parts[0];
    var canvas = parts[1];
    stop.signal.throwIfAborted();
    worker = await lib.createWorker(LANGS.slice(), 1, {
      workerPath: CFG.workerUrl,
      corePath: CFG.coreUrl,
      /* 不传 langPath：v5 缺省时按语言分别从 jsdelivr 取 @tesseract.js-data 数据；
         单一 langPath 无法同时服务 chi_sim 与 eng 两个包。 */
      workerBlobURL: false,
      errorHandler: function (error) { stop.abort(new Error(String(error))); },
      logger: function (info) {
        if (!stop.signal.aborted && info && info.status === 'recognizing text' && onProgress) {
          onProgress(info.progress);
        }
      }
    });
    if (stop.signal.aborted) {
      release();
      stop.signal.throwIfAborted();
    }
    var res = await worker.recognize(canvas);
    var data = (res && res.data) || {};
    return { text: cleanText(data.text || ''), confidence: data.confidence };
  };
  try {
    return await Promise.race([pending, run()]);
  } catch (error) {
    if (error && error.name === 'AbortError') throw error;
    var msg = (error && error.message) || '';
    if (msg.indexOf('图片像素太大') === 0 || msg.indexOf('识别超时') === 0) throw error;
    if (msg === 'CDN_LOAD_FAIL' || msg === 'CDN_TIMEOUT' || msg === 'CDN_BAD_LIB' ||
        msg.indexOf('Network error') === 0 || msg.indexOf('Failed to fetch') === 0 ||
        msg.indexOf('Load failed') === 0) {
      throw new Error('识字组件加载失败：无法访问 jsDelivr CDN，请检查网络后重试，也可以直接在题目框输入文字。');
    }
    throw new Error('没能识别这张图。请换一张清晰截图，或直接输入题目。');
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', cancel);
    release();
  }
}

/* ---------- 访问器拦截：getter 始终返回 CDN 版，setter 吞掉原模块的赋值 ---------- */
var cdnImpl = { recognize: recognize };
var accessorInstalled = false;
try {
  Object.defineProperty(window, 'ChemQuestionOCR', {
    configurable: true,
    enumerable: true,
    get: function () { return cdnImpl; },
    set: function () { /* 吞掉原模块懒加载时的赋值 */ }
  });
  accessorInstalled = true;
} catch (e) {
  accessorInstalled = false;
}
if (!accessorInstalled) {
  /* 降级：直接赋值 + 轮询守护（仅当属性不可配置时才会走到这里）。 */
  try { window.ChemQuestionOCR = cdnImpl; } catch (e2) { /* 忽略 */ }
  setInterval(function () {
    try {
      if (window.ChemQuestionOCR !== cdnImpl) window.ChemQuestionOCR = cdnImpl;
    } catch (e3) { /* 忽略 */ }
  }, 1000);
}

/* ---------- 对话框样式（沿用本站 CSS 变量，深色模式自动适配；无动画） ---------- */
var STYLE_ID = 'wso-styles';
var CSS_TEXT = [
  '.wso-mask{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(6,42,34,.55);}',
  '.wso-dialog{width:100%;max-width:560px;max-height:88vh;overflow:auto;background:var(--card,#fff);color:var(--text,#134e4a);border:1px solid var(--border,#cdeee7);border-radius:14px;box-shadow:var(--shadow-lg,0 10px 36px rgba(14,107,87,.16));padding:20px;}',
  '.wso-dialog h3{margin:0 0 10px;font-size:18px;line-height:1.4;}',
  '.wso-conf{margin:0 0 8px;color:var(--text2,#5b8a85);font-size:14px;}',
  '.wso-warn{margin:0 0 12px;padding:10px 12px;border-radius:8px;background:var(--warn-bg,#fff3e0);color:var(--warn-tx,#e65100);font-size:14px;line-height:1.6;}',
  '.wso-note{margin:10px 0 0;color:var(--text2,#5b8a85);font-size:13px;line-height:1.6;}',
  '.wso-textarea{width:100%;min-height:130px;resize:vertical;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border,#cdeee7);border-radius:8px;background:var(--bg,#f1faf7);color:var(--text,#134e4a);font:inherit;font-size:15px;line-height:1.7;}',
  '.wso-textarea:focus{outline:2px solid var(--accent,#14b8a6);outline-offset:1px;}',
  '.wso-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px;}',
  '.wso-actions .btn-main,.wso-actions .btn-sub{flex:1 1 auto;}',
  '.wso-progress{margin:12px 0;font-size:15px;}',
  '.wso-field{display:block;margin:0 0 4px;font-size:14px;color:var(--text2,#5b8a85);}',
  '@media (prefers-reduced-motion: reduce){.wso-mask,.wso-dialog{animation:none!important;transition:none!important;}}'
].join('\n');

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  var style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS_TEXT;
  document.head.appendChild(style);
}

/* ---------- 对话框基础 ---------- */
var openDialog = null;
function closeDialog() {
  if (!openDialog) return;
  var d = openDialog;
  openDialog = null;
  document.removeEventListener('keydown', d.onKey);
  if (d.onClose) {
    try { d.onClose(); } catch (e) { /* 忽略 */ }
  }
  if (d.mask.parentNode) d.mask.parentNode.removeChild(d.mask);
  if (d.returnFocus && typeof d.returnFocus.focus === 'function') {
    try { d.returnFocus.focus(); } catch (e2) { /* 忽略 */ }
  }
}
function createDialog(title, label) {
  ensureStyles();
  closeDialog();
  var mask = document.createElement('div');
  mask.className = 'wso-mask';
  var dialog = document.createElement('div');
  dialog.className = 'wso-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', label || title);
  var h = document.createElement('h3');
  h.textContent = title;
  dialog.appendChild(h);
  mask.appendChild(dialog);
  var onKey = function (e) {
    if (e.key === 'Escape') { e.stopPropagation(); closeDialog(); }
  };
  document.addEventListener('keydown', onKey);
  document.body.appendChild(mask);
  openDialog = { mask: mask, dialog: dialog, onKey: onKey, onClose: null, returnFocus: document.activeElement };
  return { mask: mask, dialog: dialog };
}
function makeButton(text, cls, onClick) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}
function makeActions(buttons) {
  var wrap = document.createElement('div');
  wrap.className = 'wso-actions';
  buttons.forEach(function (b) { wrap.appendChild(b); });
  return wrap;
}

/* ---------- 启动解题：优先 B 组 ChemSolveFlow，否则回退填入题目框 ---------- */
function startSolve(text, source) {
  var q = String(text || '').trim();
  if (!q) {
    toast('题目是空的，请先输入题目。');
    return false;
  }
  if (window.ChemSolveFlow && typeof window.ChemSolveFlow.start === 'function') {
    try {
      window.ChemSolveFlow.start(q, { source: source || 'ocr' });
      return true;
    } catch (e) { /* 掉到回退分支 */ }
  }
  /* B 组未交付时的回退：填入现有自定义题目输入框并提示手动提交。
     student-study.js 通过 input 事件把 #studyQuestion 同步到 draft.question，
     因此设值后必须派发 input 事件。 */
  var box = document.getElementById('studyQuestion');
  if (box) {
    box.value = q.slice(0, 2000);
    box.dispatchEvent(new Event('input', { bubbles: true }));
    if (box.scrollIntoView) {
      try { box.scrollIntoView({ block: 'center' }); } catch (e2) { box.scrollIntoView(); }
    }
    box.focus();
    toast('已填入题目框，请点「分析这道题」。');
    return true;
  }
  showTextFallback(q);
  return false;
}

function showTextFallback(text) {
  var d = createDialog('题目已准备好', '题目已准备好');
  var p = document.createElement('p');
  p.className = 'wso-note';
  p.textContent = '当前页面没有题目输入框。请复制下面的题目，到“AI 解题”页粘贴后提交。';
  d.dialog.appendChild(p);
  var area = document.createElement('textarea');
  area.className = 'wso-textarea';
  area.readOnly = true;
  area.rows = 6;
  area.value = text;
  d.dialog.appendChild(area);
  var copyBtn = makeButton('复制题目', 'btn-main', function () {
    var done = function () { toast('题目已复制。'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(); });
    } else {
      fallbackCopy();
    }
    function fallbackCopy() {
      area.select();
      try { document.execCommand('copy'); done(); }
      catch (e) { toast('复制失败，请长按文字手动复制。'); }
    }
  });
  d.dialog.appendChild(makeActions([copyBtn, makeButton('关闭', 'btn-sub', closeDialog)]));
  copyBtn.focus();
}

/* ---------- 进度框 / 确认框 / 手动输入框 ---------- */
function showProgressDialog(controller) {
  var d = createDialog('正在识别题目图片…', '正在识别题目图片');
  var status = document.createElement('p');
  status.className = 'wso-progress';
  status.setAttribute('role', 'status');
  status.textContent = '正在加载识字组件…';
  d.dialog.appendChild(status);
  var note = document.createElement('p');
  note.className = 'wso-note';
  note.textContent = '首次识别需要下载识字组件与语言包（约几 MB），图片只在本机处理，不会上传到任何服务器。';
  d.dialog.appendChild(note);
  var cancelBtn = makeButton('取消识别', 'btn-sub', function () { controller.abort(); });
  d.dialog.appendChild(makeActions([cancelBtn]));
  openDialog.onClose = function () { try { controller.abort(); } catch (e) { /* 忽略 */ } };
  cancelBtn.focus();
  return {
    setProgress: function (value) {
      var pct = Math.max(0, Math.min(100, Math.round(value * 100)));
      status.textContent = '正在识别题目图片… ' + pct + '%';
    }
  };
}

function showConfirmDialog(result, onRetry) {
  var d = createDialog('核对识别结果', '核对识别结果');
  var conf = typeof result.confidence === 'number' ? Math.round(result.confidence) : null;
  var confText = conf === null ? '本次识别没有返回置信度，请仔细核对。' :
    conf >= 85 ? '识别置信度 ' + conf + '%（较高），仍请核对化学式与数字。' :
    conf >= 70 ? '识别置信度 ' + conf + '%（一般），请仔细核对后再解题。' :
    '识别置信度 ' + conf + '%（较低），建议换一张更清晰的图片，或直接修改下面的文字。';
  var pConf = document.createElement('p');
  pConf.className = 'wso-conf';
  pConf.textContent = confText;
  d.dialog.appendChild(pConf);
  var warn = document.createElement('p');
  warn.className = 'wso-warn';
  warn.textContent = '化学式识别易错，请核对后再解题：尤其注意上下标、系数、反应条件和单位。';
  d.dialog.appendChild(warn);
  var label = document.createElement('label');
  label.className = 'wso-field';
  label.textContent = '题目文字（可编辑）';
  var area = document.createElement('textarea');
  area.className = 'wso-textarea';
  area.rows = 6;
  area.maxLength = 2000;
  area.value = result.text || '';
  label.appendChild(area);
  d.dialog.appendChild(label);
  var note = document.createElement('p');
  note.className = 'wso-note';
  note.textContent = '识别结果仅用于本次解题，不会上传。';
  d.dialog.appendChild(note);
  var solveBtn = makeButton('开始解题', 'btn-main', function () {
    var text = area.value.trim();
    if (!text) {
      toast('题目是空的，请先输入题目。');
      area.focus();
      return;
    }
    closeDialog();
    startSolve(text, 'ocr');
  });
  var retryBtn = makeButton('重新识别', 'btn-sub', function () {
    closeDialog();
    if (typeof onRetry === 'function') onRetry();
  });
  d.dialog.appendChild(makeActions([solveBtn, retryBtn, makeButton('取消', 'btn-sub', closeDialog)]));
  area.focus();
}

function showManualDialog(errorMessage, file) {
  var d = createDialog('手动输入题目', '手动输入题目');
  var warn = document.createElement('p');
  warn.className = 'wso-warn';
  warn.textContent = errorMessage || '图片识别失败，请换张图再试，或直接输入题目。';
  d.dialog.appendChild(warn);
  var label = document.createElement('label');
  label.className = 'wso-field';
  label.textContent = '题目文字';
  var area = document.createElement('textarea');
  area.className = 'wso-textarea';
  area.rows = 6;
  area.maxLength = 2000;
  area.placeholder = '在这里输入或粘贴题目文字…';
  label.appendChild(area);
  d.dialog.appendChild(label);
  var buttons = [makeButton('开始解题', 'btn-main', function () {
    var text = area.value.trim();
    if (!text) {
      toast('题目是空的，请先输入题目。');
      area.focus();
      return;
    }
    closeDialog();
    startSolve(text, 'manual');
  })];
  if (file) {
    buttons.push(makeButton('重试识别', 'btn-sub', function () {
      closeDialog();
      void solveFromFile(file);
    }));
  }
  buttons.push(makeButton('取消', 'btn-sub', closeDialog));
  d.dialog.appendChild(makeActions(buttons));
  area.focus();
}

/* ---------- 拍照入口 ---------- */
var photoBusy = false;
function solveFromFile(file) {
  if (!file) return Promise.resolve(false);
  if (!IMAGE_TYPE_RE.test(file.type) || !file.size) {
    toast('请选择 PNG、JPG、WebP、BMP 或 GIF 图片。');
    return Promise.resolve(false);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    toast('请选择 10 MB 以内的图片。');
    return Promise.resolve(false);
  }
  if (photoBusy) {
    toast('正在识别上一张图片，请稍候。');
    return Promise.resolve(false);
  }
  photoBusy = true;
  var controller = new AbortController();
  var progress = showProgressDialog(controller);
  return recognize(file, {
    signal: controller.signal,
    onProgress: function (v) { progress.setProgress(v); }
  }).then(function (result) {
    photoBusy = false;
    closeDialog();
    if (!result.text || result.text.replace(/\s/g, '').length < 4) {
      showManualDialog('这张图里没读到完整的文字，试试裁到题干附近，或直接输入题目。', file);
      return false;
    }
    showConfirmDialog(result, function () { openPhotoSolve(); });
    return true;
  }).catch(function (error) {
    photoBusy = false;
    closeDialog();
    if (error && error.name === 'AbortError') {
      toast('已取消识别。');
      return false;
    }
    showManualDialog((error && error.message) || '图片识别失败，请换张图再试。', file);
    return false;
  });
}

function openPhotoSolve() {
  if (photoBusy) {
    toast('正在识别上一张图片，请稍候。');
    return;
  }
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.setAttribute('capture', 'environment'); /* 移动端调后置摄像头 */
  input.addEventListener('change', function () {
    var file = input.files && input.files[0];
    if (file) void solveFromFile(file);
  });
  input.click();
}

/* ---------- 解题历史（新键，与旧键无冲突；chem3d_v2_ 前缀享 auth 按账号隔离） ---------- */
var HISTORY_KEY = 'chem3d_v2_solve_history_v1';
var HISTORY_MAX = 100;

function historyList() {
  try {
    var v = JSON.parse(window.localStorage.getItem(HISTORY_KEY));
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}
function historySave(list) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    return true;
  } catch (e) { return false; }
}
function recordHistory(entry) {
  entry = entry || {};
  var text = String(entry.question || entry.text || '').trim();
  if (!text) return null;
  var list = historyList();
  var item = {
    id: 's' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36),
    text: text.slice(0, 1000),
    time: new Date().toISOString(),
    method: String(entry.method || '').slice(0, 20), /* engine | rules | retrieval */
    result: String(entry.result || '').slice(0, 500),
    source: String(entry.source || '').slice(0, 20)  /* ocr | assistant | example | custom */
  };
  list.unshift(item);
  if (list.length > HISTORY_MAX) list.length = HISTORY_MAX;
  historySave(list);
  return item;
}
function clearHistory() {
  try { window.localStorage.removeItem(HISTORY_KEY); } catch (e) { /* 忽略 */ }
}
function removeHistory(id) {
  var list = historyList().filter(function (x) { return x && x.id !== id; });
  return historySave(list);
}

/* B 组也可派发事件记入历史，无需直接依赖本模块是否已加载。 */
if (typeof window.addEventListener === 'function') {
  window.addEventListener('chem:solve-complete', function (e) {
    if (e && e.detail) recordHistory(e.detail);
  });
}

/* ---------- 错题联动：复用现有错题本存储 chem_mistakes_v1 ---------- */
var MISTAKE_KEY = 'chem_mistakes_v1';
var MISTAKE_MAX = 1000; /* 与 js/inline-09-studio.js 的上限一致 */
var SOLVE_PACK = { id: 'ai-solve', title: 'AI 解题' };

/* 与 ChemPracticeCore.fingerprint 相同的 FNV-1a（inline-09-studio.js:170），
   用于 ChemMistakes 不可用时的直接写存储，保证键与 record() 路径一致。 */
function fnv1a(str) {
  var n = 2166136261;
  for (var i = 0; i < str.length; i++) n = Math.imul(n ^ str.charCodeAt(i), 16777619);
  return (n >>> 0).toString(16);
}
function solveQuestionId(text) {
  return 'solve-' + fnv1a(text) + '-' + text.length;
}
function solvePackFingerprint() {
  try {
    if (window.ChemPracticeCore && typeof window.ChemPracticeCore.fingerprint === 'function') {
      return window.ChemPracticeCore.fingerprint(SOLVE_PACK);
    }
  } catch (e) { /* 回退到本地实现 */ }
  return fnv1a(JSON.stringify(SOLVE_PACK));
}
function buildSolveQuestion(text, topic) {
  var stem = String(text).slice(0, 2000);
  var title = stem.replace(/\s+/g, ' ').trim().slice(0, 40) || 'AI 解题';
  return {
    id: solveQuestionId(text),
    title: title,
    topic: String(topic || 'AI 解题').slice(0, 40),
    stem: stem,
    solveReview: true,
    analysis: '见 AI 解题步骤；复练时先不看答案，再独立做一次。',
    /* 错题本详情页要求 question 有 options 或 parts；用 manual 小题承载，
       feedback/grade 对 manual 是安全的（不自动判错，只按 rubric 核对）。 */
    parts: [{ id: 'solve', prompt: '这道题', kind: 'manual', points: 0, unit: '', rubric: '对照解题步骤复核，写出卡住的那一步。' }]
  };
}
function readMistakes() {
  try {
    var v = JSON.parse(window.localStorage.getItem(MISTAKE_KEY));
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}
function appendMistakeDirect(q, answers, result) {
  var list = readMistakes();
  var key = solvePackFingerprint() + ':' + q.id;
  var now = new Date().toISOString();
  var idx = -1;
  for (var i = 0; i < list.length; i++) {
    if (list[i] && list[i].key === key) { idx = i; break; }
  }
  var old = idx >= 0 ? list[idx] : null;
  var history = old && Array.isArray(old.history) ? old.history.slice() : [];
  history.push({ time: now, score: result.score, max: result.max });
  if (history.length > 20) history = history.slice(-20);
  var entry = {
    key: key,
    packTitle: SOLVE_PACK.title,
    question: q,
    answers: answers,
    result: result,
    firstAnswers: old ? old.firstAnswers : answers,
    created: old ? old.created : now,
    updated: now,
    state: result.score < result.max ? 'todo' : 'corrected',
    note: old ? old.note || '' : '',
    cause: old ? old.cause || '' : '',
    history: history
  };
  if (idx >= 0) list[idx] = entry;
  else list.unshift(entry);
  if (list.length > MISTAKE_MAX) list.length = MISTAKE_MAX;
  try {
    window.localStorage.setItem(MISTAKE_KEY, JSON.stringify(list));
    return true;
  } catch (e) { return false; }
}
function recordMistake(question, opts) {
  opts = opts || {};
  var text = String(question || '').trim();
  if (!text) return false;
  var q = buildSolveQuestion(text, opts.topic);
  var answers = { cause: String(opts.cause || '解题时标记没懂').slice(0, 200), solve: String(opts.note || '').slice(0, 500) };
  var result = { valid: true, score: opts.resolved ? 1 : 0, max: 1 };
  if (window.ChemMistakes && typeof window.ChemMistakes.record === 'function') {
    try {
      return !!window.ChemMistakes.record(SOLVE_PACK, q, answers, result);
    } catch (e) { /* 回退到直接写存储 */ }
  }
  return appendMistakeDirect(q, answers, result);
}

/* ---------- 对外接口 ---------- */
window.ChemSolveOCR = {
  version: '2.2.0',
  recognize: recognize,
  openPhotoSolve: openPhotoSolve,
  solveFromFile: solveFromFile,
  startSolve: startSolve,
  config: CFG,
  isAccessorInstalled: function () { return accessorInstalled; }
};
window.ChemSolveHistory = {
  key: HISTORY_KEY,
  max: HISTORY_MAX,
  list: historyList,
  record: recordHistory,
  clear: clearHistory,
  remove: removeHistory
};
window.ChemSolveMistakes = {
  key: MISTAKE_KEY,
  markNotUnderstood: function (question, opts) {
    return recordMistake(question, merge({ cause: '解题时标记没懂' }, opts));
  },
  markVariantWrong: function (question, opts) {
    return recordMistake(question, merge({ cause: '变式题答错' }, opts));
  },
  markUnderstood: function (question, opts) {
    return recordMistake(question, merge({ resolved: true, cause: '已订正' }, opts));
  },
  list: function () {
    return readMistakes().filter(function (x) { return x && x.question && x.question.solveReview; });
  }
};
function merge(base, extra) {
  var out = {};
  var k;
  for (k in base) { if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k]; }
  extra = extra || {};
  for (k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k]; }
  return out;
}
})();
