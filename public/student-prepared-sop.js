(function () {
'use strict';

function parseAction(source, id) {
  const fields = source.split(' → ').map(field => field.trim());
  if (fields.length !== 2 || fields.some(field => !field)) throw new Error('SOP ' + id + ' 缺少操作或输出');
  return {action:fields[0],output:fields[1]};
}

const catalog = window.ChemPreparedSopGroups.flatMap(([prefix,book,topic,source]) =>
  source.trim().split(/\r?\n/).map(line => {
    const fields = line.split('|').map(field => field.trim());
    if (fields.length !== 8 || fields.some(field => !field) || !/^\d\d$/.test(fields[0])) {
      throw new Error('SOP 条目格式有误：' + prefix + ' ' + fields[0]);
    }
    const [number,title,context,ask,input,work,finish,check] = fields;
    const id = prefix + number;
    return {id,book,topic,title,context:context.split('/'),ask:ask.split('/'),input,check,
      work:parseAction(work,id),finish:parseAction(finish,id)};
  })
);
const byId = new Map(catalog.map(item => [item.id,item]));
if (byId.size !== catalog.length) throw new Error('SOP 编号重复');

const normalize = text => String(text).normalize('NFKC').toLowerCase()
  .replace(/[−–]/g,'-').replace(/\s+/g,'');
const lookup = (text, terms) => terms.reduce((best,term) => {
  const value = normalize(term);
  return value.length > best.length && text.includes(value) ? value : best;
},'');
const cues = catalog.map(item => ({
  item, context:item.context.map(normalize), ask:item.ask.map(normalize)
}));

function cleanQuestionText(question) {
  return question.split(/\r\n?|\n/).map(line => {
    const content = line.replace(/^[ \t\u00a0\u3000]*(?:[>＞][ \t\u00a0\u3000]*)+/,'');
    if (content === line) return line;
    const start = content.normalize('NFKC');
    // Keep a comparison at the start of a wrapped line, such as "> 0.10 mol/L".
    const comparison = /^(?:=|[+−-]?(?:\d|\.\d))/.test(start);
    const number = /^\d{1,2}[.、](?!\d)/.test(start);
    return comparison && !number ? line : content;
  }).join('\n').trim();
}

function readChoices(question) {
  const text = question.normalize('NFKC');
  const markers = [...text.matchAll(/(?:^|[\s。!?；;,，])[ \t]*(?:[-*•][ \t]+)?(?:\(([A-H])\)|([A-H])[.、:)])[ \t]*/g)];
  const stem = text.slice(0,markers[0]?.index ?? text.length).trim();
  const options = markers.map((marker,i) => ({
    letter:marker[1] || marker[2],
    content:text.slice(marker.index + marker[0].length,markers[i+1]?.index).trim()
  }));
  return {text,stem,options};
}

function splitQuestion(question) {
  const text = cleanQuestionText(question);
  let marks = [...text.matchAll(/(?:^|[\n。；;]\s*)[ \t]*([（(]\d{1,2}[）)]|[①②③④⑤⑥⑦⑧⑨⑩]|第[一二三四五六七八九十\d]+问[：:]?)\s*/g)];
  if (marks.length < 2) marks = [...text.matchAll(/(?:^|\n)[ \t]*(\d{1,2}[.．、])(?!\d)[ \t]*/g)];
  if (marks.length < 2) return [{label:'本题',context:'',prompt:text,text}];
  const context = text.slice(0,marks[0].index + (/^[。；;]/.test(marks[0][0]) ? 1 : 0)).trim();
  const parts = marks.map((mark,index) => {
    const limit = marks[index+1]?.index ?? text.length;
    const nextStartsWithPunctuation = /^[。；;]/.test(marks[index+1]?.[0] || '');
    const prompt = text.slice(mark.index + mark[0].length,limit + Number(nextStartsWithPunctuation)).trim();
    return {label:mark[1],context,prompt,text:[context,prompt].filter(Boolean).join('\n')};
  });
  return parts.some(part => !part.prompt) ? [{label:'本题',context:'',prompt:text,text}] : parts;
}

function rank(part) {
  const {stem} = readChoices(part.prompt);
  const fullText = normalize([part.context,stem].join('\n'));
  const localText = normalize(stem);
  const sentences = stem.split(/[。；;！？?\n]+/).filter(sentence => sentence.trim() &&
    !/^(?:结果\s*)?(?:保留|用科学计数法|用整数表示|填标号|不计|忽略)/.test(sentence.trim()));
  const request = normalize(sentences.at(-1) || stem);
  const jointRequest = normalize(sentences.slice(-2).join(' '));
  const matches = [];
  for (const rule of cues) {
    const context = lookup(fullText,rule.context);
    const ask = lookup(request,rule.ask);
    if (!context || !ask) continue;
    const direct = localText.includes(context);
    const extra = lookup(jointRequest,rule.ask).length - ask.length;
    const score = 3 * Math.min(ask.length,12) + Math.min(context.length,10) + (direct ? 2 : 0) + Math.min(extra,2);
    matches.push({id:rule.item.id,context,ask,score});
  }
  matches.sort((a,b) => b.score - a.score || a.id.localeCompare(b.id));
  return matches.slice(0,5);
}

const broadAsks = new Set(['原因','作用','现象','产物','条件','成分','组成','质量','浓度','数值','解释','是否正确','错误的是']);

function confidentMatch([best,next]) {
  if (!best || best.context.length < 2 || best.ask.length < 2) return '';
  const floor = broadAsks.has(best.ask) ? 16 : 11;
  return best.score >= floor && (!next || best.score - next.score >= 4) ? best.id : '';
}

function makePlan(entry) {
  const prerequisites = '已圈出的条件：' + entry.input;
  const ready = '写出带依据的' + entry.finish.output;
  const steps = [
    {title:'从原题找条件',input:'原题，含题图、表格或选项',
      action:'从题里摘出' + entry.input + '。先核对每个条件对应的对象。',
      output:prerequisites,attention:'把已知、待补和题目所求分开写。',
      criteria:'能指出下一步会用到的数据和条件来自原题哪里。'},
    {title:'先确定' + entry.work.output,input:prerequisites,
      action:entry.work.action,output:entry.work.output,attention:'把所用的条件、单位或适用范围和结果放在一起。',
      criteria:'能写清' + entry.work.output + '从哪来。'},
    {title:'写出' + entry.finish.output,input:entry.work.output,
      action:entry.finish.action,output:entry.finish.output,attention:'先用上一步的结果，再给出题目要求的结论或数值。',
      criteria:ready + '。'},
    {title:'检查关键易错点',input:entry.finish.output,
      action:entry.check,output:'核对后的' + entry.finish.output,attention:'有条件未核实时标出哪些结论受它影响。',
      criteria:'已按上述条件检查结论，能说清要更正的地方。'}
  ];
  return {title:entry.title,missing:[],steps,
    hints:['在题干和小问里找这些信息：' + entry.input + '。',
      '这一步只处理' + entry.work.output + '。先写下你用到的一个已知条件。',
      '把前一步的' + entry.work.output + '写在旁边，再按题目的设问组织答案。',
      entry.check]};
}

function reading(entry,type) {
  return {type,topic:entry.topic,method:entry.title,firstLook:entry.input};
}

const stepLabels = [['输入','input'],['操作','action'],['输出','output'],['注意事项','attention'],['完成标准','criteria']];

function showEntry(root,entry,actions = '') {
  const escape = value => window.ChemStudio.escape(String(value));
  const plan = makePlan(entry);
  root.innerHTML = `<section class="study-card study-sop-detail">
    <p class="study-note">${escape(entry.book)} › ${escape(entry.topic)}</p>
    <h2>${entry.id} · ${escape(entry.title)}</h2>
    ${actions ? '<div class="study-actions">' + actions + '</div>' : ''}
    ${plan.steps.map((step,index) => `<details ${index === 0 ? 'open' : ''}>
      <summary>${entry.id}-0${index+1} · ${escape(step.title)}</summary>
      <dl>${stepLabels.map(([label,key]) => `<dt>${label}</dt><dd>${escape(step[key])}</dd>`).join('')}</dl></details>`).join('')}
  </section>`;
}

function mountCatalog(root,onChoose) {
  const escape = value => window.ChemStudio.escape(String(value));
  const books = [...new Set(catalog.map(item => item.book))];
  root.innerHTML = `<section class="study-card prepared-catalog" aria-label="解题步骤">
    <h2>解题步骤 <small>${catalog.length} 套</small></h2>
    <div class="prepared-search"><label>搜题型或编号<input type="search" data-prepared-search placeholder="例如：滴定、推断元素、H02"></label>
    <label>课程范围<select data-prepared-book><option value="">全部范围</option>
      ${books.map(book => `<option>${escape(book)}</option>`).join('')}</select></label></div>
    <p class="study-note" data-prepared-count role="status"></p><div class="prepared-list"></div>
    <div class="study-actions"><button type="button" class="btn-sub" data-prepared-page="-1">上一页</button>
    <button type="button" class="btn-sub" data-prepared-page="1">下一页</button></div>
  </section>`;
  const search = root.querySelector('[data-prepared-search]');
  const book = root.querySelector('[data-prepared-book]');
  const list = root.querySelector('.prepared-list');
  const size = 12;
  let page = 0;

  function draw() {
    const query = normalize(search.value);
    const found = catalog.filter(item => (!book.value || item.book === book.value) &&
      (!query || normalize([item.id,item.topic,item.title,...item.context,...item.ask].join(' ')).includes(query)));
    const pages = Math.max(1,Math.ceil(found.length / size));
    page = Math.max(0,Math.min(page,pages-1));
    root.querySelector('[data-prepared-count]').textContent = '找到 ' + found.length + ' 套 · 第 ' + (page+1) + '/' + pages + ' 页';
    list.innerHTML = found.slice(page*size,(page+1)*size).map(item =>
      `<button type="button" class="study-topic" data-prepared-id="${item.id}"><strong>${escape(item.title)}</strong>
      <small>${item.id} · ${escape(item.topic)}</small></button>`).join('') || '<p>可换个关键词，或者选课程范围找题型。</p>';
    root.querySelector('[data-prepared-page="-1"]').disabled = page === 0;
    root.querySelector('[data-prepared-page="1"]').disabled = page + 1 >= pages;
  }

  search.oninput = book.onchange = () => { page = 0; draw(); };
  root.onclick = event => {
    const control = event.target.closest('[data-prepared-id],[data-prepared-page]');
    if (!control || !root.contains(control)) return;
    const id = control.dataset.preparedId;
    if (id && byId.has(id)) onChoose(byId.get(id));
    if (control.dataset.preparedPage) {
      page += Number(control.dataset.preparedPage);
      draw();
    }
  };
  draw();
}

window.ChemPreparedSop = {catalog,byId,cleanQuestionText,readChoices,splitQuestion,rank,confidentMatch,makePlan,reading,showEntry,mountCatalog};
})();
