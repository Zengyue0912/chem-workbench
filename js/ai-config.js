/* ============================================================================
* 高中化学 3D 考点工作台 — AI 助手配置与降级（v2.3.0 重做）
* ============================================================================
* v2.3.0 改了什么（之前“配置大模型”一块的问题）：
* 1. 原站 Tutor.settings（助教面板“连接”按钮）只认本机服务：要跑
* “启动工作室.cmd” + 本机环境变量 deepseek-api，在线上部署（GitHub
* Pages / Netlify）下永远连不上，文案还会误导用户去跑本地脚本。
* 本轮把它接管：同一个按钮改为打开本模块的 AI 设置面板，不再出现
* 两个入口、两种说法。
* 2. 旧设置面板没有供应商预设，用户得手填 Base URL；还推荐“云端接口”，
* 但 /api/chat 只在 Netlify 部署下存在，GitHub Pages 上永远 404。
* 本轮加入一键供应商预设（DeepSeek 默认），并在 Pages 下自动隐藏
* 云端接口选项，不再给走不通的路。
* 3. 旧自定义接口只发当前一句话（无历史）、等全量返回才显示。
* 本轮带上最近对话历史，并改用流式输出（SSE），边生成边显示，
* “停止”按钮可随时中断；报错按 401/429/404/网络分别给中文提示。
* 4. CSP：Netlify 的 connect-src 增加各预设供应商域名（Pages 本身不
* 下发 CSP，不受影响；但若以后迁回 Netlify，自定义接口同样可用）。
*
* 架构（全部运行时包装，不改 W1 源码）：
* - 演示模式（默认）：包装 Tutor.local，扩充内置规则知识库。
* - 自定义接口：浏览器直连用户配置的 OpenAI 兼容接口（DeepSeek 等），
* Key 只存本机 localStorage，绝不进代码、不上传本站服务器（仅随请求
* 发给用户自己配置的接口地址）。
* - 云端接口：同源 /api/chat（仅 Netlify 部署，见 netlify/functions/chat.js）。
* - 任一环节失败都自动降级为演示模式回答，并在助教面板提示原因。
* ========================================================================== */
(function () {
'use strict';

var CONFIG_KEY = 'chem3d_ai_config_v1';
var DEMO_NOTICE = '\n\n以上为内置规则回答，未连接大模型；点助教面板的“AI 设置”填入 API Key（推荐 DeepSeek）即可用完整 AI 助手。';
var API_TIMEOUT_MS = 30000;
var STREAM_TIMEOUT_MS = 120000;
var ON_PAGES = typeof location!== 'undefined' && /\.github\.io$/.test(location.hostname || '');

/* ---------------- 供应商预设（OpenAI 兼容接口） ----------------
* 备注只写定性信息（便宜/有免费额度），不写具体价格（以供应商官网为准）。 */
var PRESETS = [
{ id: 'deepseek', name: 'DeepSeek（推荐）', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat',
keyUrl: 'https://platform.deepseek.com/api_keys', keyHint: '在 platform.deepseek.com 注册后创建 API Key',
note: '中文好、便宜，按量计费，是学生最常用的选择。'},
{ id: 'qwen', name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus',
keyUrl: 'https://bailian.console.aliyun.com/?apiKey=1#/api-key', keyHint: '在阿里云百炼控制台创建 API Key',
note: '阿里巴巴的大模型，新用户有免费额度。'},
{ id: 'kimi', name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k',
keyUrl: 'https://platform.moonshot.cn/console/api-keys', keyHint: '在 Kimi 开放平台创建 API Key',
note: '长文本能力强，按量计费。'},
{ id: 'glm', name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash',
keyUrl: 'https://open.bigmodel.cn/usercenter/proj-mgmt/apikeys', keyHint: '在智谱开放平台创建 API Key',
note: 'glm-4-flash 模型有免费额度，适合先试用。'},
{ id: 'siliconflow', name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct',
keyUrl: 'https://cloud.siliconflow.cn/account/ak', keyHint: '在硅基流动控制台创建 API Key',
note: '部分模型免费，注册即有体验额度。'},
{ id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini',
keyUrl: 'https://platform.openai.com/api-keys', keyHint: '在 OpenAI 平台创建 API Key',
note: '需要境外支付方式，国内访问可能不稳定。'},
{ id: 'custom', name: '自定义接口', baseUrl: '', model: '',
keyUrl: '', keyHint: '填写任意 OpenAI 兼容接口的地址、Key 与模型名',
note: '本地部署（如 Ollama）或其它兼容服务请选这一项。'}
];
function presetById(id) {
for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i];
return null;
}

/* ---------------- 配置读写（Key 只存 localStorage） ---------------- */
function defaultConfig() {
return { mode: 'demo', provider: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-chat'};
}
function getConfig() {
try {
var raw = localStorage.getItem(CONFIG_KEY);
if (!raw) return defaultConfig();
var c = JSON.parse(raw);
var d = defaultConfig();
var mode = ['demo', 'function', 'custom'].indexOf(c.mode)!== -1? c.mode: 'demo';
/* GitHub Pages 没有 /api/chat，云端接口模式在此永远不可用，读到旧配置时直接当演示模式。 */
if (ON_PAGES && mode === 'function') mode = 'demo';
var provider = presetById(c.provider)? c.provider: (mode === 'custom'? 'custom': d.provider);
return {
mode: mode,
provider: provider,
baseUrl: typeof c.baseUrl === 'string'? c.baseUrl: d.baseUrl,
apiKey: typeof c.apiKey === 'string'? c.apiKey: d.apiKey,
model: typeof c.model === 'string' && c.model? c.model: d.model
};
} catch (e) { return defaultConfig();}
}
function setConfig(cfg) {
try {
var p = presetById(cfg.provider)? cfg.provider: 'custom';
localStorage.setItem(CONFIG_KEY, JSON.stringify({
mode: cfg.mode, provider: p,
baseUrl: cfg.baseUrl || '', apiKey: cfg.apiKey || '',
model: cfg.model || 'deepseek-chat'
}));
return true;
} catch (e) { return false;}
}

/* ---------------- 系统提示词 ---------------- */
var SYSTEM_PROMPT =
'你是高中化学 3D 考点工作台的 AI 化学助教，面向中国高中生备考高考化学。' +
'用中文回答，简明扼要，先给结论再讲原因；涉及计算时把公式、代入、结果分步写清楚，' +
'化学式用纯文本（如 H2SO4、Fe2O3），不要用 LaTeX。' +
'学生问“为什么”时用启发式讲解，不要只给答案；不确定的内容要明确说需要核对教材，绝不编造。' +
'回答供学习参考。';

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

/* ---------------- 错误转中文提示 ---------------- */
function describeError(err, status) {
  var code = status || (err && err.status) || 0;
  if (code === 401) return 'API Key 不正确或已失效，请在 AI 设置里检查 Key。';
  if (code === 402) return '账户余额不足，请到供应商平台充值。';
  if (code === 429) return '请求太频繁或额度用完，稍后再试。';
  if (code === 404) return '模型名或接口地址不对，请在 AI 设置里检查。';
  if (code === 400) return '请求被拒绝（400），可能是模型名或参数不对。';
  if (code >= 500) return '供应商服务暂时不可用（' + code + '），稍后再试。';
  if (err && err.name === 'AbortError') return '请求超时，请检查网络后重试。';
  if (err && err.name === 'TimeoutError') return '请求超时，请检查网络后重试。';
  if (err && err.message && /Failed to fetch|NetworkError|Network request failed/i.test(err.message)) {
    return '浏览器没能连上接口地址（网络或跨域问题），可换个供应商试试。';
  }
  if (err && err.message) return err.message;
  return '接口不可用。';
}
function apiError(message, status) {
  var e = new Error(message);
  e.status = status || 0;
  return e;
}

/* ---------------- 云端接口（仅 Netlify 部署；Pages 下无此接口） ---------------- */
async function callFunctionApi(text, tutor, signal) {
  var r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: text, context: tutor.current(), history: tutor.history.slice(-8) }),
    signal: signal
  });
  var d = await r.json().catch(function () { return null; });
  if (!r.ok || !d || typeof d.answer !== 'string' || !d.answer) {
    throw apiError((d && d.error) || '云端接口返回异常', r.status);
  }
  return d.answer;
}

/* ---------------- 自定义接口：非流式（测试连接用） ---------------- */
function buildMessages(text, history) {
  var msgs = [{ role: 'system', content: SYSTEM_PROMPT }];
  (history || []).slice(-8).forEach(function (h) {
    if (h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string' && h.content) {
      msgs.push({ role: h.role, content: h.content });
    }
  });
  msgs.push({ role: 'user', content: text });
  return msgs;
}
async function callCustomApi(text, cfg, signal, history) {
  var base = (cfg.baseUrl || '').replace(/\/+$/, '');
  if (!base) throw apiError('未配置接口地址', 0);
  var headers = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers.Authorization = 'Bearer ' + cfg.apiKey;
  var r = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      model: cfg.model || 'deepseek-chat',
      messages: buildMessages(text, history),
      temperature: 0.7
    }),
    signal: signal
  });
  var d = await r.json().catch(function () { return null; });
  var content = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
  if (!r.ok || typeof content !== 'string' || !content) {
    throw apiError((d && d.error && d.error.message) || '自定义接口返回异常', r.status);
  }
  return content;
}

/* ---------------- 自定义接口：流式（SSE，边生成边显示） ----------------
 * onDelta(fullText, isFirst) 在每次收到新增内容时回调。
 * 返回完整文本；收到 0 字时抛错（由上层降级为演示回答）。
 * 注意：fetch 流式读取需要 response.body；旧浏览器不支持时抛错走降级。 */
async function callCustomApiStream(text, cfg, signal, history, onDelta) {
  var base = (cfg.baseUrl || '').replace(/\/+$/, '');
  if (!base) throw apiError('未配置接口地址', 0);
  var headers = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers.Authorization = 'Bearer ' + cfg.apiKey;
  var r = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      model: cfg.model || 'deepseek-chat',
      messages: buildMessages(text, history),
      temperature: 0.7,
      stream: true
    }),
    signal: signal
  });
  if (!r.ok) {
    var d = await r.json().catch(function () { return null; });
    throw apiError((d && d.error && d.error.message) || '自定义接口返回异常', r.status);
  }
  if (!r.body || typeof r.body.getReader !== 'function') {
    /* 浏览器不支持流式读取：回退为非流式一次性请求。 */
    return callCustomApi(text, cfg, signal, history);
  }
  var reader = r.body.getReader();
  var decoder = new TextDecoder();
  var buffer = '';
  var full = '';
  var first = true;
  function handleLine(line) {
    line = line.trim();
    if (!line || line.indexOf('data:') !== 0) return;
    var data = line.slice(5).trim();
    if (!data || data === '[DONE]') return;
    var obj;
    try { obj = JSON.parse(data); } catch (e) { return; }
    var delta = obj && obj.choices && obj.choices[0] && obj.choices[0].delta && obj.choices[0].delta.content;
    if (typeof delta === 'string' && delta) {
      full += delta;
      if (onDelta) onDelta(full, first);
      first = false;
    }
  }
  for (;;) {
    var chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    var idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      handleLine(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 1);
    }
  }
  if (buffer) handleLine(buffer);
  if (!full) throw apiError('接口没有返回内容', 0);
  return full;
}

/* 走 API 提问：成功返回 true；失败返回 false（由调用方降级为演示回答）。
 * 用户主动点“停止”且已有部分内容时，保留部分内容并返回 true，不再降级。
 * 注意：用户消息在 API 成功后才回显；失败时由原始 send() 回显，避免重复。 */
async function sendViaApi(tutor, text, cfg) {
  var controller = new AbortController();
  var timedOut = false;
  var timeoutMs = cfg.mode === 'custom' ? STREAM_TIMEOUT_MS : API_TIMEOUT_MS;
  var timeout = setTimeout(function () { timedOut = true; controller.abort(); }, timeoutMs);
  var pending = null;
  var bodyEl = null;
  var tagEl = null;
  var streamed = '';
  var sendBtn = document.getElementById('caSend');
  var stopBtn = document.getElementById('caStop');
  var errEl = document.getElementById('caError');
  var providerName = (presetById(cfg.provider) || {}).name || '自定义接口';
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
    bodyEl = pending ? pending.querySelector('.ca-text') : null;
    tagEl = pending ? pending.querySelector('.ca-tag') : null;
    var answer;
    if (cfg.mode === 'custom') {
      answer = await callCustomApiStream(text, cfg, controller.signal, tutor.history, function (full, isFirst) {
        streamed = full;
        if (isFirst && tagEl) tagEl.textContent = '化学助教 · 大模型';
        if (bodyEl) {
          bodyEl.textContent = full;
          var box = document.getElementById('caMessages');
          if (box) box.scrollTop = box.scrollHeight;
        }
      });
    } else {
      answer = await callFunctionApi(text, tutor, controller.signal);
    }
    if (pending) pending.remove();
    tutor.message('user', text);
    tutor.message('assistant', answer, [], [], '化学助教 · 大模型（' + providerName + '）');
    tutor.history.push({ role: 'user', content: text }, { role: 'assistant', content: answer });
    tutor.history = tutor.history.slice(-8);
    return true;
  } catch (e) {
    /* 用户主动停止：有内容就保留，没有内容就当作没问过，不降级演示。 */
    if (e && e.name === 'AbortError' && !timedOut) {
      if (streamed) {
        if (bodyEl) bodyEl.textContent = streamed;
        if (tagEl) tagEl.textContent = '化学助教 · 大模型（已停止）';
        tutor.message('user', text);
        tutor.history.push({ role: 'user', content: text }, { role: 'assistant', content: streamed });
        tutor.history = tutor.history.slice(-8);
      } else if (pending) {
        pending.remove();
      }
      return true;
    }
    if (pending) pending.remove();
    /* 把中文原因记下来，降级后显示在助教面板。 */
    sendViaApi.lastError = describeError(e);
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
    /* 自定义接口没填 Key：直接演示回答，并提示去填 Key（不再发注定失败的请求）。 */
    if (cfg.mode === 'custom' && !cfg.apiKey) {
      await orig.call(T, text);
      var errEl0 = document.getElementById('caError');
      if (errEl0) errEl0.textContent = '还没填 API Key，已用演示模式回答；点“AI 设置”填入 Key 即可用真 AI。';
      return;
    }
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
    if (errEl) errEl.textContent = (sendViaApi.lastError || '接口不可用') + '已切换为演示模式。';
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
    var p = presetById(cfg.provider);
    modeEl.textContent = cfg.apiKey
      ? '大模型 · ' + (p ? p.name : '自定义接口') + ' · ' + cfg.model
      : '大模型未配置 Key · 点“AI 设置”填写';
    modeEl.classList.add('connected');
  } else if (cfg.mode === 'function') {
    modeEl.textContent = '云端接口 · 未配置服务端 Key 时自动演示';
    modeEl.classList.add('connected');
  } else {
    modeEl.textContent = '演示模式 · 点“AI 设置”接通大模型';
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
    '演示模式使用内置规则回答，不消耗任何接口额度。选一个供应商、填入它的 API Key，' +
    '即可用真正的大模型问答（费用由你的供应商账户承担）。' +
    'Key 只保存在本机浏览器里，不会上传到本站服务器，只随请求发给你选的供应商。');
  var status = el('p', 'chem2-status');
  status.setAttribute('role', 'status');
  var form = document.createElement('form');
  form.className = 'chem2-form';
  form.setAttribute('novalidate', '');

  var modeLabel = el('label', 'chem2-field', '问答模式');
  var modeSelect = document.createElement('select');
  var modeOptions = [
    ['demo', '演示模式（内置规则回答）'],
    ['custom', '大模型接口（填自己的 Key）']
  ];
  /* 云端接口只在 Netlify 部署下存在；GitHub Pages 上不提供该选项。 */
  if (!ON_PAGES) modeOptions.push(['function', '云端接口（本站 Netlify 函数，需服务端配置 Key）']);
  modeOptions.forEach(function (opt) {
    var o = document.createElement('option');
    o.value = opt[0]; o.textContent = opt[1];
    modeSelect.appendChild(o);
  });
  modeSelect.value = cfg.mode;
  modeLabel.appendChild(modeSelect);

  /* 供应商预设（一键填入接口地址与模型名）。 */
  var presetLabel = el('label', 'chem2-field', '供应商（点一个，地址和模型自动填好）');
  var presetRow = el('div', 'chem2-presets');
  var presetBtns = {};
  PRESETS.forEach(function (p) {
    var b = el('button', 'btn-sub', p.name);
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function () { applyPreset(p.id, true); });
    presetBtns[p.id] = b;
    presetRow.appendChild(b);
  });
  presetLabel.appendChild(presetRow);

  var keyHelp = el('p', 'chem2-note');
  var keyLink = document.createElement('a');
  keyLink.target = '_blank';
  keyLink.rel = 'noopener';

  var baseLabel = el('label', 'chem2-field', 'API Base URL');
  var baseInput = document.createElement('input');
  baseInput.type = 'url'; baseInput.placeholder = '例如 https://api.deepseek.com/v1';
  baseInput.value = cfg.baseUrl || '';
  baseInput.autocomplete = 'off';
  baseLabel.appendChild(baseInput);

  var keyLabel = el('label', 'chem2-field', 'API Key');
  var keyInput = document.createElement('input');
  keyInput.type = 'password'; keyInput.placeholder = '只存本机浏览器，不进代码';
  keyInput.value = cfg.apiKey || '';
  keyInput.autocomplete = 'off';
  keyLabel.appendChild(keyInput);

  var modelLabel = el('label', 'chem2-field', '模型名');
  var modelInput = document.createElement('input');
  modelInput.type = 'text'; modelInput.placeholder = '例如 deepseek-chat';
  modelInput.value = cfg.model || 'deepseek-chat';
  modelInput.autocomplete = 'off';
  modelLabel.appendChild(modelInput);

  var cspNote = el('p', 'chem2-note',
    '如果测试连接报“网络或跨域问题”，说明浏览器没能连上该供应商，可换个供应商试试，' +
    '或检查网络；保存后提问失败时会自动降级为演示模式，不影响使用。');
  var saveBtn = el('button', 'btn-main', '保存设置');
  saveBtn.type = 'submit';
  var testBtn = el('button', 'btn-sub', '测试连接');
  testBtn.type = 'button';
  var demoBtn = el('button', 'btn-sub', '恢复演示模式');
  demoBtn.type = 'button';
  var closeBtn = el('button', 'chem2-x', '×');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', '关闭');

  var currentProvider = cfg.provider || 'deepseek';
  function applyPreset(id, fill) {
    var p = presetById(id);
    if (!p) return;
    currentProvider = id;
    PRESETS.forEach(function (x) {
      var b = presetBtns[x.id];
      if (!b) return;
      var on = x.id === id;
      b.className = on ? 'btn-main' : 'btn-sub';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (fill) {
      baseInput.value = p.baseUrl;
      modelInput.value = p.model;
    }
    keyHelp.textContent = p.keyHint + '。' + p.note + ' ';
    if (p.keyUrl) {
      keyLink.href = p.keyUrl;
      keyLink.textContent = '去获取 Key ↗';
      keyHelp.appendChild(keyLink);
    }
  }
  /* 手动改地址或模型名后，视为自定义接口。 */
  function onManualEdit() {
    if (currentProvider === 'custom') return;
    var p = presetById(currentProvider);
    if (p && (baseInput.value.trim() !== p.baseUrl || modelInput.value.trim() !== p.model)) {
      applyPreset('custom', false);
    }
  }
  baseInput.addEventListener('input', onManualEdit);
  modelInput.addEventListener('input', onManualEdit);

  function syncFields() {
    var custom = modeSelect.value === 'custom';
    var fn = modeSelect.value === 'function';
    presetLabel.style.display = custom ? '' : 'none';
    keyHelp.style.display = custom ? '' : 'none';
    baseLabel.style.display = custom ? '' : 'none';
    keyLabel.style.display = custom ? '' : 'none';
    modelLabel.style.display = custom ? '' : 'none';
    cspNote.style.display = custom ? '' : 'none';
    testBtn.style.display = modeSelect.value === 'demo' ? 'none' : '';
    if (fn) status.textContent = '云端接口由本站服务端调用大模型，费用由站点所有者承担；未配置服务端 Key 时自动用演示模式回答。';
    else if (status.textContent.indexOf('云端接口由本站') === 0) status.textContent = '';
  }
  modeSelect.addEventListener('change', syncFields);
  applyPreset(currentProvider, false);
  syncFields();

  form.append(modeLabel, presetLabel, keyHelp, baseLabel, keyLabel, modelLabel, cspNote, status, saveBtn, testBtn, demoBtn);
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
    setConfig({ mode: 'demo', provider: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-chat' });
    refreshStatus();
    toast('已恢复演示模式。');
    closeSettings();
  });
  testBtn.addEventListener('click', async function () {
    var testCfg = {
      mode: modeSelect.value,
      provider: currentProvider,
      baseUrl: baseInput.value.trim(),
      apiKey: keyInput.value.trim(),
      model: modelInput.value.trim() || 'deepseek-chat'
    };
    if (testCfg.mode === 'demo') { status.textContent = '演示模式无需测试。'; return; }
    if (testCfg.mode === 'custom' && !testCfg.baseUrl) { status.textContent = '请先选供应商或填写 API Base URL。'; return; }
    if (testCfg.mode === 'custom' && !testCfg.apiKey) { status.textContent = '请先填写 API Key（按上方提示去供应商平台获取）。'; return; }
    status.textContent = '正在测试连接…';
    testBtn.disabled = true;
    try {
      var T = window.ChemTutor;
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, API_TIMEOUT_MS);
      var reply = testCfg.mode === 'custom'
        ? await callCustomApi('你好，请用一句话介绍你自己。', testCfg, controller.signal, [])
        : await callFunctionApi('你好，请用一句话介绍你自己。', T, controller.signal);
      clearTimeout(timer);
      status.textContent = '连接成功：' + reply.slice(0, 80);
    } catch (e) {
      status.textContent = '连接失败：' + describeError(e) + '保存后提问时将自动降级为演示模式。';
    } finally {
      testBtn.disabled = false;
    }
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var next = {
      mode: modeSelect.value,
      provider: currentProvider,
      baseUrl: baseInput.value.trim(),
      apiKey: keyInput.value.trim(),
      model: modelInput.value.trim() || 'deepseek-chat'
    };
    if (next.mode === 'custom' && !next.baseUrl) {
      status.textContent = '请先选供应商或填写 API Base URL。';
      return;
    }
    setConfig(next);
    refreshStatus();
    toast(next.mode === 'demo' ? '已切换为演示模式。' : (next.apiKey ? 'AI 设置已保存，可以开始提问了。' : 'AI 设置已保存，填入 API Key 后即可用真 AI。'));
    closeSettings();
  });
}

/* ---------------- 接管助教面板的“连接”按钮 ----------------
 * 原站该按钮打开 Tutor.settings（本机服务配置），在线上部署下永远不可用；
 * 本轮改为打开本模块的 AI 设置面板，全站只剩一个大模型配置入口。
 * 旧版 ai-config 曾额外注入第二个“AI 设置”按钮，本轮不再注入；若页面上
 * 已有该按钮（不会发生，仅作防御），一并移除。 */
function rewireSettingsButton() {
  var btn = document.getElementById('caSettings');
  if (!btn) return false;
  if (!btn.__chemAIRewired) {
    btn.__chemAIRewired = true;
    btn.textContent = 'AI 设置';
    btn.title = '配置大模型（供应商 / API Key / 模型）';
    btn.onclick = function () { openSettings(); };
  }
  var dup = document.getElementById('chem2AiSettings');
  if (dup) dup.remove();
  return true;
}

/* ---------------- 初始化（带有限重试，防脚本加载顺序变化） ---------------- */
(function init(attempt) {
  var okLocal = wrapTutorLocal();
  var okSend = wrapTutorSend();
  wrapSetStatus();
  var okBtn = rewireSettingsButton();
  refreshStatus();
  if ((okLocal && okSend && okBtn) || attempt >= 10) return;
  setTimeout(function () { init(attempt + 1); }, 500);
})(0);

/* ---------------- 对外接口 ---------------- */
window.ChemAI = {
  getConfig: getConfig,
  setConfig: setConfig,
  openSettings: openSettings,
  closeSettings: closeSettings,
  refreshStatus: refreshStatus,
  /* 供应商预设（供设置面板与测试复用）。 */
  PRESETS: PRESETS,
  presetById: presetById,
  /* 演示知识库查询（供测试与复用；无命中返回 null）。 */
  demoAnswer: demoAnswer,
  DEMO_NOTICE: DEMO_NOTICE,
  /* 供测试的内部接口。 */
  _test: {
    describeError: describeError,
    buildMessages: buildMessages,
    callCustomApi: callCustomApi,
    callCustomApiStream: callCustomApiStream,
    isGitHubPages: ON_PAGES
  }
};

})();
