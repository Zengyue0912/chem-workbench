(function () {
'use strict';

var DATA = window.CHEM_PAPER_2025;
if (!DATA) { document.getElementById('ppSections').innerHTML = '<p>试卷数据未加载，请刷新页面重试。</p>'; return; }
var SOP = window.CHEM_PAPER_SOP || {};
var LS_KEY = 'chem_paper_2025_v1';
var LS_ANNO = 'chem_paper_2025_anno_v1';
var TOTAL_SEC = 90 * 60;

/* ---------- 工具 ---------- */
function $(id) { return document.getElementById(id); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function toast(msg) {
  var t = $('ppToast'); t.textContent = msg; t.hidden = false;
  clearTimeout(t._h); t._h = setTimeout(function () { t.hidden = true; }, 2600);
}
function loadJson(key, fallback) {
  try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
  catch (e) { return fallback; }
}
function saveJson(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

/* ---------- 状态 ---------- */
function defaultState() {
  return {answers: {}, inputs: {}, rates: {}, revealed: {}, checked: {},
    submitted: false, timer: {remain: TOTAL_SEC, paused: false, updatedAt: Date.now()}, score: null};
}
var state = loadJson(LS_KEY, null) || defaultState();
if (!state.timer) state.timer = defaultState().timer;
if (!state.checked) state.checked = {}; /* 兼容旧存档：没有 checked 字段时补空对象 */
var justCheckedId = null; /* 刚自测的题号：只给这道题播一次对错动画 */
var annotations = loadJson(LS_ANNO, []);
var firstRender = true; /* 首屏入场动画只播一次（render 会重建卷面） */
var RING_C = 2 * Math.PI * 13; /* 计时环周长 */
var SCORE_RING_C = 2 * Math.PI * 52; /* 成绩环周长 */
function save() {
  state.timer.updatedAt = Date.now();
  saveJson(LS_KEY, state);
}
function saveAnno() { saveJson(LS_ANNO, annotations); }

/* ---------- 数据查找 ---------- */
function allQuestions() { return DATA.questions; }
function findQ(id) { return DATA.questions.filter(function (q) { return q.id === id; })[0]; }
function findPart(pid) {
  for (var i = 0; i < DATA.questions.length; i++) {
    var q = DATA.questions[i];
    if (q.parts) for (var j = 0; j < q.parts.length; j++) if (q.parts[j].id === pid) return {q: q, p: q.parts[j]};
  }
  return null;
}
/* 大题小问自定分值：各小问自带 points 时直接用；否则前 n-1 问向下取 0.1，最后一问补差额 */
function partPoints(q) {
  if (q.parts.every(function (p) { return typeof p.points === 'number'; })) {
    return q.parts.map(function (p) { return p.points; });
  }
  var n = q.parts.length, base = Math.floor(q.points * 10 / n) / 10, out = [];
  for (var i = 0; i < n - 1; i++) out.push(base);
  out.push(Math.round((q.points - base * (n - 1)) * 10) / 10);
  return out;
}
function partPoint(q, idx) { return partPoints(q)[idx]; }

/* ---------- 渲染 ---------- */
function figHTML(figs, small) {
  if (!figs || !figs.length) return '';
  return figs.map(function (f) {
    return '<div class="pp-fig' + (small ? ' pp-fig--small' : '') + '"><img src="' + DATA.figuresBase + f + '" alt="题目配图" loading="lazy"></div>';
  }).join('');
}
function sopListHTML(sops) {
  if (!sops || !sops.length) return '';
  return '<div class="pp-sop-list"><h4>解题 SOP</h4>' + sops.map(function (s) {
    var id = s.split(' ')[0];
    return '<button type="button" class="pp-sop-tag" data-sop="' + esc(id) + '">' + esc(s) + '</button>';
  }).join('') + '</div>';
}
function analysisHTML(a, sop, fieldPrefix) {
  if (!a) return '';
  var h = '<div class="pp-analysis"><h3>解析</h3>';
  h += '<p data-annot-field="' + fieldPrefix + '-focus" data-annot-loc="解析 · 考查点"><b>考查点：</b>' + esc(a.focus) + '</p>';
  h += '<h4>思路</h4><p data-annot-field="' + fieldPrefix + '-approach" data-annot-loc="解析 · 思路">' + esc(a.approach) + '</p>';
  if (a.steps && a.steps.length) {
    h += '<h4>分步解析</h4><ol>';
    a.steps.forEach(function (s, i) {
      h += '<li data-annot-field="' + fieldPrefix + '-step' + i + '" data-annot-loc="解析 · 第 ' + (i + 1) + ' 步">' + esc(s) + '</li>';
    });
    h += '</ol>';
  }
  if (a.options && a.options.length) {
    h += '<h4>逐选项解析</h4><ul class="pp-analysis-options">';
    a.options.forEach(function (o, i) {
      h += '<li class="' + (o.ok ? 'pp-analysis-option--right' : 'pp-analysis-option--wrong') + '" data-annot-field="' + fieldPrefix + '-analysis-opt' + i + '" data-annot-loc="解析 · 选项 ' + String.fromCharCode(65 + i) + '"><b>' + (o.ok ? '✓ ' : '✕ ') + String.fromCharCode(65 + i) + '.</b> ' + esc(o.text || '') + '</li>';
    });
    h += '</ul>';
  }
  h += '<h4>易错点</h4><p data-annot-field="' + fieldPrefix + '-pitfalls" data-annot-loc="解析 · 易错点">' + esc(a.pitfalls) + '</p>';
  h += sopListHTML(sop);
  return h + '</div>';
}

function renderChoice(q) {
  var sel = state.answers[q.id];
  var submitted = state.submitted;
  var checked = !!state.checked[q.id];
  var locked = submitted || checked; /* 交卷或自测后都锁定 */
  var h = '<article class="pp-q' + (checked ? ' pp-q--checked' : '') + (q.id === justCheckedId ? ' pp-q--just-checked' : '') + (firstRender ? ' pp-q--enter' : '') + '" id="pp-' + q.id + '"><div class="pp-q-head"><span class="pp-q-num">' + q.id.replace('Q', '') + '.</span>' +
    '<span class="pp-chip">' + q.points + ' 分</span><span class="pp-chip">原卷第 ' + q.orig + ' 题</span></div>' +
    '<p class="pp-stem" data-annot-field="' + q.id + '-stem" data-annot-loc="第 ' + q.id.replace('Q', '') + ' 题题干">' + esc(q.stem) + '</p>' +
    figHTML(q.figures, q.id === 'Q5') +
    '<div class="pp-options">';
  q.options.forEach(function (o, i) {
    var cls = 'pp-opt';
    if (sel === i) cls += ' pp-opt--selected';
    if (locked) {
      if (i === q.answer) cls += ' pp-opt--correct';
      else if (sel === i) cls += ' pp-opt--wrong';
    }
    h += '<button type="button" class="' + cls + '" data-choice="' + q.id + '" data-opt="' + i + '"' + (locked ? ' disabled' : '') + '>' +
      '<span class="pp-opt-key">' + String.fromCharCode(65 + i) + '.</span>' +
      '<span class="pp-opt-text" data-annot-field="' + q.id + '-opt' + i + '" data-annot-loc="第 ' + q.id.replace('Q', '') + ' 题选项 ' + String.fromCharCode(65 + i) + '">' + esc(o.t) +
      (o.fig ? '<img src="' + DATA.figuresBase + o.fig + '" alt="选项结构图" loading="lazy">' : '') + '</span></button>';
  });
  h += '</div>';
  if (!submitted) {
    if (checked) {
      h += '<div class="pp-check-row"><span class="pp-check-badge' + (sel === q.answer ? ' pp-check-badge--right' : ' pp-check-badge--wrong') + '">' +
        (sel === q.answer ? '已自测 · 答对了 ✓' : '已自测 · 答错了') + '</span></div>';
    } else {
      h += '<div class="pp-check-row"><button type="button" class="pp-check-btn" data-check="' + q.id + '">自测一下</button></div>';
    }
  }
  if (locked) {
    h += '<p class="pp-ref-answer">答案：<b>' + String.fromCharCode(65 + q.answer) + '</b>　' +
      (sel === q.answer ? '回答正确 ✓' : '你的答案：' + (sel == null ? '未作答' : String.fromCharCode(65 + sel))) + '</p>';
    h += analysisHTML(q.analysis, q.sop, q.id);
  }
  return h + '</article>';
}

function renderPart(q, p, idx) {
  var pts = partPoint(q, idx);
  var revealed = !!state.revealed[p.id] || state.submitted;
  var rate = state.rates[p.id];
  var h = '<div class="pp-part" id="pp-' + p.id + '"><div class="pp-part-head"><span class="pp-part-num">（' + (idx + 1) + '）</span>' +
    '<span class="pp-chip">' + pts + ' 分（自定）</span></div>' +
    '<p class="pp-part-stem" data-annot-field="' + p.id + '-stem" data-annot-loc="' + p.id + ' 题干">' + esc(p.stem) + '</p>' +
    figHTML(p.figures, p.id === 'Q9(4)');
  if (p.type === 'multi') {
    var sel = state.answers[p.id] || [];
    h += '<div class="pp-options">';
    p.options.forEach(function (o, i) {
      var cls = 'pp-opt' + (sel.indexOf(i) !== -1 ? ' pp-opt--selected' : '');
      if (state.submitted) {
        if (p.answer.indexOf(i) !== -1) cls += ' pp-opt--correct';
        else if (sel.indexOf(i) !== -1) cls += ' pp-opt--wrong';
      }
      h += '<button type="button" class="' + cls + '" data-multi="' + p.id + '" data-opt="' + i + '"' + (state.submitted ? ' disabled' : '') + '>' +
        '<span class="pp-opt-key">' + String.fromCharCode(65 + i) + '.</span>' +
        '<span class="pp-opt-text" data-annot-field="' + p.id + '-opt' + i + '" data-annot-loc="' + p.id + ' 选项 ' + String.fromCharCode(65 + i) + '">' + esc(o) + '</span></button>';
    });
    h += '</div><p class="pp-section-desc">多选题：全对得满分，选对但不全得一半，选错不得分。</p>';
  } else if (p.type === 'single') {
    var ssel = state.answers[p.id];
    h += '<div class="pp-options">';
    p.options.forEach(function (o, i) {
      var cls2 = 'pp-opt' + (ssel === i ? ' pp-opt--selected' : '');
      if (state.submitted) {
        if (i === p.answer) cls2 += ' pp-opt--correct';
        else if (ssel === i) cls2 += ' pp-opt--wrong';
      }
      h += '<button type="button" class="' + cls2 + '" data-single="' + p.id + '" data-opt="' + i + '"' + (state.submitted ? ' disabled' : '') + '>' +
        '<span class="pp-opt-key">' + String.fromCharCode(65 + i) + '.</span>' +
        '<span class="pp-opt-text" data-annot-field="' + p.id + '-opt' + i + '" data-annot-loc="' + p.id + ' 选项 ' + String.fromCharCode(65 + i) + '">' + esc(o) + '</span></button>';
    });
    h += '</div><p class="pp-section-desc">单选题：选对得满分，选错不得分。</p>';
  } else if (p.type === 'short') {
    h += '<textarea class="pp-answer-input" rows="3" data-input="' + p.id + '" placeholder="写下你的答案（简答题）" ' + (state.submitted ? 'disabled' : '') + '>' + esc(state.inputs[p.id] || '') + '</textarea>';
  } else {
    h += '<input class="pp-answer-input" type="text" data-input="' + p.id + '" placeholder="写下你的答案" value="' + esc(state.inputs[p.id] || '') + '" ' + (state.submitted ? 'disabled' : '') + '>';
  }
  h += '<div class="pp-part-actions"><button type="button" class="pp-btn pp-btn--primary" data-reveal="' + p.id + '">' + (revealed ? '收起答案' : '看答案') + '</button>';
  if (p.type !== 'multi' && p.type !== 'single') {
    h += '<span class="pp-rate' + (revealed ? ' pp-rate--show' : '') + '"><span>自评：</span>' +
      ['full|对', 'half|半对', 'wrong|错'].map(function (r) {
        var kv = r.split('|');
        return '<button type="button" data-rate="' + p.id + '" data-val="' + kv[0] + '" class="' + (rate === kv[0] ? 'pp-rate--on' : '') + '"' + (state.submitted ? ' disabled' : '') + '>' + kv[1] + '</button>';
      }).join('') + '</span>';
  }
  h += '</div>';
  if (revealed) {
    var ansText = p.type === 'multi'
      ? p.answer.map(function (i) { return String.fromCharCode(65 + i); }).join('、')
      : p.type === 'single' ? String.fromCharCode(65 + p.answer)
      : p.answer;
    h += '<div class="pp-ref pp-ref--show"><p class="pp-ref-answer">参考答案：<b>' + esc(ansText) + '</b></p>' +
      analysisHTML(p.analysis, p.sop, p.id) + '</div>';
  }
  return h + '</div>';
}

function renderBig(q) {
  var h = '<article class="pp-q' + (firstRender ? ' pp-q--enter' : '') + '" id="pp-' + q.id + '"><div class="pp-q-head"><span class="pp-q-num">' + q.id.replace('Q', '') + '.</span>' +
    '<span class="pp-chip">' + q.points + ' 分</span><span class="pp-chip">原卷第 ' + q.orig + ' 题</span></div>' +
    (q.title ? '<p><b>' + esc(q.title) + '</b></p>' : '') +
    '<p class="pp-stem" data-annot-field="' + q.id + '-stem" data-annot-loc="' + q.id + ' 题干">' + esc(q.stem) + '</p>' +
    figHTML(q.figures) + '<div class="pp-parts">';
  q.parts.forEach(function (p, i) { h += renderPart(q, p, i); });
  return h + '</div></article>';
}

function render() {
  var choice = DATA.questions.filter(function (q) { return q.type === 'choice'; });
  var big = DATA.questions.filter(function (q) { return q.type === 'big'; });
  var h = '<section class="pp-section"><h2>一、选择题</h2><p class="pp-section-desc">每小题 6 分，共 42 分。在每小题给出的四个选项中，只有一项是符合题目要求的。</p>';
  choice.forEach(function (q) { h += renderChoice(q); });
  h += '</section><section class="pp-section"><h2>二、非选择题</h2><p class="pp-section-desc">共 4 题。先把答案写在输入框里，再点“看答案”对照参考答案与解析，自评对、半对或错。</p>';
  big.forEach(function (q) { h += renderBig(q); });
  h += '</section>';
  $('ppSections').innerHTML = h;
  firstRender = false;
  applyAnnotations();
  updateProgress();
  updateAnnoCount();
  $('ppSubmitBtn').textContent = state.submitted ? '查看成绩单' : '交卷';
}

/* ---------- 进度 ---------- */
function scoredItems() {
  var items = [];
  DATA.questions.forEach(function (q) {
    if (q.type === 'choice') items.push(q.id);
    else q.parts.forEach(function (p) { items.push(p.id); });
  });
  return items;
}
function isAnswered(id) {
  if (state.answers[id] != null) {
    var a = state.answers[id];
    return Array.isArray(a) ? a.length > 0 : true;
  }
  if (state.inputs[id]) return true;
  if (state.rates[id]) return true;
  return false;
}
function updateProgress() {
  var items = scoredItems();
  var done = items.filter(isAnswered).length;
  var fill = $('ppProgressFill');
  fill.style.width = (items.length ? Math.round(done / items.length * 100) : 0) + '%';
  fill.classList.toggle('pp-progress--empty', done === 0);
  var label = $('ppProgressLabel');
  if (label) {
    var allDone = items.length > 0 && done === items.length;
    label.textContent = allDone ? '已全部完成 ✓' : '已答 ' + done + ' / ' + items.length + ' 题';
    label.classList.toggle('pp-progress--done', allDone);
  }
}

/* ---------- 判分 ---------- */
function scoreChoice(q) {
  return state.answers[q.id] === q.answer ? q.points : 0;
}
function scorePart(q, p, idx) {
  var pts = partPoint(q, idx);
  if (p.type === 'single') {
    return state.answers[p.id] === p.answer ? pts : 0;
  }
  if (p.type === 'multi') {
    var sel = state.answers[p.id] || [];
    var correct = p.answer.slice().sort().join(',');
    if (sel.slice().sort().join(',') === correct) return pts;
    if (sel.length && sel.every(function (i) { return p.answer.indexOf(i) !== -1; })) return Math.round(pts / 2 * 10) / 10;
    return 0;
  }
  var r = state.rates[p.id];
  if (r === 'full') return pts;
  if (r === 'half') return Math.round(pts / 2 * 10) / 10;
  return 0;
}
function computeScore() {
  var detail = [], choiceScore = 0, bigScore = 0;
  DATA.questions.forEach(function (q) {
    if (q.type === 'choice') {
      var s = scoreChoice(q);
      choiceScore += s;
      detail.push({id: q.id, label: '第 ' + q.id.replace('Q', '') + ' 题', got: s, max: q.points,
        ok: s === q.points, sop: q.sop, analysis: q.analysis});
    } else {
      q.parts.forEach(function (p, i) {
        var s = scorePart(q, p, i), max = partPoint(q, i);
        bigScore += s;
        var rated = p.type === 'multi' ? (state.answers[p.id] || []).length > 0 : p.type === 'single' ? state.answers[p.id] != null : !!state.rates[p.id];
        detail.push({id: p.id, label: p.id + '（第 ' + q.id.replace('Q', '') + ' 题）', got: s, max: max,
          ok: s === max, unrated: !rated, sop: p.sop, analysis: p.analysis});
      });
    }
  });
  var total = Math.round((choiceScore + bigScore) * 10) / 10;
  return {total: total, choice: choiceScore, big: Math.round(bigScore * 10) / 10, detail: detail};
}
function scoreCheer(total) {
  if (total >= 90) return '接近满分，化学功底很扎实，继续保持！';
  if (total >= 75) return '很不错的成绩，再抠一抠错题就能冲上 90！';
  if (total >= 60) return '已过及格线，错题挂的 SOP 逐条过一遍，提分空间很大。';
  if (total >= 40) return '基础还在路上，别灰心——错题对应的 SOP 就是你的提分清单。';
  return '这次只是摸底，跟着错题 SOP 一条一条补，下次一定更好。';
}
function scoreHTML(sc) {
  var h = '<div class="pp-score-total"><div class="pp-score-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="pp-score-ring-bg" cx="60" cy="60" r="52"/><circle class="pp-score-ring-fg" id="ppScoreRing" cx="60" cy="60" r="52"/></svg>' +
    '<div class="pp-score-num"><span id="ppScoreNum">0</span><span class="pp-score-unit">/ 100 分</span></div></div>' +
    '<p class="pp-score-cheer">' + scoreCheer(sc.total) + '</p>' +
    '<div class="pp-score-sub">选择题 ' + sc.choice + ' / 42 分 · 大题自评 ' + sc.big + ' / 58 分</div></div>';
  h += '<table class="pp-score-table"><tr><th>题目</th><th>得分</th></tr>';
  sc.detail.forEach(function (d) {
    h += '<tr><td>' + esc(d.label) + (d.unrated ? '（未自评）' : '') + '</td><td>' + d.got + ' / ' + d.max + '</td></tr>';
  });
  h += '</table>';
  var wrong = sc.detail.filter(function (d) { return !d.ok; });
  if (wrong.length) {
    h += '<div class="pp-score-wrong"><h3>错题与薄弱点 · 推荐 SOP</h3>';
    wrong.forEach(function (d) {
      h += '<div class="pp-score-wrong-item"><p><b>' + esc(d.label) + '</b>　' + d.got + ' / ' + d.max + ' 分</p>';
      if (d.sop && d.sop.length) {
        h += d.sop.map(function (s) {
          return '<button type="button" class="pp-sop-tag" data-sop="' + esc(s.split(' ')[0]) + '">' + esc(s) + '</button>';
        }).join('');
      } else {
        h += '<p class="pp-score-note">这道题暂无对应 SOP。</p>';
      }
      h += '</div>';
    });
    h += '</div>';
  } else {
    h += '<p class="pp-score-note">全部答对，厉害！</p>';
  }
  h += '<p class="pp-score-note">大题为自评得分：对照参考答案后自己评的对、半对、错。大题小问分值为自定（按小问难度分配），仅供自测参考，非原卷分值。</p>';
  return h;
}
function submit() {
  if (state.submitted) { showScore(); return; }
  var items = scoredItems();
  var undone = items.filter(function (id) { return !isAnswered(id); }).length;
  var unrated = 0;
  DATA.questions.forEach(function (q) {
    if (q.type !== 'big') return;
    q.parts.forEach(function (p) {
      if (p.type !== 'multi' && p.type !== 'single' && !state.rates[p.id]) unrated++;
    });
  });
  var msg = '';
  if (undone) msg += '还有 ' + undone + ' 道题未作答，';
  if (unrated) msg += '还有 ' + unrated + ' 个大题小问未自评（按 0 分计），';
  if (msg) { askConfirm(msg + '确定交卷吗？', doSubmit); return; }
  doSubmit();
}
function doSubmit() {
  state.submitted = true;
  state.score = computeScore();
  save();
  document.body.classList.add('pp-just-submitted');
  setTimeout(function () { document.body.classList.remove('pp-just-submitted'); }, 900);
  render();
  showScore();
}
function showScore() {
  if (!state.score) state.score = computeScore();
  $('ppScoreBody').innerHTML = scoreHTML(state.score);
  $('ppScoreModal').hidden = false;
  animateScore(state.score.total);
}
/* 成绩数字滚动 + 环形进度（0.6s；减动效时直接显示终值） */
function animateScore(total) {
  var numEl = $('ppScoreNum'), ring = $('ppScoreRing');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !numEl) {
    if (numEl) numEl.textContent = total;
    if (ring) ring.style.strokeDashoffset = SCORE_RING_C * (1 - total / 100);
    return;
  }
  var start = null, dur = 600;
  function step(ts) {
    if (!start) start = ts;
    var p = Math.min(1, (ts - start) / dur);
    var e = 1 - Math.pow(1 - p, 3);
    numEl.textContent = Math.round(total * 10 * e) / 10;
    if (ring) ring.style.strokeDashoffset = SCORE_RING_C * (1 - (total * e) / 100);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ---------- 答题卡 ---------- */
function cardStatus(id) {
  if (!state.submitted) {
    var cq = findQ(id);
    if (cq && cq.type === 'choice' && state.checked[id]) {
      return state.answers[id] === cq.answer ? 'pp-card--right' : 'pp-card--wrong';
    }
    return isAnswered(id) ? 'pp-card--done' : '';
  }
  var q = findQ(id);
  if (q) return state.answers[id] === q.answer ? 'pp-card--right' : 'pp-card--wrong';
  var fp = findPart(id);
  if (!fp) return '';
  var idx = fp.q.parts.indexOf(fp.p);
  var s = scorePart(fp.q, fp.p, idx), max = partPoint(fp.q, idx);
  if (s === max) return 'pp-card--right';
  if (s > 0) return 'pp-card--half';
  return 'pp-card--wrong';
}
function renderCard() {
  var h = '';
  function sec(title, items) {
    h += '<div class="pp-card-sec"><h3>' + title + '</h3><div class="pp-card-grid">';
    items.forEach(function (id) {
      h += '<button type="button" data-jump="' + id + '" class="' + cardStatus(id) + '">' + id.replace('Q', '') + '</button>';
    });
    h += '</div></div>';
  }
  sec('选择题', DATA.questions.filter(function (q) { return q.type === 'choice'; }).map(function (q) { return q.id; }));
  DATA.questions.filter(function (q) { return q.type === 'big'; }).forEach(function (q) {
    sec('第 ' + q.id.replace('Q', '') + ' 题',
      q.parts.map(function (p) { return p.id; }));
  });
  h += '<div class="pp-card-legend"><span><i style="background:#eef7f3;border:1px solid #0e6b57"></i>已作答</span>' +
    '<span><i style="background:#e8f5e9"></i>正确</span><span><i style="background:#fff7ed"></i>半对</span>' +
    '<span><i style="background:#fef2f2"></i>错误 / 未作答</span></div>';
  $('ppCardBody').innerHTML = h;
}

/* ---------- 标注 ---------- */
function fieldEl(field) { return document.querySelector('[data-annot-field="' + field + '"]'); }
function applyAnnotations() {
  var byField = {};
  annotations.forEach(function (a) { (byField[a.field] = byField[a.field] || []).push(a); });
  Object.keys(byField).forEach(function (field) {
    var el = fieldEl(field);
    if (!el) return;
    byField[field].sort(function (a, b) { return b.start - a.start; }).forEach(function (a) {
      wrapRange(el, a.start, a.end, a);
    });
  });
}
function wrapRange(el, start, end, anno) {
  var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  var nodes = [], node, pos = 0, startNode = null, endNode = null, startOff = 0, endOff = 0;
  while ((node = walker.nextNode())) {
    nodes.push({node: node, from: pos, to: pos + node.textContent.length});
    pos += node.textContent.length;
  }
  if (end > pos || start < 0 || start >= end) return;
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    if (!startNode && start >= n.from && start < n.to) { startNode = n.node; startOff = start - n.from; }
    if (end > n.from && end <= n.to) { endNode = n.node; endOff = end - n.from; }
  }
  if (!startNode || !endNode) return;
  try {
    var range = document.createRange();
    range.setStart(startNode, startOff);
    range.setEnd(endNode, endOff);
    var mark = document.createElement('mark');
    mark.className = 'pp-hl' + (anno.note ? ' pp-hl--note' : '');
    mark.dataset.annoId = anno.id;
    range.surroundContents(mark);
  } catch (e) { /* 跨节点选区无法包裹时跳过 */ }
}
var pendingSel = null;
function hideToolbar() { $('ppAnnoToolbar').hidden = true; pendingSel = null; }
document.addEventListener('mouseup', function (e) {
  if (e.target.closest('.pp-anno-toolbar, .pp-modal, .pp-drawer')) return;
  setTimeout(function () {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) { hideToolbar(); return; }
    var range = sel.getRangeAt(0);
    var field = range.commonAncestorContainer.nodeType === 3
      ? range.commonAncestorContainer.parentElement.closest('[data-annot-field]')
      : range.commonAncestorContainer.closest('[data-annot-field]');
    if (!field || field.closest('input, textarea, button')) { hideToolbar(); return; }
    var pre = document.createRange();
    pre.selectNodeContents(field);
    pre.setEnd(range.startContainer, range.startOffset);
    var start = pre.toString().length;
    var text = range.toString();
    if (!text.trim()) { hideToolbar(); return; }
    pendingSel = {field: field.dataset.annotField, loc: field.dataset.annotLoc, start: start, end: start + text.length, text: text};
    var rect = range.getBoundingClientRect();
    var tb = $('ppAnnoToolbar');
    tb.hidden = false;
    tb.style.left = Math.max(8, Math.min(window.innerWidth - 190, rect.left + rect.width / 2 - 90)) + 'px';
    tb.style.top = Math.max(8, rect.top - 48) + 'px';
  }, 10);
});
document.addEventListener('mousedown', function (e) {
  if (e.target.closest('.pp-anno-toolbar, .pp-modal, .pp-drawer')) return;
  hideToolbar();
});
function addAnnotation(note) {
  if (!pendingSel) return;
  var a = {id: 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1e4),
    field: pendingSel.field, loc: pendingSel.loc, start: pendingSel.start, end: pendingSel.end,
    text: pendingSel.text, note: note || ''};
  annotations.push(a);
  saveAnno();
  hideToolbar();
  window.getSelection().removeAllRanges();
  render();
  toast(note ? '笔记已保存。' : '已标重点。');
}
function updateAnnoCount() {
  $('ppAnnoCount').textContent = annotations.length ? '(' + annotations.length + ')' : '';
}
function renderAnnoList() {
  if (!annotations.length) {
    $('ppAnnoBody').innerHTML = '<p class="pp-empty">还没有标注。选中题目或解析里的文字，可以标重点或记笔记。</p>';
    return;
  }
  $('ppAnnoBody').innerHTML = annotations.map(function (a) {
    return '<div class="pp-anno-item" data-anno-jump="' + a.id + '"><p class="pp-anno-loc">' + esc(a.loc) + '</p>' +
      '<p class="pp-anno-text">' + esc(a.text.length > 120 ? a.text.slice(0, 120) + '…' : a.text) + '</p>' +
      (a.note ? '<p class="pp-anno-note">笔记：' + esc(a.note) + '</p>' : '') +
      '<button type="button" class="pp-anno-del" data-anno-del="' + a.id + '">删除</button></div>';
  }).join('');
}
function jumpToAnno(id) {
  var a = annotations.filter(function (x) { return x.id === id; })[0];
  if (!a) return;
  closeDrawers();
  var mark = document.querySelector('mark[data-anno-id="' + id + '"]');
  if (mark) {
    mark.scrollIntoView({behavior: 'smooth', block: 'center'});
    mark.classList.add('pp-hl--flash');
    setTimeout(function () { mark.classList.remove('pp-hl--flash'); }, 2000);
  } else {
    var el = fieldEl(a.field);
    if (el) el.scrollIntoView({behavior: 'smooth', block: 'center'});
  }
}

/* ---------- SOP 弹窗 ---------- */
function openSop(id) {
  var s = SOP[id];
  $('ppSopTitle').textContent = id + (s ? '　' + s.title : '');
  if (!s) {
    $('ppSopBody').innerHTML = '<p>SOP 数据未加载，请刷新页面重试。</p>';
  } else {
    var h = '';
    if (s.type) h += '<h4>适用题型</h4><p>' + esc(s.type) + '</p>';
    if (s.prereq && s.prereq.length) h += '<h4>前置知识</h4><ul>' + s.prereq.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    if (s.steps && s.steps.length) {
      h += '<h4>标准步骤</h4><ol>' + s.steps.map(function (st) {
        return '<li>' + esc(st.text) + (st.warns && st.warns.length ? st.warns.map(function (w) {
          return '<span class="pp-sop-warn">⚠ ' + esc(w) + '</span>';
        }).join('') : '') + '</li>';
      }).join('') + '</ol>';
    }
    if (s.checklist && s.checklist.length) h += '<h4>完成检查清单</h4><ul>' + s.checklist.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    if (s.example) h += '<h4>例题</h4><div class="pp-sop-example">' + esc(s.example) + '</div>';
    if (s.boundary && s.boundary.length) h += '<h4>边界与例外</h4><ul>' + s.boundary.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    if (s.related && s.related.length) h += '<h4>关联知识点</h4><ul>' + s.related.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    $('ppSopBody').innerHTML = h;
  }
  $('ppSopModal').hidden = false;
}

/* ---------- 计时 ---------- */
function fmt(sec) {
  sec = Math.max(0, sec);
  var m = Math.floor(sec / 60), s = sec % 60;
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}
function tickTimer() {
  var t = state.timer;
  if (!t.paused && t.remain > 0) {
    var now = Date.now();
    var elapsed = Math.floor((now - t.updatedAt) / 1000);
    if (elapsed > 0) {
      t.remain = Math.max(0, t.remain - elapsed);
      t.updatedAt = now;
      if (t.remain === 0) toast('建议时间已到，可以继续作答或交卷。');
      save();
    }
  }
  $('ppTimerText').textContent = fmt(t.remain);
  var ring = $('ppTimerRing');
  if (ring) ring.style.strokeDashoffset = (RING_C * (1 - t.remain / TOTAL_SEC)).toFixed(1);
  $('ppTimer').classList.toggle('pp-timer--over', t.remain === 0);
  $('ppTimerBtn').textContent = t.paused ? '继续' : '暂停';
}
setInterval(tickTimer, 1000);

/* ---------- 抽屉与弹窗 ---------- */
function closeDrawers() { $('ppCardDrawer').hidden = true; $('ppAnnoDrawer').hidden = true; }
var confirmAction = null;
function askConfirm(msg, onYes) {
  $('ppConfirmText').textContent = msg;
  confirmAction = onYes;
  $('ppConfirmModal').hidden = false;
}
function closeModals() {
  confirmAction = null;
  ['ppScoreModal', 'ppSopModal', 'ppNoteModal', 'ppConfirmModal'].forEach(function (id) { $(id).hidden = true; });
}

/* ---------- 事件 ---------- */
document.addEventListener('click', function (e) {
  var t = e.target;
  var sopBtn = t.closest('[data-sop]');
  if (sopBtn) { openSop(sopBtn.dataset.sop); return; }
  var closeDrawer = t.closest('[data-close-drawer]');
  if (closeDrawer) { closeDrawers(); return; }
  var closeConfirm = t.closest('[data-close-confirm]');
  if (closeConfirm) { $('ppConfirmModal').hidden = true; confirmAction = null; return; }
  var closeModal = t.closest('[data-close-modal]');
  if (closeModal) { closeModals(); return; }
  var mark = t.closest('mark.pp-hl');
  if (mark) {
    var a = annotations.filter(function (x) { return x.id === mark.dataset.annoId; })[0];
    if (a) {
      $('ppNoteQuote').textContent = a.text;
      $('ppNoteText').value = a.note || '';
      $('ppNoteModal').dataset.editId = a.id;
      $('ppNoteModal').hidden = false;
    }
    return;
  }
  var check = t.closest('[data-check]');
  if (check && !state.submitted) {
    var qid = check.dataset.check;
    var cq = findQ(qid);
    if (!cq || state.checked[qid]) return;
    if (state.answers[qid] == null) {
      toast('先选一个答案再自测');
      var art = $('pp-' + qid);
      if (art) {
        var opts = art.querySelector('.pp-options');
        if (opts) {
          opts.classList.add('pp-shake-once');
          setTimeout(function () { opts.classList.remove('pp-shake-once'); }, 500);
        }
      }
      return;
    }
    state.checked[qid] = true;
    justCheckedId = qid;
    save(); render();
    setTimeout(function () {
      justCheckedId = null;
      var art2 = $('pp-' + qid);
      if (art2) art2.classList.remove('pp-q--just-checked');
    }, 900);
    return;
  }
  var choice = t.closest('[data-choice]');
  if (choice && !state.submitted && !state.checked[choice.dataset.choice]) {
    var sel = window.getSelection();
    if (sel && !sel.isCollapsed) return; /* 拖选文字做标注时不触发选题 */
    state.answers[choice.dataset.choice] = parseInt(choice.dataset.opt, 10);
    save(); render(); return;
  }
  var multi = t.closest('[data-multi]');
  if (multi && !state.submitted) {
    var sel2 = window.getSelection();
    if (sel2 && !sel2.isCollapsed) return;
    var pid = multi.dataset.multi, opt = parseInt(multi.dataset.opt, 10);
    var arr = (state.answers[pid] || []).slice();
    var at = arr.indexOf(opt);
    if (at === -1) arr.push(opt); else arr.splice(at, 1);
    state.answers[pid] = arr.sort(function (x, y) { return x - y; });
    save(); render(); return;
  }
  var single = t.closest('[data-single]');
  if (single && !state.submitted) {
    var sel3 = window.getSelection();
    if (sel3 && !sel3.isCollapsed) return;
    state.answers[single.dataset.single] = parseInt(single.dataset.opt, 10);
    save(); render(); return;
  }
  var reveal = t.closest('[data-reveal]');
  if (reveal) {
    var rid = reveal.dataset.reveal;
    state.revealed[rid] = !state.revealed[rid];
    save(); render();
    var el = $('pp-' + rid);
    if (el) el.scrollIntoView({behavior: 'smooth', block: 'nearest'});
    return;
  }
  var rate = t.closest('[data-rate]');
  if (rate && !state.submitted) {
    state.rates[rate.dataset.rate] = rate.dataset.val;
    save(); render(); return;
  }
  var jump = t.closest('[data-jump]');
  if (jump) {
    closeDrawers();
    var jel = $('pp-' + jump.dataset.jump);
    if (jel) jel.scrollIntoView({behavior: 'smooth', block: 'start'});
    return;
  }
  var annoJump = t.closest('[data-anno-jump]');
  if (annoJump && !t.closest('[data-anno-del]')) { jumpToAnno(annoJump.dataset.annoJump); return; }
  var annoDel = t.closest('[data-anno-del]');
  if (annoDel) {
    e.stopPropagation();
    annotations = annotations.filter(function (x) { return x.id !== annoDel.dataset.annoDel; });
    saveAnno(); renderAnnoList(); render();
    toast('标注已删除。');
    return;
  }
});
document.addEventListener('input', function (e) {
  var inp = e.target.closest('[data-input]');
  if (inp) {
    state.inputs[inp.dataset.input] = inp.value;
    save();
    updateProgress();
  }
});
$('ppTimerBtn').addEventListener('click', function () {
  state.timer.paused = !state.timer.paused;
  state.timer.updatedAt = Date.now();
  save(); tickTimer();
});
$('ppCardBtn').addEventListener('click', function () {
  renderCard();
  $('ppAnnoDrawer').hidden = true;
  $('ppCardDrawer').hidden = false;
});
$('ppAnnoBtn').addEventListener('click', function () {
  renderAnnoList();
  $('ppCardDrawer').hidden = true;
  $('ppAnnoDrawer').hidden = false;
});
$('ppSubmitBtn').addEventListener('click', submit);
$('ppCardSubmit').addEventListener('click', function () { closeDrawers(); submit(); });
$('ppScoreReview').addEventListener('click', function () { closeModals(); });
function restartPaper() {
  askConfirm('确定重新开始吗？作答与成绩将被清空，标注会保留。', function () {
    state = defaultState();
    save();
    closeDrawers();
    closeModals();
    render();
    window.scrollTo({top: 0, behavior: 'smooth'});
    toast('已重新开始。');
  });
}
$('ppScoreRestart').addEventListener('click', restartPaper);
$('ppCardRestart').addEventListener('click', restartPaper);
$('ppConfirmYes').addEventListener('click', function () {
  var fn = confirmAction;
  closeModals();
  if (fn) fn();
});
$('ppConfirmNo').addEventListener('click', function () { $('ppConfirmModal').hidden = true; confirmAction = null; });
$('ppMarkBtn').addEventListener('click', function () { addAnnotation(''); });
$('ppNoteBtn').addEventListener('click', function () {
  if (!pendingSel) return;
  $('ppNoteQuote').textContent = pendingSel.text;
  $('ppNoteText').value = '';
  delete $('ppNoteModal').dataset.editId;
  $('ppNoteModal').hidden = false;
  $('ppAnnoToolbar').hidden = true;
});
$('ppNoteSave').addEventListener('click', function () {
  var note = $('ppNoteText').value.trim();
  var editId = $('ppNoteModal').dataset.editId;
  if (editId) {
    var a = annotations.filter(function (x) { return x.id === editId; })[0];
    if (a) { a.note = note; saveAnno(); render(); toast('笔记已保存。'); }
  } else {
    addAnnotation(note);
  }
  closeModals();
});

/* ---------- 背景粒子（轻量 canvas 分子装饰；减动效时不启动） ---------- */
function initBgCanvas() {
  var cv = $('ppBgCanvas');
  if (!cv || !cv.getContext) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var ctx = cv.getContext('2d');
  var W = 0, H = 0, parts = [], raf = null;
  function resize() {
    var dpr = Math.min(1.5, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function make() {
    parts = [];
    var n = Math.max(10, Math.min(26, Math.floor(W * H / 60000)));
    for (var i = 0; i < n; i++) {
      parts.push({
        x: Math.random() * W, y: Math.random() * H,
        r: 2 + Math.random() * 4,
        vx: (Math.random() - 0.5) * 0.14, vy: (Math.random() - 0.5) * 0.14,
        c: Math.random() < 0.5 ? '13,148,136' : '14,107,87'
      });
    }
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    var i, j, p, a, b, dx, dy, d;
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < -12) p.x = W + 12; if (p.x > W + 12) p.x = -12;
      if (p.y < -12) p.y = H + 12; if (p.y > H + 12) p.y = -12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + p.c + ',0.10)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(' + p.c + ',0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (i = 0; i < parts.length; i++) {
      for (j = i + 1; j < parts.length; j++) {
        a = parts[i]; b = parts[j];
        dx = a.x - b.x; dy = a.y - b.y;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d < 120) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = 'rgba(13,148,136,' + (0.06 * (1 - d / 120)).toFixed(3) + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    raf = requestAnimationFrame(draw);
  }
  function start() { if (!raf) draw(); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
  resize();
  make();
  start();
  window.addEventListener('resize', function () { resize(); make(); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });
}

/* ---------- 初始化 ---------- */
render();
tickTimer();
initBgCanvas();
})();
