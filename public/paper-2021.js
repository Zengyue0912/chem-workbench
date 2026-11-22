(function () {
'use strict';

var DATA = window.CHEM_PAPER_2021;
if (!DATA) { document.getElementById('ppSections').innerHTML = '<p>试卷数据未加载，请刷新页面重试。</p>'; return; }
var SOP = window.CHEM_PAPER_SOP || {};
var LS_KEY = 'chem_paper_2021_v1';
var LS_ANNO = 'chem_paper_2021_anno_v1';
var TOTAL_SEC = 90 * 60;

var OTHER_PAPERS = [
  ['2022 年广东卷', 'https://gaokao.eol.cn/shiti/zhenti/202206/W020220616377740816453.pdf'],
  ['2023 年 6 月浙江卷', 'https://cdn.zizzs.com/zixunzhan/202310/2ab57aa6-3b25-4823-bae4-7497fa85cd51.pdf'],
  ['2023 年全国新课标卷', 'https://static-gkcx.gaokao.cn/upload/zhenti/20230613/1686651407_4038.pdf'],
  ['2024 年全国甲卷', 'https://down.jiaoyuwu.com/m00/37/06/d93c156d1a95ede711e34ee049fa10ca.pdf'],
  ['2024 年北京卷', 'https://cdn.zgkao.com/17195390325742024%E5%8C%97%E4%BA%AC%E9%AB%98%E8%80%83%E7%9C%9F%E9%A2%98%E5%8C%96%E5%AD%A6%EF%BC%88%E6%95%99%E5%B8%88%E7%89%88%EF%BC%89.pdf'],
  ['2024 年安徽卷', 'https://down.jiaoyuwu.com/m00/43/fe/2cba6a02ead6e16bc54bbba9c10583f1.pdf'],
  ['2025 年山东卷', 'https://static-gkcx.gaokao.cn/upload/zhenti/20250613/1749812160_2083.pdf'],
  ['2025 年全国新课标理综卷', 'https://img.gaokaozhitongche.com/resource/pdf/paper/202507/20250728030001_5IZPSD.pdf#page=11'],
  ['2021 年全国乙卷 · 官方评析', 'https://gaokao.neea.edu.cn/xhtml1/report/21121/3939-1.htm']
];

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
  return {answers: {}, inputs: {}, rates: {}, revealed: {}, elective: 'Q11',
    submitted: false, timer: {remain: TOTAL_SEC, paused: false, updatedAt: Date.now()}, score: null};
}
var state = loadJson(LS_KEY, null) || defaultState();
if (!state.timer) state.timer = defaultState().timer;
var annotations = loadJson(LS_ANNO, []);
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
/* 大题小问自定分值：前 n-1 问向下取 0.1，最后一问补差额 */
function partPoints(q) {
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
  h += '<h4>易错点</h4><p data-annot-field="' + fieldPrefix + '-pitfalls" data-annot-loc="解析 · 易错点">' + esc(a.pitfalls) + '</p>';
  h += sopListHTML(sop);
  return h + '</div>';
}

function renderChoice(q) {
  var sel = state.answers[q.id];
  var submitted = state.submitted;
  var h = '<article class="pp-q" id="pp-' + q.id + '"><div class="pp-q-head"><span class="pp-q-num">' + q.id.replace('Q', '') + '.</span>' +
    '<span class="pp-chip">' + q.points + ' 分</span><span class="pp-chip">原卷第 ' + q.orig + ' 题</span></div>' +
    '<p class="pp-stem" data-annot-field="' + q.id + '-stem" data-annot-loc="第 ' + q.id.replace('Q', '') + ' 题题干">' + esc(q.stem) + '</p>' +
    figHTML(q.figures, q.id === 'Q2') +
    '<div class="pp-options">';
  q.options.forEach(function (o, i) {
    var cls = 'pp-opt';
    if (sel === i) cls += ' pp-opt--selected';
    if (submitted) {
      if (i === q.answer) cls += ' pp-opt--correct';
      else if (sel === i) cls += ' pp-opt--wrong';
    }
    h += '<button type="button" class="' + cls + '" data-choice="' + q.id + '" data-opt="' + i + '"' + (submitted ? ' disabled' : '') + '>' +
      '<span class="pp-opt-key">' + String.fromCharCode(65 + i) + '.</span>' +
      '<span class="pp-opt-text" data-annot-field="' + q.id + '-opt' + i + '" data-annot-loc="第 ' + q.id.replace('Q', '') + ' 题选项 ' + String.fromCharCode(65 + i) + '">' + esc(o.t) +
      (o.fig ? '<img src="' + DATA.figuresBase + o.fig + '" alt="选项结构图" loading="lazy">' : '') + '</span></button>';
  });
  h += '</div>';
  if (submitted) {
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
    figHTML(p.figures, p.id === 'Q11(4)');
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
  } else if (p.type === 'short') {
    h += '<textarea class="pp-answer-input" rows="3" data-input="' + p.id + '" placeholder="写下你的答案（简答题）" ' + (state.submitted ? 'disabled' : '') + '>' + esc(state.inputs[p.id] || '') + '</textarea>';
  } else {
    h += '<input class="pp-answer-input" type="text" data-input="' + p.id + '" placeholder="写下你的答案" value="' + esc(state.inputs[p.id] || '') + '" ' + (state.submitted ? 'disabled' : '') + '>';
  }
  h += '<div class="pp-part-actions"><button type="button" class="pp-btn pp-btn--primary" data-reveal="' + p.id + '">' + (revealed ? '收起答案' : '看答案') + '</button>';
  if (p.type !== 'multi') {
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
      : p.answer;
    h += '<div class="pp-ref pp-ref--show"><p class="pp-ref-answer">参考答案：<b>' + esc(ansText) + '</b></p>' +
      analysisHTML(p.analysis, p.sop, p.id) + '</div>';
  }
  return h + '</div>';
}

function renderBig(q) {
  var unpicked = q.elective && state.elective !== q.id;
  var h = '<article class="pp-q' + (unpicked ? ' pp-q--unpicked' : '') + '" id="pp-' + q.id + '"><div class="pp-q-head"><span class="pp-q-num">' + q.id.replace('Q', '') + '.</span>' +
    '<span class="pp-chip">' + q.points + ' 分</span><span class="pp-chip">原卷第 ' + q.orig + ' 题</span>' +
    (q.elective ? '<span class="pp-chip pp-chip--elective">选考题</span>' : '') + '</div>' +
    (q.title ? '<p><b>' + esc(q.title) + '</b></p>' : '') +
    '<p class="pp-stem" data-annot-field="' + q.id + '-stem" data-annot-loc="' + q.id + ' 题干">' + esc(q.stem) + '</p>' +
    figHTML(q.figures) + '<div class="pp-parts">';
  q.parts.forEach(function (p, i) { h += renderPart(q, p, i); });
  return h + '</div></article>';
}

function render() {
  var choice = DATA.questions.filter(function (q) { return q.type === 'choice'; });
  var big = DATA.questions.filter(function (q) { return q.type === 'big' && !q.elective; });
  var elec = DATA.questions.filter(function (q) { return q.type === 'big' && q.elective; });
  var h = '<section class="pp-section"><h2>一、选择题</h2><p class="pp-section-desc">每小题 6 分，共 42 分。在每小题给出的四个选项中，只有一项是符合题目要求的。</p>';
  choice.forEach(function (q) { h += renderChoice(q); });
  h += '</section><section class="pp-section"><h2>二、非选择题（必考）</h2><p class="pp-section-desc">共 3 题。先把答案写在输入框里，再点“看答案”对照参考答案与解析，自评对、半对或错。</p>';
  big.forEach(function (q) { h += renderBig(q); });
  h += '</section><section class="pp-section"><h2>三、选考题（二选一）</h2>' +
    '<div class="pp-elective-bar"><p>从下面两题中任选一题作答，多答按所答的第一题计分。本卷只计你选中的一题。</p>' +
    '<button type="button" data-elective="Q11" class="' + (state.elective === 'Q11' ? 'pp-elective--on' : '') + '">选第 35 题（物质结构）</button>' +
    '<button type="button" data-elective="Q12" class="' + (state.elective === 'Q12' ? 'pp-elective--on' : '') + '">选第 36 题（有机化学）</button></div>';
  elec.forEach(function (q) { h += renderBig(q); });
  h += '</section>';
  $('ppSections').innerHTML = h;
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
    else if (!q.elective || q.id === state.elective) q.parts.forEach(function (p) { items.push(p.id); });
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
  $('ppProgressFill').style.width = (items.length ? Math.round(done / items.length * 100) : 0) + '%';
}

/* ---------- 判分 ---------- */
function scoreChoice(q) {
  return state.answers[q.id] === q.answer ? q.points : 0;
}
function scorePart(q, p, idx) {
  var pts = partPoint(q, idx);
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
    } else if (!q.elective || q.id === state.elective) {
      q.parts.forEach(function (p, i) {
        var s = scorePart(q, p, i), max = partPoint(q, i);
        bigScore += s;
        var rated = p.type === 'multi' ? (state.answers[p.id] || []).length > 0 : !!state.rates[p.id];
        detail.push({id: p.id, label: p.id + '（第 ' + q.id.replace('Q', '') + ' 题）', got: s, max: max,
          ok: s === max, unrated: !rated, sop: p.sop, analysis: p.analysis});
      });
    }
  });
  var total = Math.round((choiceScore + bigScore) * 10) / 10;
  return {total: total, choice: choiceScore, big: Math.round(bigScore * 10) / 10, detail: detail};
}
function scoreHTML(sc) {
  var h = '<div class="pp-score-total"><div class="pp-score-num">' + sc.total + ' <span style="font-size:18px">/ 100</span></div>' +
    '<div class="pp-score-sub">选择题 ' + sc.choice + ' / 42 分 · 大题自评 ' + sc.big + ' / 58 分（选考计 ' + (state.elective === 'Q11' ? '第 35 题' : '第 36 题') + '）</div></div>';
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
  h += '<p class="pp-score-note">大题为自评得分：对照参考答案后自己评的对、半对、错。大题小问分值为自定（按大题总分均分），仅供自测参考，非原卷分值。</p>';
  return h;
}
function submit() {
  if (state.submitted) { showScore(); return; }
  var items = scoredItems();
  var undone = items.filter(function (id) { return !isAnswered(id); }).length;
  var unrated = 0;
  DATA.questions.forEach(function (q) {
    if (q.type !== 'big') return;
    if (q.elective && q.id !== state.elective) return;
    q.parts.forEach(function (p) {
      if (p.type !== 'multi' && !state.rates[p.id]) unrated++;
    });
  });
  var msg = '';
  if (undone) msg += '还有 ' + undone + ' 道题未作答，';
  if (unrated) msg += '还有 ' + unrated + ' 个大题小问未自评（按 0 分计），';
  if (msg && !confirm(msg + '确定交卷吗？')) return;
  state.submitted = true;
  state.score = computeScore();
  save();
  render();
  showScore();
}
function showScore() {
  if (!state.score) state.score = computeScore();
  $('ppScoreBody').innerHTML = scoreHTML(state.score);
  $('ppScoreModal').hidden = false;
}

/* ---------- 答题卡 ---------- */
function cardStatus(id) {
  if (!state.submitted) return isAnswered(id) ? 'pp-card--done' : '';
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
    sec('第 ' + q.id.replace('Q', '') + ' 题' + (q.elective ? (q.id === state.elective ? '（已选）' : '（未选）') : ''),
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
  if (!e.target.closest('.pp-anno-toolbar')) hideToolbar();
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

/* ---------- 其他试卷 ---------- */
function renderOthers() {
  $('ppOthersList').innerHTML = OTHER_PAPERS.map(function (p, i) {
    return '<button type="button" data-paper="' + i + '">' + esc(p[0]) + '</button>';
  }).join('');
}
function openPaper(i) {
  var p = OTHER_PAPERS[i];
  document.querySelectorAll('[data-paper]').forEach(function (b) { b.classList.remove('pp-others--on'); });
  document.querySelector('[data-paper="' + i + '"]').classList.add('pp-others--on');
  $('ppPdfTitle').textContent = p[0];
  $('ppPdfOpen').href = p[1];
  $('ppPdfFrame').src = p[1];
  $('ppPdfWrap').hidden = false;
  $('ppPdfWrap').scrollIntoView({behavior: 'smooth', block: 'nearest'});
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
  $('ppTimer').classList.toggle('pp-timer--over', t.remain === 0);
  $('ppTimerBtn').textContent = t.paused ? '继续' : '暂停';
}
setInterval(tickTimer, 1000);

/* ---------- 抽屉与弹窗 ---------- */
function closeDrawers() { $('ppCardDrawer').hidden = true; $('ppAnnoDrawer').hidden = true; }
function closeModals() {
  ['ppScoreModal', 'ppSopModal', 'ppNoteModal'].forEach(function (id) { $(id).hidden = true; });
}

/* ---------- 事件 ---------- */
document.addEventListener('click', function (e) {
  var t = e.target;
  var sopBtn = t.closest('[data-sop]');
  if (sopBtn) { openSop(sopBtn.dataset.sop); return; }
  var closeDrawer = t.closest('[data-close-drawer]');
  if (closeDrawer) { closeDrawers(); return; }
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
  var choice = t.closest('[data-choice]');
  if (choice && !state.submitted) {
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
  var elec = t.closest('[data-elective]');
  if (elec && !state.submitted) {
    state.elective = elec.dataset.elective;
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
  var paper = t.closest('[data-paper]');
  if (paper) { openPaper(parseInt(paper.dataset.paper, 10)); return; }
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
$('ppScoreRestart').addEventListener('click', function () {
  if (!confirm('确定重新开始吗？作答与成绩将被清空，标注会保留。')) return;
  state = defaultState();
  save();
  closeModals();
  render();
  window.scrollTo({top: 0, behavior: 'smooth'});
  toast('已重新开始。');
});
$('ppMarkBtn').addEventListener('click', function () { addAnnotation(''); });
$('ppNoteBtn').addEventListener('click', function () {
  if (!pendingSel) return;
  $('ppNoteQuote').textContent = pendingSel.text;
  $('ppNoteText').value = '';
  delete $('ppNoteModal').dataset.editId;
  $('ppNoteModal').hidden = false;
  hideToolbar();
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

/* ---------- 初始化 ---------- */
renderOthers();
render();
tickTimer();
})();
