/* ============================================================================
 * 高中化学 3D 考点工作台 — AI 问答 Netlify Function（工作流 2：占位骨架）
 * ============================================================================
 * 部署位置：netlify/functions/chat.js，访问地址 /.netlify/functions/chat；
 * 前端调用同源 /api/chat，由 netlify.toml 的 redirect 重写到本函数。
 *
 * 【当前状态：占位实现】本函数已完整实现“转发到兼容接口”的骨架，
 * 但只有在服务端配置了大模型 Key 后才会真正调用模型；未配置时返回
 * 501，前端 js/ai-config.js 会自动降级为演示模式回答，不影响使用。
 *
 * 【如何接通服务端大模型】
 *  1. 在 Netlify 控制台 → Site settings → Environment variables 里设置：
 *       DEEPSEEK_API_KEY = 你的 DeepSeek Key（或 OPENAI_API_KEY）
 *     Key 只放环境变量，绝不写进代码、绝不提交到仓库。
 *  2. 默认转发到 DeepSeek（https://api.deepseek.com/v1/chat/completions，
 *     模型 deepseek-chat）。要换提供商，改下方 PROVIDER 配置即可：
 *       - OpenAI：baseUrl https://api.openai.com/v1，model gpt-4o-mini，
 *         环境变量 OPENAI_API_KEY；
 *       - 其他 OpenAI 兼容接口：改 baseUrl + 对应环境变量名。
 *  3. 重新部署后，前端在“AI 设置”里选“云端接口”即可使用。
 *     想让所有用户默认走云端接口，把 js/ai-config.js 的 defaultConfig
 *     mode 由 'demo' 改为 'function'（并确认服务端 Key 已配置）。
 *
 * 【安全要点】
 *  - 本函数是服务端代码，Key 不会暴露给浏览器；不要在前端代码里放 Key。
 *  - 正式上线前建议加：按 IP / 按用户的速率限制、请求体大小限制、
 *    问题长度上限、敏感词过滤，以及把回答记入日志便于排查。
 *  - 费用由站点所有者的模型账户承担；请在提供商控制台设置消费上限。
 *
 * 请求格式（与前端 js/ai-config.js 的 callFunctionApi 对应）：
 *   POST /api/chat  {question, context, history:[{role, content}]}
 * 响应格式：
 *   成功 200 {answer, sources: []}
 *   未配置 Key 501 {error}
 *   上游失败 502 {error}
 * ========================================================================== */
'use strict';

/* 提供商配置：默认 DeepSeek；换提供商只改这里 + 环境变量名。 */
const PROVIDER = {
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  apiKeyEnv: 'DEEPSEEK_API_KEY',
  /* 备用 Key（可选）：未设置 DEEPSEEK_API_KEY 时尝试 OPENAI_API_KEY，
   * 此时仍请求上方 baseUrl；如需同时换 baseUrl，请改用下方注释的方案。 */
  fallbackApiKeyEnv: 'OPENAI_API_KEY'
};

const SYSTEM_PROMPT =
  '你是高中化学 3D 考点工作台的 AI 化学助教，用中文简明回答高中化学问题。' +
  '回答要紧扣提问，结合给出的当前模型/实验上下文；不确定的内容要说明需要核对教材，' +
  '不要编造不存在的实验数据、反应条件或真题出处。回答供学习参考。';

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(obj)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    /* 同源调用不需要 CORS；保留 OPTIONS 透传，方便本地联调。 */
    return { statusCode: 204, headers: { Allow: 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: '仅支持 POST 请求。' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: '请求体不是合法 JSON。' });
  }
  const question = typeof payload.question === 'string' ? payload.question.trim() : '';
  if (!question) return json(400, { error: '问题不能为空。' });
  if (question.length > 3000) return json(400, { error: '单次问题请控制在 3000 字以内。' });

  /* Key 只从环境变量读取；未配置时明确返回 501，前端自动降级为演示模式。 */
  const apiKey = process.env[PROVIDER.apiKeyEnv] || process.env[PROVIDER.fallbackApiKeyEnv] || '';
  if (!apiKey) {
    return json(501, {
      error: '服务端尚未配置大模型 Key（环境变量 ' + PROVIDER.apiKeyEnv + '），已自动使用演示模式。'
    });
  }

  /* 组装对话：系统提示 + 最近 4 轮历史 + 当前问题（含上下文摘要）。 */
  const history = Array.isArray(payload.history) ? payload.history.slice(-8) : [];
  const context = payload.context && typeof payload.context === 'object' ? payload.context : null;
  const contextLine = context && context.name
    ? '（当前页面：' + context.name + (context.step ? ' · ' + context.step.title : '') + '）'
    : '';
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  history.forEach((m) => {
    if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') {
      messages.push({ role: m.role, content: m.content.slice(0, 2000) });
    }
  });
  messages.push({ role: 'user', content: contextLine ? contextLine + '\n' + question : question });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);
  try {
    const upstream = await fetch(PROVIDER.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey
      },
      body: JSON.stringify({ model: PROVIDER.model, messages, temperature: 0.7 }),
      signal: controller.signal
    });
    const data = await upstream.json().catch(() => null);
    const answer = data && data.choices && data.choices[0] &&
      data.choices[0].message && data.choices[0].message.content;
    if (!upstream.ok || typeof answer !== 'string' || !answer) {
      const detail = (data && data.error && data.error.message) || '上游模型接口返回异常';
      return json(502, { error: detail });
    }
    return json(200, { answer, sources: [] });
  } catch (e) {
    return json(502, { error: e && e.name === 'AbortError' ? '模型请求超时，请重试。' : '模型请求失败，请重试。' });
  } finally {
    clearTimeout(timer);
  }
};
