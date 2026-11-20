/* ============================================================================
 * 高中化学 3D 考点工作台 — 账号系统（工作流 2：商业化产品外壳）
 * ============================================================================
 * 【演示级本地账号】本模块为演示实现：
 *  - 账号、密码哈希、会话全部只保存在本机浏览器 localStorage，不上传服务器；
 *  - 密码经 SHA-256（Web Crypto API，加盐）哈希后存储，明文密码不落盘；
 *  - 清除浏览器数据、换设备或换浏览器后账号即丢失，需重新注册；
 *  - 不要用真实重要密码注册本站演示账号。
 *
 * 加载位置：app.html 中排在 js/loader.js 之前（defer，按文档顺序执行）。
 * 原因：本文件在执行时同步完成“账号命名空间换入”，保证后续工作台脚本
 * （loader / inline-* / student-study 等）读到的 localStorage 已是当前
 * 账号的数据。登录/登出发生在运行时，则先换命名空间再 location.reload()，
 * 让工作台重新读取——全程不改动工作流 1 的任何 JS 源码。
 *
 * 【接后端抽象层】对外只暴露 window.ChemAuth；真正的账号存取走 AuthProvider
 * 接口（见下方 LocalAuthProvider）。要接真实后端时：
 *   1. 实现一个同签名的新 Provider，例如 SupabaseAuthProvider：
 *      - register(username, password) -> Promise<user>
 *      - login(username, password)    -> Promise<user>
 *      - logout()                     -> Promise<void>
 *      - getSession()                 -> session | null（同步读缓存即可）
 *      - getUser(userId)              -> user | null
 *      - updateUser(userId, patch)    -> Promise<user>
 *      - listUsers()                  -> user[]（仅本地演示需要，后端版可返回 []）
 *   2. 在本文件末尾把 `provider` 换成新实例，或在页面加载后执行：
 *        ChemAuth.setProvider(new SupabaseAuthProvider(supabaseClient));
 *   3. 命名空间隔离（switchAccount）仍可复用：登录成功后调用
 *      ChemAuth.switchAccount(user.id) 即可把本机数据按账号隔离；
 *      若后端已做云端同步，可把 switchAccount 换成从云端拉取。
 * ========================================================================== */
(function () {
'use strict';

/* ---------------- 存储键 ---------------- */
var USERS_KEY = 'chem3d_auth_users_v1';     // 演示账号表（本机）
var SESSION_KEY = 'chem3d_auth_session_v1'; // 当前会话 {userId, username, loginAt}
var LIVE_KEY = 'chem3d_acct_live_v1';       // 当前“已换入 live 区”的账号 id
var GUEST_ID = 'guest';                     // 未登录游客的账号 id

/* 需要按账号隔离的学习数据键：工作台全部 localStorage 键名前缀。
 * 覆盖：chem3d_* / chem3d_v2_*（报告/收藏/进度等）、chem_*（错题本/教案/
 * 练习/真题空间/课堂队列等）、chem-*（学生学习进度 chem-student-study-v1）。 */
var SWAPPABLE_RE = /^(chem3d_|chem3d_v2_|chem_|chem-)/;
/* 本工作流自己的元数据键，不参与换入换出（否则会把账号表本身换走）。 */
var META_RE = /^(chem3d_acct_|chem3d_auth_|chem3d_plan_|chem3d_ai_|chem3d_onboard_)/;

function isSwappable(key) { return SWAPPABLE_RE.test(key) && !META_RE.test(key); }
function acctKey(userId) { return 'chem3d_acct_' + userId + '_v1'; }

function readJSON(key, fallback) {
  try { var v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
  catch (e) { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { return false; }
}

/* ---------------- 密码哈希（SHA-256 + 随机盐） ---------------- */
function toHex(buf) {
  return Array.prototype.map.call(new Uint8Array(buf),
    function (b) { return ('00' + b.toString(16)).slice(-2); }).join('');
}
function randomSalt() {
  var bytes = new Uint8Array(16);
  if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
  else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return toHex(bytes.buffer);
}
/* 优先 Web Crypto；非安全上下文（如 file://）无 crypto.subtle 时退回
 * FNV-1a 演示哈希并明确标注——演示账号不做安全承诺。 */
async function hashPassword(password, salt) {
  var data = new TextEncoder().encode(salt + ':' + password);
  if (window.crypto && window.crypto.subtle) {
    return { algo: 'sha256', hash: toHex(await window.crypto.subtle.digest('SHA-256', data)) };
  }
  var h = 0x811c9dc5;
  for (var i = 0; i < data.length; i++) { h ^= data[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  return { algo: 'fnv1a-demo', hash: ('00000000' + h.toString(16)).slice(-8) };
}

/* ---------------- AuthProvider 接口（本地演示实现） ----------------
 * 接口约定（见文件头注释）：register / login / logout / getSession /
 * getUser / updateUser / listUsers。user 对象：{id, username, salt,
 * hash, algo, plan, createdAt}。plan 取值 'free' | 'pro' | 'school'，
 * 由 js/plan.js 读写（演示开通 Pro 时经 updateUser 写入）。 */
function LocalAuthProvider() {}
LocalAuthProvider.prototype.listUsers = function () {
  var users = readJSON(USERS_KEY, []);
  return Array.isArray(users) ? users : [];
};
LocalAuthProvider.prototype._saveUsers = function (users) { writeJSON(USERS_KEY, users); };
LocalAuthProvider.prototype.getUser = function (userId) {
  var found = null;
  this.listUsers().forEach(function (u) { if (u.id === userId) found = u; });
  return found;
};
LocalAuthProvider.prototype.getSession = function () {
  var s = readJSON(SESSION_KEY, null);
  return s && s.userId ? s : null;
};
LocalAuthProvider.prototype._setSession = function (session) {
  if (session) writeJSON(SESSION_KEY, session);
  else { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }
};
LocalAuthProvider.prototype.register = async function (username, password) {
  username = String(username || '').trim();
  if (!/^[\u4e00-\u9fa5A-Za-z0-9_]{2,20}$/.test(username)) {
    throw new Error('用户名为 2–20 个字符，可用中文、字母、数字、下划线。');
  }
  if (typeof password !== 'string' || password.length < 6) {
    throw new Error('密码至少 6 位。演示账号请勿使用真实重要密码。');
  }
  var users = this.listUsers();
  var taken = users.some(function (u) { return u.username === username; });
  if (taken) throw new Error('该用户名已被注册，请换一个。');
  var salt = randomSalt();
  var hashed = await hashPassword(password, salt);
  var user = {
    id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    username: username, salt: salt, hash: hashed.hash, algo: hashed.algo,
    plan: 'free', createdAt: new Date().toISOString()
  };
  users.push(user);
  this._saveUsers(users);
  return user;
};
LocalAuthProvider.prototype.login = async function (username, password) {
  username = String(username || '').trim();
  var user = null;
  this.listUsers().forEach(function (u) { if (u.username === username) user = u; });
  if (!user) throw new Error('用户名或密码不正确。');
  var hashed = await hashPassword(password, user.salt);
  if (hashed.hash !== user.hash) throw new Error('用户名或密码不正确。');
  this._setSession({ userId: user.id, username: user.username, loginAt: new Date().toISOString() });
  return user;
};
LocalAuthProvider.prototype.logout = async function () { this._setSession(null); };
LocalAuthProvider.prototype.updateUser = async function (userId, patch) {
  var users = this.listUsers(), updated = null;
  users = users.map(function (u) {
    if (u.id !== userId) return u;
    updated = Object.assign({}, u, patch, { id: u.id, username: u.username });
    return updated;
  });
  this._saveUsers(users);
  return updated;
};

/* ---------------- 命名空间隔离：换入 / 换出 ----------------
 * live 区 = 工作台直接读写的键（chem3d_* 等）；每个账号另有一份备份，
 * 存在 chem3d_acct_<userId>_v1（JSON 对象：{原键名: 原值字符串}）。
 * 切换账号 = 把 live 区现状存回旧账号备份 → 清空 live 区 →
 * 把目标账号备份写回 live 区 → 更新 LIVE_KEY。切换后 reload 页面，
 * 工作台脚本重新读取 localStorage，即看到目标账号的数据。 */
function currentLiveId() {
  try { return localStorage.getItem(LIVE_KEY) || GUEST_ID; } catch (e) { return GUEST_ID; }
}
function snapshotLive() {
  var snap = {};
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && isSwappable(k)) snap[k] = localStorage.getItem(k);
    }
  } catch (e) {}
  return snap;
}
function clearLive() {
  var keys = [];
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && isSwappable(k)) keys.push(k);
    }
    keys.forEach(function (k) { localStorage.removeItem(k); });
  } catch (e) {}
}
function restoreLive(snap) {
  Object.keys(snap).forEach(function (k) {
    try { localStorage.setItem(k, snap[k]); } catch (e) {}
  });
}
function switchAccount(targetId) {
  targetId = targetId || GUEST_ID;
  var fromId = currentLiveId();
  if (fromId === targetId) return { from: fromId, to: targetId, moved: 0 };
  var snap = snapshotLive();
  writeJSON(acctKey(fromId), snap);
  clearLive();
  var next = readJSON(acctKey(targetId), null);
  if (next && typeof next === 'object') restoreLive(next);
  try { localStorage.setItem(LIVE_KEY, targetId); } catch (e) {}
  return { from: fromId, to: targetId, moved: Object.keys(snap).length };
}
/* 清除某账号的全部学习数据（live 区若是该账号则一并清空）。 */
function clearAccountData(userId) {
  try { localStorage.removeItem(acctKey(userId)); } catch (e) {}
  if (currentLiveId() === userId) clearLive();
}

/* ---------------- 对外门面 ChemAuth ---------------- */
var provider = new LocalAuthProvider();

var ChemAuth = {
  provider: provider,
  /* 替换后端实现（见文件头注释）。新 Provider 须实现同一接口。 */
  setProvider: function (p) { provider = p; ChemAuth.provider = p; },
  getSession: function () { return provider.getSession(); },
  getCurrentUserId: function () {
    var s = provider.getSession();
    return s ? s.userId : GUEST_ID;
  },
  getCurrentUser: function () {
    var s = provider.getSession();
    return s ? provider.getUser(s.userId) : null;
  },
  isLoggedIn: function () { return !!provider.getSession(); },
  /* 账号隔离的元数据键（如新手引导“已看过”标记按账号存放）。 */
  scopedKey: function (name) { return 'chem3d_acct_' + this.getCurrentUserId() + '_' + name; },
  switchAccount: switchAccount,
  clearAccountData: clearAccountData,
  currentLiveId: currentLiveId,
  GUEST_ID: GUEST_ID,
  register: function (username, password) { return provider.register(username, password); },
  updateUser: function (userId, patch) { return provider.updateUser(userId, patch); },
  /* 登录：校验通过后换入该账号命名空间并刷新页面。 */
  login: async function (username, password) {
    var user = await provider.login(username, password);
    switchAccount(user.id);
    return user;
  },
  /* 注册后自动登录：同上换入新账号（新账号备份为空，即全新学习数据）。 */
  registerAndLogin: async function (username, password) {
    await provider.register(username, password);
    /* 经公开 login 接口建会话，避免依赖本地 Provider 的私有方法，
     * 换 Supabase 等后端实现时同样可用。 */
    var user = await provider.login(username, password);
    switchAccount(user.id);
    return user;
  },
  logout: async function () {
    await provider.logout();
    switchAccount(GUEST_ID);
  }
};
window.ChemAuth = ChemAuth;

/* ---------------- 启动时换入（本文件排在 loader.js 之前执行） ----------------
 * 正常情况下 LIVE_KEY 已等于当前会话账号；若不一致（例如上次登出时页面
 * 未刷新、或多标签页切换过账号），在此处同步纠正，保证后续脚本读到
 * 正确账号的数据。 */
(function bootSwap() {
  try {
    var target = ChemAuth.getCurrentUserId();
    if (currentLiveId() !== target) switchAccount(target);
    else if (!localStorage.getItem(LIVE_KEY)) localStorage.setItem(LIVE_KEY, target);
  } catch (e) { /* localStorage 不可用时静默降级为游客使用 */ }
})();

/* ---------------- 顶栏账号 UI（运行时注入，不改 app.html 结构） ---------------- */
var PLAN_LABEL = { free: '免费版', pro: 'Pro', school: '学校版' };

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
function closeModal(mask) { if (mask) mask.remove(); }

function openAuthModal(mode) {
  closeModal(document.querySelector('.chem2-auth-mask'));
  var mask = el('div', 'chem2-mask chem2-auth-mask');
  mask.setAttribute('role', 'dialog');
  mask.setAttribute('aria-modal', 'true');
  mask.setAttribute('aria-label', mode === 'register' ? '注册账号' : '登录账号');
  var box = el('div', 'chem2-box chem2-auth-box');
  var title = el('h2', 'chem2-title', mode === 'register' ? '注册账号' : '登录账号');
  var note = el('p', 'chem2-note',
    '演示级本地账号：账号信息仅保存在本机浏览器，不上传服务器；' +
    '密码经 SHA-256 加盐哈希后存储。清除浏览器数据后账号将丢失，请勿使用真实重要密码。');
  var err = el('p', 'chem2-error');
  err.setAttribute('role', 'status');
  var form = document.createElement('form');
  form.className = 'chem2-form';
  form.setAttribute('novalidate', '');
  var userLabel = el('label', 'chem2-field', '用户名');
  var userInput = document.createElement('input');
  userInput.type = 'text'; userInput.name = 'username'; userInput.required = true;
  userInput.maxLength = 20; userInput.autocomplete = 'username';
  userInput.placeholder = '2–20 字：中文 / 字母 / 数字 / 下划线';
  userLabel.appendChild(userInput);
  var passLabel = el('label', 'chem2-field', '密码');
  var passInput = document.createElement('input');
  passInput.type = 'password'; passInput.name = 'password'; passInput.required = true;
  passInput.minLength = 6; passInput.maxLength = 64;
  passInput.setAttribute('autocomplete', mode === 'register' ? 'new-password' : 'current-password');
  passInput.placeholder = '至少 6 位';
  passLabel.appendChild(passInput);
  var submit = el('button', 'btn-main chem2-submit', mode === 'register' ? '注册并登录' : '登录');
  submit.type = 'submit';
  /* 工作流 3 埋点：注册/登录提交按钮（js/analytics.js 委托监听 data-analytics） */
  submit.setAttribute('data-analytics', mode === 'register' ? 'register' : 'login');
  submit.setAttribute('data-analytics-source', 'app-auth-modal');
  var switchBtn = el('button', 'btn-sub', mode === 'register' ? '已有账号？去登录' : '没有账号？去注册');
  switchBtn.type = 'button';
  var guestBtn = el('button', 'btn-sub', '继续以游客身份使用');
  guestBtn.type = 'button';
  var closeBtn = el('button', 'chem2-x', '×');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', '关闭');
  form.append(userLabel, passLabel, submit);
  box.append(closeBtn, title, note, err, form, switchBtn, guestBtn);
  mask.appendChild(box);
  document.body.appendChild(mask);
  userInput.focus();

  closeBtn.addEventListener('click', function () { closeModal(mask); });
  mask.addEventListener('click', function (e) { if (e.target === mask) closeModal(mask); });
  mask.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.stopPropagation(); closeModal(mask); }
  });
  switchBtn.addEventListener('click', function () {
    closeModal(mask);
    openAuthModal(mode === 'register' ? 'login' : 'register');
  });
  guestBtn.addEventListener('click', function () { closeModal(mask); });
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    err.textContent = '';
    submit.disabled = true;
    submit.textContent = '处理中…';
    try {
      var user = mode === 'register'
        ? await ChemAuth.registerAndLogin(userInput.value, passInput.value)
        : await ChemAuth.login(userInput.value, passInput.value);
      toast((mode === 'register' ? '注册成功，欢迎你，' : '欢迎回来，') + user.username);
      setTimeout(function () { location.reload(); }, 350);
    } catch (ex) {
      err.textContent = ex && ex.message ? ex.message : '操作失败，请重试。';
      submit.disabled = false;
      submit.textContent = mode === 'register' ? '注册并登录' : '登录';
    }
  });
}

function openUserMenu(anchorBtn) {
  closeModal(document.querySelector('.chem2-menu'));
  var user = ChemAuth.getCurrentUser();
  var session = ChemAuth.getSession();
  var name = user ? user.username : (session ? session.username : '');
  var plan = (user && user.plan) || 'free';
  var menu = el('div', 'chem2-menu');
  menu.setAttribute('role', 'menu');
  var head = el('div', 'chem2-menu-head');
  head.append(el('strong', '', name), el('span', 'chem2-plan-badge', PLAN_LABEL[plan] || '免费版'));
  var demoTag = el('p', 'chem2-menu-note', '演示级本地账号 · 数据仅存本机');
  menu.append(head, demoTag);
  function item(label, fn) {
    var b = el('button', 'chem2-menu-item', label);
    b.type = 'button'; b.setAttribute('role', 'menuitem');
    b.addEventListener('click', function () { closeModal(menu); fn(); });
    menu.appendChild(b);
    return b;
  }
  item('查看定价 / 升级 Pro', function () {
    if (window.ChemPlan) window.ChemPlan.showPaywall('menu');
    else location.href = 'index.html#pricing';
  });
  if (plan === 'free' && window.ChemPlan) {
    item('演示开通 Pro（不扣费）', function () { window.ChemPlan.demoActivate('pro'); });
  }
  if (plan !== 'free' && window.ChemPlan) {
    item('恢复为免费版（演示）', function () { window.ChemPlan.demoActivate('free'); });
  }
  item('重新查看新手引导', function () {
    if (window.ChemOnboarding) window.ChemOnboarding.show(true);
    else toast('新手引导暂不可用。');
  });
  item('AI 助手设置', function () {
    if (window.ChemAI) window.ChemAI.openSettings();
    else toast('AI 设置暂不可用。');
  });
  item('清除本账号的学习数据…', function () {
    if (window.confirm('确定清除当前账号在本机的全部学习数据吗？\n（进度、收藏、错题、教案等都会删除，且无法恢复。）')) {
      clearAccountData(ChemAuth.getCurrentUserId());
      toast('已清除本账号的学习数据。');
      setTimeout(function () { location.reload(); }, 350);
    }
  });
  item('退出登录', async function () {
    await ChemAuth.logout();
    toast('已退出登录，学习数据已按账号保存。');
    setTimeout(function () { location.reload(); }, 350);
  });
  document.body.appendChild(menu);
  var r = anchorBtn.getBoundingClientRect();
  menu.style.top = (r.bottom + window.scrollY + 6) + 'px';
  menu.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
  setTimeout(function () {
    document.addEventListener('click', function closer(e) {
      if (!menu.contains(e.target) && e.target !== anchorBtn) {
        closeModal(menu);
        document.removeEventListener('click', closer);
      }
    });
  }, 0);
}

function injectTopbar() {
  var acts = document.querySelector('.top-acts');
  if (!acts || document.getElementById('chem2AuthBtn')) return;
  var btn = el('button', 'iconbtn text chem2-auth-btn');
  btn.id = 'chem2AuthBtn';
  btn.type = 'button';
  if (ChemAuth.isLoggedIn()) {
    var user = ChemAuth.getCurrentUser();
    var session = ChemAuth.getSession();
    var label = (user && user.username) || (session && session.username) || '我的账号';
    var plan = (user && user.plan) || 'free';
    btn.append(el('span', 'chem2-auth-name', label));
    btn.append(el('span', 'chem2-plan-badge', PLAN_LABEL[plan] || '免费版'));
    btn.title = '账号菜单（演示级本地账号）';
    btn.setAttribute('aria-label', '账号菜单：' + label + '，' + (PLAN_LABEL[plan] || '免费版'));
    btn.addEventListener('click', function () { openUserMenu(btn); });
  } else {
    btn.textContent = '登录 / 注册';
    btn.title = '登录或注册（演示级本地账号）';
    btn.setAttribute('aria-label', '登录或注册');
    btn.addEventListener('click', function () { openAuthModal('login'); });
  }
  acts.insertBefore(btn, acts.firstChild);
  /* 登录态变化（演示开通 Pro 等）后刷新徽标 */
  window.addEventListener('chem:plan-change', function () {
    var b = document.getElementById('chem2AuthBtn');
    if (b) { b.remove(); injectTopbar(); }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectTopbar);
} else {
  injectTopbar();
}

})();
