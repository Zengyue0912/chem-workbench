/* ============================================================================
 * 高中化学 3D 考点工作台 — 大模型配置模块测试集（v2.3.0）
 *
 * 运行方法（零依赖，纯 Node 断言，无测试框架）：
 *   cd ~/workspace/chem-workbench/optimized
 *   node tests/ai-config.test.js
 *
 * 运行后打印“通过 X/Y”；全部通过时退出码为 0，任一失败时退出码为 1。
 * 本文件不打包进首屏，不进入 sw.js 预缓存。
 * 注意：测试用桩对象模拟浏览器环境（localStorage / document / fetch），
 * 不发真实网络请求，不需要真实 API Key。
 * ========================================================================== */
'use strict';

/* ---------- 浏览器环境桩（必须在 require 模块之前装好） ---------- */
var store = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; }
};
global.location = { hostname: 'zengyue0912.github.io' }; /* 模拟 GitHub Pages 部署 */
function fakeEl() {
  return {
    textContent: '', innerHTML: '', value: '', style: {}, hidden: false, disabled: false,
    classList: { add: function () {}, remove: function () {}, toggle: function () {} },
    setAttribute: function () {}, appendChild: function () {}, remove: function () {},
    addEventListener: function () {}, querySelector: function () { return null; },
    focus: function () {}
  };
}
global.document = {
  getElementById: function () { return fakeEl(); },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  createElement: function () { return fakeEl(); },
  body: fakeEl()
};
global.window = {
  ChemTutor: {
    local: function () { return { answer: '本地回答' }; },
    send: function () {},
    setStatus: function () {},
    current: function () { return {}; },
    history: []
  },
  alert: function () {}
};

var AI = require('../js/ai-config.js').ChemAI || global.window.ChemAI;

var passed = 0, total = 0, failures = [];
function test(name, fn) {
  total++;
  try {
    var r = fn();
    if (r && typeof r.then === 'function') {
      return r.then(function () { passed++; console.log('  ✓ ' + name); })
        .catch(function (e) { failures.push(name + ' — ' + e.message); console.log('  ✗ ' + name + ' — ' + e.message); });
    }
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failures.push(name + ' — ' + e.message);
    console.log('  ✗ ' + name + ' — ' + e.message);
  }
  return Promise.resolve();
}
function eq(a, b, msg) {
  if (a !== b) throw new Error((msg || '') + '期望 ' + JSON.stringify(b) + '，实际 ' + JSON.stringify(a));
}
function ok(v, msg) { if (!v) throw new Error(msg || '期望为真'); }

async function run() {
  /* ---------- 配置读写 ---------- */
  await test('默认配置：演示模式 + DeepSeek 预设', function () {
    var c = AI.getConfig();
    eq(c.mode, 'demo');
    eq(c.provider, 'deepseek');
    eq(c.baseUrl, 'https://api.deepseek.com/v1');
    eq(c.model, 'deepseek-chat');
    eq(c.apiKey, '');
  });
  await test('配置存取往返一致', function () {
    AI.setConfig({ mode: 'custom', provider: 'kimi', baseUrl: 'https://api.moonshot.cn/v1', apiKey: 'test-key', model: 'moonshot-v1-8k' });
    var c = AI.getConfig();
    eq(c.mode, 'custom'); eq(c.provider, 'kimi'); eq(c.apiKey, 'test-key'); eq(c.model, 'moonshot-v1-8k');
    AI.setConfig({ mode: 'demo', provider: 'deepseek', baseUrl: '', apiKey: '', model: '' });
  });
  await test('非法 provider 回落为 custom', function () {
    AI.setConfig({ mode: 'custom', provider: '不存在', baseUrl: 'https://x.example/v1', apiKey: '', model: 'm' });
    eq(AI.getConfig().provider, 'custom');
    AI.setConfig({ mode: 'demo', provider: 'deepseek', baseUrl: '', apiKey: '', model: '' });
  });
  await test('Pages 下旧的云端接口配置读回为演示模式', function () {
    store.chem3d_ai_config_v1 = JSON.stringify({ mode: 'function', provider: 'deepseek', baseUrl: '', apiKey: '', model: 'deepseek-chat' });
    eq(AI.getConfig().mode, 'demo');
    delete store.chem3d_ai_config_v1;
  });
  await test('损坏的配置 JSON 回落为默认配置', function () {
    store.chem3d_ai_config_v1 = '{坏json';
    eq(AI.getConfig().mode, 'demo');
    delete store.chem3d_ai_config_v1;
  });

  /* ---------- 预设 ---------- */
  await test('预设完整：7 个供应商，字段齐全且地址均为 https', function () {
    eq(AI.PRESETS.length, 7);
    AI.PRESETS.forEach(function (p) {
      ok(p.id && p.name && p.keyHint && p.note, '预设 ' + p.id + ' 字段缺失');
      if (p.id !== 'custom') {
        ok(p.baseUrl.indexOf('https://') === 0, '预设 ' + p.id + ' 地址不是 https');
        ok(p.model, '预设 ' + p.id + ' 缺模型名');
        ok(p.keyUrl.indexOf('https://') === 0, '预设 ' + p.id + ' 缺 Key 获取链接');
      }
    });
  });
  await test('DeepSeek 预设地址与模型正确', function () {
    var p = AI.presetById('deepseek');
    eq(p.baseUrl, 'https://api.deepseek.com/v1');
    eq(p.model, 'deepseek-chat');
  });
  await test('presetById 查不到返回 null', function () {
    eq(AI.presetById('nope'), null);
  });

  /* ---------- 错误提示 ---------- */
  await test('错误提示：401/429/404/网络各有中文说明', function () {
    ok(AI._test.describeError({}, 401).indexOf('Key') !== -1, '401 应提示 Key');
    ok(AI._test.describeError({}, 429).indexOf('频繁') !== -1 || AI._test.describeError({}, 429).indexOf('额度') !== -1, '429 应提示限流/额度');
    ok(AI._test.describeError({}, 404).indexOf('模型名') !== -1, '404 应提示模型名/地址');
    ok(AI._test.describeError(new Error('Failed to fetch'), 0).indexOf('跨域') !== -1, '网络错误应提示跨域');
  });

  /* ---------- 消息组装 ---------- */
  await test('buildMessages：系统提示 + 历史（最多 8 条）+ 当前问题', function () {
    var history = [];
    for (var i = 0; i < 12; i++) history.push({ role: i % 2 ? 'assistant' : 'user', content: 'h' + i });
    var msgs = AI._test.buildMessages('新问题', history);
    eq(msgs[0].role, 'system');
    eq(msgs.length, 10); /* 1 系统 + 8 历史 + 1 当前 */
    eq(msgs[msgs.length - 1].content, '新问题');
    eq(msgs[1].content, 'h4'); /* 只保留最后 8 条历史 */
  });

  /* ---------- 演示知识库（回归：v2.3.0 重写不得丢内容） ---------- */
  await test('演示知识库命中与未命中', function () {
    ok(AI.demoAnswer('滴定终点怎么判断') && AI.demoAnswer('滴定终点怎么判断').indexOf('酚酞') !== -1);
    eq(AI.demoAnswer('今天天气怎么样'), null);
  });

  /* ---------- 非流式调用（mock fetch） ---------- */
  await test('callCustomApi：成功返回内容，且请求带历史与正确模型', async function () {
    var seen = null;
    global.fetch = async function (url, opts) {
      seen = { url: url, body: JSON.parse(opts.body), auth: opts.headers.Authorization };
      return { ok: true, status: 200, json: async function () { return { choices: [{ message: { content: '你好，我是助教' } }] }; } };
    };
    var out = await AI._test.callCustomApi('你好', { baseUrl: 'https://api.deepseek.com/v1', apiKey: 'k123', model: 'deepseek-chat' }, null, [{ role: 'user', content: '旧问题' }]);
    eq(out, '你好，我是助教');
    eq(seen.url, 'https://api.deepseek.com/v1/chat/completions');
    eq(seen.auth, 'Bearer k123');
    eq(seen.body.model, 'deepseek-chat');
    eq(seen.body.messages.length, 3); /* 系统 + 1 历史 + 当前 */
  });
  await test('callCustomApi：401 抛错且带 status', async function () {
    global.fetch = async function () {
      return { ok: false, status: 401, json: async function () { return { error: { message: 'Incorrect API key' } }; } };
    };
    var caught = null;
    try {
      await AI._test.callCustomApi('你好', { baseUrl: 'https://api.deepseek.com/v1', apiKey: 'bad', model: 'deepseek-chat' }, null, []);
    } catch (e) { caught = e; }
    ok(caught, '应当抛错');
    eq(caught.status, 401);
  });
  await test('callCustomApi：未配地址抛错', async function () {
    var caught = null;
    try {
      await AI._test.callCustomApi('你好', { baseUrl: '', apiKey: '', model: '' }, null, []);
    } catch (e) { caught = e; }
    ok(caught && caught.message.indexOf('接口地址') !== -1);
  });

  /* ---------- 流式调用（mock SSE） ---------- */
  function sseResponse(chunks) {
    var enc = new TextEncoder();
    var queue = chunks.map(function (c) { return enc.encode(c); });
    return {
      ok: true, status: 200,
      body: { getReader: function () {
        return { read: async function () {
          if (!queue.length) return { done: true };
          return { done: false, value: queue.shift() };
        } };
      } }
    };
  }
  await test('callCustomApiStream：SSE 分块拼接出完整回答，onDelta 逐步回调', async function () {
    global.fetch = async function () {
      return sseResponse([
        'data: {"choices":[{"delta":{"content":"酸"}}]}\n\ndata: {"choices":[{"delta":{"content":"碱"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"滴定"}}]}\n\ndata: [DONE]\n\n'
      ]);
    };
    var deltas = [];
    var out = await AI._test.callCustomApiStream('讲滴定', { baseUrl: 'https://api.deepseek.com/v1', apiKey: 'k', model: 'deepseek-chat' }, null, [], function (full) { deltas.push(full); });
    eq(out, '酸碱滴定');
    eq(deltas.length, 3);
    eq(deltas[2], '酸碱滴定');
  });
  await test('callCustomApiStream：空流抛错（上层据此降级演示）', async function () {
    global.fetch = async function () { return sseResponse(['data: [DONE]\n\n']); };
    var caught = null;
    try {
      await AI._test.callCustomApiStream('讲滴定', { baseUrl: 'https://api.deepseek.com/v1', apiKey: 'k', model: 'deepseek-chat' }, null, [], null);
    } catch (e) { caught = e; }
    ok(caught, '空流应当抛错');
  });
  await test('callCustomApiStream：无 body 时回退非流式', async function () {
    var calls = 0;
    global.fetch = async function () {
      calls++;
      return { ok: true, status: 200, body: null, json: async function () { return { choices: [{ message: { content: '回退回答' } }] }; } };
    };
    var out = await AI._test.callCustomApiStream('讲滴定', { baseUrl: 'https://api.deepseek.com/v1', apiKey: 'k', model: 'deepseek-chat' }, null, [], null);
    eq(out, '回退回答');
    eq(calls, 2); /* 流式请求 + 回退的非流式请求 */
  });

  /* ---------- 安全：源码里不得有真实 Key ---------- */
  await test('源码不含真实 API Key 痕迹', function () {
    var fs = require('fs');
    var src = fs.readFileSync(require('path').join(__dirname, '..', 'js', 'ai-config.js'), 'utf-8');
    ok(src.indexOf('sk-') === -1 || src.indexOf("sk-'") !== -1, '源码不得出现 sk- 开头的 Key');
    /* 允许出现 'sk-' 仅作为字符串字面量检查时已在上一行处理；这里直接确认无 sk- 后跟长串的情况 */
    ok(!/sk-[A-Za-z0-9]{8,}/.test(src), '源码不得出现真实 Key 形态');
  });

  console.log('\n通过 ' + passed + '/' + total);
  if (failures.length) {
    console.log('失败：');
    failures.forEach(function (f) { console.log('  - ' + f); });
    process.exit(1);
  }
}

run().catch(function (e) { console.error('测试运行异常：', e); process.exit(1); });
