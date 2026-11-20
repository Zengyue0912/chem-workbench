(function () {
'use strict';

/* 工作流 1：文件从根目录移入 js/ 后，document.currentScript.src 会把资源解析到 js/assets/；
   改为 document.baseURI（页面地址），与原来“资源位于站点根目录 assets/ 下”的解析结果一致。 */
const assets = new URL('assets/question-ocr/', document.baseURI);
const url = name => new URL(name, assets).href;
let engine;

function loadEngine() {
  if (engine) return engine;
  engine = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url('tesseract.min.js');
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => {
      script.remove();
      reject(new Error('识字组件没有加载成功。'));
    };
    document.head.append(script);
  }).catch(error => { engine = null; throw error; });
  return engine;
}

async function prepareImage(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = objectUrl;
    await img.decode();
    const width = img.naturalWidth, height = img.naturalHeight;
    if (width * height > 40_000_000) throw new Error('图片像素太大，请截取题目所在区域后再试。');
    const scale = Math.min(width < 1000 ? 1.5 : 1, 2800 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally { URL.revokeObjectURL(objectUrl); }
}

function cleanText(value) {
  return value.split(/\r?\n/).map(line => line.trim()
    .replace(/(?<=\p{Script=Han})[ \t]+(?=\p{Script=Han})/gu, '')
  ).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function recognize(file, {signal, onProgress}) {
  let worker, timeout;
  const release = () => {
    const current = worker;
    worker = null;
    if (current) void current.terminate().catch(() => {});
  };
  const stop = new AbortController();
  const cancel = () => stop.abort(signal.reason);
  if (signal.aborted) cancel();
  else signal.addEventListener('abort', cancel, {once:true});
  const pending = new Promise((_, reject) => {
    const rejectRun = () => { release(); reject(stop.signal.reason); };
    if (stop.signal.aborted) rejectRun();
    else stop.signal.addEventListener('abort', rejectRun, {once:true});
  });
  timeout = setTimeout(() => stop.abort(new Error('识别超时，请只截取一道题再试。')), 45000);
  const run = async () => {
    const [lib, canvas] = await Promise.all([loadEngine(), prepareImage(file)]);
    stop.signal.throwIfAborted();
    worker = await lib.createWorker(['chi_sim', 'eng'], 1, {
      workerPath:url('worker.min.js'), corePath:url('core/'), langPath:url('lang'),
      workerBlobURL:false, errorHandler:error => stop.abort(new Error(String(error))),
      logger:info => { if (!stop.signal.aborted && info.status === 'recognizing text') onProgress(info.progress); }
    });
    if (stop.signal.aborted) {
      release();
      stop.signal.throwIfAborted();
    }
    const {data} = await worker.recognize(canvas);
    return {text:cleanText(data.text), confidence:data.confidence};
  };
  try { return await Promise.race([pending, run()]); }
  catch (error) {
    if (error.name === 'AbortError') throw error;
    if (error.message.startsWith('图片像素太大') || error.message.startsWith('识别超时')) throw error;
    throw new Error('没能识别这张图。请换一张清晰截图，或直接输入题目。');
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', cancel);
    release();
  }
}

window.ChemQuestionOCR = {recognize};
})();
