/* ============================================================================
 * 高中化学 3D 考点工作台 — AI 助手配置与降级（工作流 2：商业化产品外壳）
 * ============================================================================
 * 现状（工作流 1 保留的原站行为，见 js/inline-09-studio.js）：
 *  - 化学助教 window.ChemTutor 在“共享版”覆盖中被强制为 local 模式：
 *    T.check() 恒置 mode='local'，send() 走 this.local(q, context) 做
 *    站内资料规则检索，从不调用 /api/chat。
 *  - 原始联网分支仍在 send() 内：mode==='online' 时 POST /api/chat，
 *    失败则显示连接错误。本模块不改动该源码，而是在外层包装实现降级。
 *
 * 本模块做的三件事（全部运行时包装，不改 W1 源码）：
 *  1. 演示模式（默认）：包装 Tutor.local，扩充内置规则知识库（按关键词
 *     匹配高中化学知识点），并在每条回答后明确标注“演示模式：接通 API
 *     后可用完整 AI 助手”。
 *  2. API 模式：用户在设置面板选择“云端接口”或“自定义接口”后，包装
 *     Tutor.send：先调接口，成功则渲染；任何失败（网络错误、非 2xx、
 *     超时、返回异常）都自动降级为演示模式回答，并在助教面板提示
 *     “接口不可用，已切换为演示模式”。
 *  3. 设置面板：用户填写 API Base URL / Key / 模型名；Key 只存本机
 *     localStorage，绝不进代码、不上传本站服务器（仅随请求发给用户
 *     自己配置的接口地址）。
 *
 * 接口说明：
 *  - “云端接口”：POST /api/chat（Netlify 上由 netlify.toml 的 redirect
 *    重写到 /.netlify/functions/chat，见 netlify/functions/chat.js）。
 *    同源请求，符合本站 CSP（connect-src 'self'）。
 *  - “自定义接口”：OpenAI 兼容的 <BaseURL>/chat/completions。
 *    注意：跨域地址可能被本站 CSP（connect-src 'self'）拦截；如需
 *    跨域调用，请管理员把域名加入 CSP connect-src，或改用云端接口。
 *
 * 与 js/plan.js 的协作：plan.js 先包装 Tutor.send（限额）；本模块再包
 * 一层。API 模式下本模块自行计次一次，降级分支调用 Tutor.__chemOrigSend
 * （plan.js 保存的原始 send）以避免重复计次；若加载顺序异常导致
 * plan.js 后包装，本模块通过 T.send !== myWrapper 判断 plan 已计次，
 * 同样只计一次。
 * ========================================================================== */
(function () {
'use strict';

var CONFIG_KEY = 'chem3d_ai_config_v1';
var DEMO_NOTICE = '\n\n【演示模式】以上为内置规则回答，未连接大模型；接通 API 后可用完整 AI 助手（点助教面板右上角的“AI 设置”配置）。';
var API_TIMEOUT_MS = 30000;

/* ---------------- 配置读写（Key 只存 localStorage） ---------------- */
function defaultConfig() {
  return { mode: 'demo', baseUrl: '', apiKey: '', model: 'deepseek-chat' };
}
function getConfig() {
  try {
    var raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return defaultConfig();
    var c = JSON.parse(raw);
    var d = defaultConfig();
    return {
      mode: ['demo', 'function', 'custom'].indexOf(c.mode) !== -1 ? c.mode : 'demo',
      baseUrl: typeof c.baseUrl === 'string' ? c.baseUrl : d.baseUrl,
      apiKey: typeof c.apiKey === 'string' ? c.apiKey : d.apiKey,
      model: typeof c.model === 'string' && c.model ? c.model : d.model
    };
  } catch (e) { return defaultConfig(); }
}
function setConfig(cfg) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({
      mode: cfg.mode, baseUrl: cfg.baseUrl || '',
      apiKey: cfg.apiKey || '', model: cfg.model || 'deepseek-chat'
    }));
    return true;
  } catch (e) { return false; }
}

/* ---------------- 演示知识库：关键词 → 简短讲解 ----------------
 * 覆盖高中化学高频考点；匹配规则为“命中关键词个数最多者胜出”。
 * 内容为通用教学表述，不声称来自任何真题或教材原文。 */
var DEMO_KB = [
  { keys: ['滴定', '终点'], answer: '酸碱中和滴定的关键是终点判断：以酚酞作指示剂时，溶液由无色变为浅粉红色且半分钟内不褪色即为终点。注意终点不等于恰好中和的当量点，指示剂的选择要让变色范围落在滴定突跃内。锥形瓶不能用待测液润洗，否则待测物物质的量偏大，结果偏高。可以在左侧导航打开“酸碱中和滴定”，用手动滴定亲自判断一次终点。' },
  { keys: ['vsepr', '空间构型', '杂化'], answer: '判断分子空间构型可用 VSEPR 模型：先数中心原子的价层电子对数（σ 键电子对 + 孤电子对），再由电子对间的排斥决定构型。例如 CH₄ 是正四面体形（4 对成键电子对，无孤电子对）；NH₃ 是三角锥形（3 对成键 + 1 对孤电子对）；H₂O 是 V 形（2 对成键 + 2 对孤电子对）。孤电子对越多，键角被压缩得越厉害。可以在周期表“分子”页打开对应分子做 3D 对比。' },
  { keys: ['离子共存'], answer: '判断离子能否大量共存，看四类反应：①生成沉淀（如 Ba²⁺ 与 SO₄²⁻）；②生成气体（如 H⁺ 与 CO₃²⁻）；③生成弱电解质（如 H⁺ 与 OH⁻、CH₃COO⁻）；④发生氧化还原反应（如 Fe³⁺ 与 I⁻）。还要留意附加条件：无色溶液排除 Fe³⁺、Cu²⁺、MnO₄⁻ 等有色离子；酸性条件排除 OH⁻、CO₃²⁻、HCO₃⁻ 等。' },
  { keys: ['氧化还原', '氧化剂', '还原剂'], answer: '氧化还原反应的本质是电子转移：化合价升高的元素被氧化，作还原剂；化合价降低的元素被还原，作氧化剂。配平抓住“得失电子守恒”与“电荷守恒”：先标化合价、找变价元素，再配电子转移数，最后配其他原子与电荷。常见氧化剂有 KMnO₄、Cl₂、HNO₃、FeCl₃；常见还原剂有 Fe、Zn、KI、SO₂。' },
  { keys: ['化学平衡', '平衡移动'], answer: '化学平衡是动态平衡：正、逆反应速率相等时各组分浓度保持不变。勒夏特列原理：改变条件，平衡向减弱这种改变的方向移动——增大反应物浓度、增大压强（气体体积减小的方向）、降低温度（放热方向）等。注意催化剂只改变化学反应速率，不改变化学平衡；平衡常数 K 只随温度变化。' },
  { keys: ['ph', '水解', '电离'], answer: '25℃ 时 Kw = 1.0×10⁻¹⁴，pH + pOH = 14。盐类水解的规律是“有弱才水解，越弱越水解，谁强显谁性”：强酸弱碱盐显酸性（如 NH₄Cl），强碱弱酸盐显碱性（如 Na₂CO₃），弱酸弱碱盐看相对强弱。稀释弱酸时电离程度增大，但 c(H⁺) 仍减小；加水稀释，酸的 pH 不会超过 7，碱的 pH 不会低于 7。' },
  { keys: ['原电池'], answer: '原电池把化学能转化为电能：负极失电子发生氧化反应，正极得电子发生还原反应。电子沿外电路由负极流向正极；电解质溶液中阳离子向正极移动、阴离子向负极移动，构成闭合回路。判断正负极：活泼金属作负极；也可以看电子流向或电流表偏转方向。' },
  { keys: ['电解'], answer: '电解池把电能转化为化学能：与电源正极相连的是阳极，发生氧化反应；与负极相连的是阴极，发生还原反应。记住“阳氧阴还”。惰性电极电解时，阳极放电顺序：S²⁻ > I⁻ > Br⁻ > Cl⁻ > OH⁻ > 含氧酸根；阴极放电顺序：Ag⁺ > Fe³⁺ > Cu²⁺ > H⁺ >  Al³⁺、Mg²⁺、Na⁺ 等（后者实质是水放电）。' },
  { keys: ['酯化', '酯'], answer: '酯化反应是酸与醇在浓硫酸催化、加热条件下生成酯和水的可逆反应，属于取代反应。例如乙酸与乙醇生成乙酸乙酯。注意：浓硫酸作催化剂和吸水剂；酯化反应中断裂的是酸的 C—OH 键与醇的 O—H 键；酯在碱性条件下水解更彻底（皂化反应即油脂在碱性条件下的水解）。' },
  { keys: ['加成', '加聚'], answer: '加成反应是不饱和键（如 C=C、C≡C、C=O）断开一根键、与小分子结合生成饱和化合物的反应，烯烃与 Br₂、H₂、HX 的反应都是加成。加聚反应是含不饱和键的小分子（单体）通过加成彼此连接成高分子的反应，如乙烯生成聚乙烯。判断要点：加成前后原子总数不变；加聚产物链节与单体组成相同。' },
  { keys: ['化学键'], answer: '化学键分三类：离子键（阴阳离子间的静电作用，如 NaCl）、共价键（原子间共用电子对，如 HCl、CO₂）、金属键（金属阳离子与自由电子间的作用）。判断：活泼金属与活泼非金属之间多为离子键；非金属元素之间多为共价键。注意稀有气体分子内无化学键；NH₄Cl 中既有离子键又有共价键。' },
  { keys: ['晶体'], answer: '四类晶体按微粒间作用区分：离子晶体（离子键，熔点较高，如 NaCl）、共价晶体（共价键三维网络，熔点很高、硬度大，如金刚石、SiO₂）、分子晶体（分子间作用力，熔点低，如干冰、I₂）、金属晶体（金属键，能导电、有延展性）。熔点一般：共价晶体 > 离子晶体 > 金属晶体（差异大）> 分子晶体。' },
  { keys: ['周期律', '周期表'], answer: '同周期从左到右：原子半径减小，金属性减弱、非金属性增强，最高价氧化物对应水化物的碱性减弱、酸性增强；同主族从上到下：原子半径增大，金属性增强、非金属性减弱。第一电离能总体递增，但第ⅡA 大于第ⅢA、第ⅤA 大于第ⅥA（半满、全满结构更稳定）。' },
  { keys: ['反应热', '焓变'], answer: 'ΔH < 0 为放热反应，ΔH > 0 为吸热反应。反应热只与始态和终态有关，与途径无关（盖斯定律），可以把已知热化学方程式相加减求未知反应的 ΔH。注意热化学方程式要注明物质状态；燃烧热指 1 mol 物质完全燃烧生成稳定氧化物时放出的热量；中和热指稀强酸与稀强碱生成 1 mol 水时放出的热量（约 57.3 kJ/mol）。' },
  { keys: ['反应速率'], answer: '影响化学反应速率的因素：升高温度、增大反应物浓度、增大压强（有气体参加）、使用催化剂、增大固体表面积，都能加快反应速率。温度与催化剂通过改变活化分子百分数起作用；浓度与压强主要改变单位体积内的活化分子数。注意：速率用单位时间内的浓度变化表示，比较速率时要换算为同一物质。' },
  { keys: ['沉淀溶解平衡', 'ksp'], answer: '沉淀溶解平衡的溶度积 Ksp 只与温度有关。比较同类型难溶物的溶解度可直接比较 Ksp；不同类型要换算为溶解度再比较。沉淀转化的方向是向 Ksp 更小的沉淀转化，例如 AgCl 沉淀中加入 KI 会转化为更难溶的 AgI。判断沉淀是否生成：计算离子积 Q，Q > Ksp 时生成沉淀。' },
  { keys: ['配制溶液', '容量瓶'], answer: '配制一定物质的量浓度溶液的步骤：计算 → 称量 → 溶解（冷却至室温）→ 转移（玻璃棒引流）→ 洗涤（洗液一并转入）→ 定容（加水至刻度线 1–2 cm 处改用胶头滴管，视线与刻度线、凹液面最低处相平）→ 摇匀。误差分析抓住 c = n/V：n 偏小或 V 偏大都会使浓度偏低，如仰视定容会使 V 偏大、浓度偏低。' },
  { keys: ['物质的量'], answer: '物质的量是连接微观与宏观的桥梁：n = N/Nₐ = m/M = V/Vm（气体）= cV（溶液）。标准状况（0℃、101 kPa）下气体摩尔体积 Vm ≈ 22.4 L/mol，只适用于气体；注意 22.4 L/mol 的适用条件——标准状况、气体状态、1 mol。阿伏加德罗定律：同温同压下，相同体积的气体含相同数目的分子。' },
  { keys: ['同分异构'], answer: '同分异构体是分子式相同、结构不同的化合物。书写碳链异构时按“主链由长到短、支链由整到散、位置由心到边”的顺序，避免重复与遗漏。注意区分位置异构（官能团位置不同）与官能团异构（如醇与醚、醛与酮、羧酸与酯）。烯烃还有顺反异构：双键两端碳原子各连两个不同基团时才存在。' },
  { keys: ['盐类水解', '水解'], answer: '盐类水解是弱酸根或弱碱阳离子结合水电离出的 H⁺ 或 OH⁻、破坏水的电离平衡的反应，水解后溶液显酸性或碱性。规律：“有弱才水解，无弱不水解；越弱越水解，都弱都水解”。水解程度一般很小；升高温度、稀释都能促进水解。泡沫灭火器利用 Al³⁺ 与 HCO₃⁻ 的双水解反应产生 CO₂。' }
];
function demoAnswer(q) {
  var text = String(q || '').toLowerCase();
  var best = null, bestScore = 0;
  DEMO_KB.forEach(function (entry) {
    var score = 0;
    entry.keys.forEach(function (k) { if (text.indexOf(k.toLowerCase()) !== -1) score += 1; });
    if (score > bestScore) { bestScore = score; best = entry; }
  });
  return bestScore > 0 ? best.answer : null;
}

/* ---------------- 包装 Tutor.local：扩充知识库 + 演示提示 ---------------- */
function wrapTutorLocal() {
  var T = window.ChemTutor;
  if (!T || typeof T.local !== 'function' || T.__chemAIWrappedLocal) return !!T;
  var origLocal = T.local;
  T.__chemAIWrappedLocal = true;
  T.local = function (q, c) {
    var kb = demoAnswer(q);
    if (kb) return { answer: kb + DEMO_NOTICE };
    var r = origLocal.call(T, q, c);
    if (r && typeof r.answer === 'string' && r.answer.indexOf('演示模式') === -1) {
      return { answer: r.answer + DEMO_NOTICE, refs: r.refs, actions: r.actions };
    }
    return r;
  };
  return true;
}

/* ---------------- API 调用（任一环节失败都抛错，由上层降级） ---------------- */
async function callFunctionApi(text, tutor, signal) {
  /* 云端接口：同源 /api/chat；Netlify 上由 redirect 重写到函数。
   * 本地 python http.server 没有该接口，会 404 → 触发降级（符合预期）。 */
  var r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: text, context: tutor.current(), history: tutor.history.slice(-8) }),
    signal: signal
  });
  var d = await r.json().catch(function () { return null; });
  if (!r.ok || !d || typeof d.answer !== 'string' || !d.answer) {
    throw new Error((d && d.error) || '云端接口返回异常');
  }
  return d.answer;
}
async function callCustomApi(text, cfg, signal) {
  var base = (cfg.baseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('未配置接口地址');
  var headers = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers.Authorization = 'Bearer ' + cfg.apiKey;
  var r = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      model: cfg.model || 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是高中化学助教，用中文简明回答高中化学问题，回答供学习参考；不确定的内容要说明需要核对教材。' },
        { role: 'user', content: text }
      ],
      temperature: 0.7
    }),
    signal: signal
  });
  var d = await r.json().catch(function () { return null; });
  var content = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
  if (!r.ok || typeof content !== 'string' || !content) {
    throw new Error((d && d.error && d.error.message) || '自定义接口返回异常');
  }
  return content;
}

/* 走 API 提问：成功返回 true；失败返回 false（由调用方降级为演示回答）。
 * 注意：用户消息在 API 成功后才回显；失败时由原始 send() 回显，避免重复。 */
async function sendViaApi(tutor, text, cfg) {
  var controller = new AbortController();
  var timeout = setTimeout(function () { controller.abort(); }, API_TIMEOUT_MS);
  var pending = null;
  var sendBtn = document.getElementById('caSend');
  var stopBtn = document.getElementById('caStop');
  var errEl = document.getElementById('caError');
  try {
    tutor.toggle(true);
    var input = document.getElementById('caInput');
    if (input) input.value = '';
    if (errEl) errEl.textContent = '';
    tutor.busy = true;
    tutor.controller = controller;
    if (sendBtn) sendBtn.disabled = true;
    if (stopBtn) stopBtn.hidden = false;
    pending = tutor.message('assistant', '正在连接 AI 接口…', [], [], '连接模型中');
    var answer = cfg.mode === 'custom'
      ? await callCustomApi(text, cfg, controller.signal)
      : await callFunctionApi(text, tutor, controller.signal);
    if (pending) pending.remove();
    tutor.message('user', text);
    tutor.message('assistant', answer, [], [], cfg.mode === 'custom' ? '化学助教 · 自定义接口' : '化学助教 · 云端接口');
    tutor.history.push({ role: 'user', content: text }, { role: 'assistant', content: answer });
    tutor.history = tutor.history.slice(-8);
    return true;
  } catch (e) {
    if (pending) pending.remove();
    return false;
  } finally {
    clearTimeout(timeout);
    tutor.busy = false;
    tutor.controller = null;
    if (sendBtn) sendBtn.disabled = false;
    if (stopBtn) stopBtn.hidden = true;
    var input2 = document.getElementById('caInput');
    if (input2) input2.focus();
  }
}

/* ---------------- 包装 Tutor.send：API 优先，失败自动降级 ---------------- */
function wrapTutorSend() {
  var T = window.ChemTutor;
  if (!T || typeof T.send !== 'function' || T.__chemAIWrapped) return !!T;
  var planWrapped = T.send; /* plan.js 包装过的 send（含限额） */
  var orig = T.__chemOrigSend || planWrapped; /* 最原始的 send（演示回答） */
  T.__chemAIWrapped = true;
  var myWrapper = async function (q) {
    var cfg = getConfig();
    if (cfg.mode === 'demo') return planWrapped.call(T, q);
    var input = document.getElementById('caInput');
    var text = (q == null ? (input ? input.value : '') : q);
    text = String(text == null ? '' : text).trim();
    if (!text || T.busy) return planWrapped.call(T, q);
    /* 限额只计一次：若 plan.js 后包装（T.send 已不是本函数），说明
     * plan 的包装层已计过次，这里不再重复计次。 */
    if (window.ChemPlan && T.send === myWrapper) {
      if (!window.ChemPlan.consumeAI()) { window.ChemPlan.showPaywall('ai'); return; }
    }
    var ok = await sendViaApi(T, text, cfg);
    if (ok) return;
    /* 降级：接口不可用 → 原始演示分支（已计过一次，不再重复计次）。
     * 注意：原始 send() 开头会清空 #caError，所以提示要在它完成后再写。 */
    await orig.call(T, text);
    var errEl = document.getElementById('caError');
    if (errEl) errEl.textContent = '接口不可用，已切换为演示模式。';
  };
  T.send = myWrapper;
  return true;
}

/* ---------------- 助教面板状态文案 ---------------- */
function refreshStatus() {
  var modeEl = document.getElementById('caMode');
  if (!modeEl) return;
  var cfg = getConfig();
  if (cfg.mode === 'custom') {
    modeEl.textContent = '自定义接口 · ' + (cfg.baseUrl || '未配置地址');
    modeEl.classList.add('connected');
  } else if (cfg.mode === 'function') {
    modeEl.textContent = '云端接口 · 未配置服务端 Key 时自动演示';
    modeEl.classList.add('connected');
  } else {
    modeEl.textContent = '演示模式 · 内置规则回答';
    modeEl.classList.remove('connected');
  }
}
function wrapSetStatus() {
  var T = window.ChemTutor;
  if (!T || typeof T.setStatus !== 'function' || T.__chemAIWrappedStatus) return;
  var orig = T.setStatus;
  T.__chemAIWrappedStatus = true;
  T.setStatus = function () { orig.call(T); refreshStatus(); };
}

/* ---------------- 设置面板 ---------------- */
function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function toast(msg) {
  var t = document.getElementById('toast');
  if (t) { t.textContent = msg; t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 2600); }
  else window.alert(msg);
}
function closeSettings() {
  var m = document.querySelector('.chem2-ai-mask');
  if (m) m.remove();
}
function openSettings() {
  closeSettings();
  var cfg = getConfig();
  var mask = el('div', 'chem2-mask chem2-ai-mask');
  mask.setAttribute('role', 'dialog');
  mask.setAttribute('aria-modal', 'true');
  mask.setAttribute('aria-label', 'AI 助手设置');
  var box = el('div', 'chem2-box chem2-ai-box');
  var title = el('h2', 'chem2-title', 'AI 助手设置');
  var note = el('p', 'chem2-note',
    '演示模式使用内置规则回答，不消耗任何接口额度。接通 API 后可使用完整 AI 助手；' +
    '接口地址与密钥只保存在本机 localStorage，不会上传到本站服务器，发送时只发给你配置的接口地址。');
  var status = el('p', 'chem2-status');
  status.setAttribute('role', 'status');
  var form = document.createElement('form');
  form.className = 'chem2-form';
  form.setAttribute('novalidate', '');

  var modeLabel = el('label', 'chem2-field', '问答模式');
  var modeSelect = document.createElement('select');
  [['demo', '演示模式（内置规则回答）'],
   ['function', '云端接口（本站 Netlify 函数，需服务端配置 Key）'],
   ['custom', '自定义接口（OpenAI 兼容）']].forEach(function (opt) {
    var o = document.createElement('option');
    o.value = opt[0]; o.textContent = opt[1];
    modeSelect.appendChild(o);
  });
  modeSelect.value = cfg.mode;
  modeLabel.appendChild(modeSelect);

  var baseLabel = el('label', 'chem2-field', 'API Base URL（自定义接口）');
  var baseInput = document.createElement('input');
  baseInput.type = 'url'; baseInput.placeholder = '例如 https://api.deepseek.com/v1';
  baseInput.value = cfg.baseUrl || '';
  baseInput.autocomplete = 'off';
  baseLabel.appendChild(baseInput);

  var keyLabel = el('label', 'chem2-field', 'API Key（自定义接口）');
  var keyInput = document.createElement('input');
  keyInput.type = 'password'; keyInput.placeholder = '只存本机，不进代码';
  keyInput.value = cfg.apiKey || '';
  keyInput.autocomplete = 'off';
  keyLabel.appendChild(keyInput);

  var modelLabel = el('label', 'chem2-field', '模型名（自定义接口）');
  var modelInput = document.createElement('input');
  modelInput.type = 'text'; modelInput.placeholder = '例如 deepseek-chat';
  modelInput.value = cfg.model || 'deepseek-chat';
  modelInput.autocomplete = 'off';
  modelLabel.appendChild(modelInput);

  var cspNote = el('p', 'chem2-note',
    '提示：本站 CSP 仅允许同源请求（connect-src \'self\'），跨域自定义接口可能被浏览器拦截；' +
    '推荐使用云端接口，或请管理员把接口域名加入 CSP 白名单。');
  var saveBtn = el('button', 'btn-main', '保存设置');
  saveBtn.type = 'submit';
  var testBtn = el('button', 'btn-sub', '测试连接');
  testBtn.type = 'button';
  var demoBtn = el('button', 'btn-sub', '恢复演示模式');
  demoBtn.type = 'button';
  var closeBtn = el('button', 'chem2-x', '×');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', '关闭');

  function syncFields() {
    var custom = modeSelect.value === 'custom';
    baseLabel.style.display = custom ? '' : 'none';
    keyLabel.style.display = custom ? '' : 'none';
    modelLabel.style.display = custom ? '' : 'none';
    cspNote.style.display = custom ? '' : 'none';
    testBtn.style.display = modeSelect.value === 'demo' ? 'none' : '';
  }
  modeSelect.addEventListener('change', syncFields);
  syncFields();

  form.append(modeLabel, baseLabel, keyLabel, modelLabel, cspNote, status, saveBtn, testBtn, demoBtn);
  box.append(closeBtn, title, note, form);
  mask.appendChild(box);
  document.body.appendChild(mask);
  modeSelect.focus();

  closeBtn.addEventListener('click', closeSettings);
  mask.addEventListener('click', function (e) { if (e.target === mask) closeSettings(); });
  mask.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.stopPropagation(); closeSettings(); }
  });
  demoBtn.addEventListener('click', function () {
    setConfig({ mode: 'demo', baseUrl: '', apiKey: '', model: 'deepseek-chat' });
    refreshStatus();
    toast('已恢复演示模式。');
    closeSettings();
  });
  testBtn.addEventListener('click', async function () {
    var testCfg = {
      mode: modeSelect.value,
      baseUrl: baseInput.value.trim(),
      apiKey: keyInput.value.trim(),
      model: modelInput.value.trim() || 'deepseek-chat'
    };
    if (testCfg.mode === 'demo') { status.textContent = '演示模式无需测试。'; return; }
    if (testCfg.mode === 'custom' && !testCfg.baseUrl) { status.textContent = '请先填写 API Base URL。'; return; }
    status.textContent = '正在测试连接…';
    testBtn.disabled = true;
    try {
      var T = window.ChemTutor;
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, API_TIMEOUT_MS);
      var reply = testCfg.mode === 'custom'
        ? await callCustomApi('你好，请用一句话介绍你自己。', testCfg, controller.signal)
        : await callFunctionApi('你好，请用一句话介绍你自己。', T, controller.signal);
      clearTimeout(timer);
      status.textContent = '连接成功：' + reply.slice(0, 80);
    } catch (e) {
      status.textContent = '连接失败：' + (e && e.message ? e.message : '接口不可用') + '。保存后提问时将自动降级为演示模式。';
    } finally {
      testBtn.disabled = false;
    }
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var next = {
      mode: modeSelect.value,
      baseUrl: baseInput.value.trim(),
      apiKey: keyInput.value.trim(),
      model: modelInput.value.trim() || 'deepseek-chat'
    };
    if (next.mode === 'custom' && !next.baseUrl) {
      status.textContent = '自定义接口需要填写 API Base URL。';
      return;
    }
    setConfig(next);
    refreshStatus();
    toast(next.mode === 'demo' ? '已切换为演示模式。' : 'AI 设置已保存。');
    closeSettings();
  });
}

/* ---------------- 在助教面板注入“AI 设置”按钮 ---------------- */
function injectSettingsButton() {
  var ctx = document.querySelector('.ca-context');
  if (!ctx || document.getElementById('chem2AiSettings')) return;
  var btn = el('button', 'btn-sub', 'AI 设置');
  btn.id = 'chem2AiSettings';
  btn.type = 'button';
  btn.title = '配置 AI 接口（演示模式 / 云端接口 / 自定义接口）';
  btn.addEventListener('click', openSettings);
  ctx.appendChild(btn);
}

/* ---------------- 初始化（带有限重试，防脚本加载顺序变化） ---------------- */
(function init(attempt) {
  var okLocal = wrapTutorLocal();
  var okSend = wrapTutorSend();
  wrapSetStatus();
  injectSettingsButton();
  refreshStatus();
  if ((okLocal && okSend) || attempt >= 10) return;
  setTimeout(function () { init(attempt + 1); }, 500);
})(0);

/* ---------------- 对外接口 ---------------- */
window.ChemAI = {
  getConfig: getConfig,
  setConfig: setConfig,
  openSettings: openSettings,
  closeSettings: closeSettings,
  refreshStatus: refreshStatus,
  /* 演示知识库查询（供测试与复用；无命中返回 null）。 */
  demoAnswer: demoAnswer,
  DEMO_NOTICE: DEMO_NOTICE
};

})();
