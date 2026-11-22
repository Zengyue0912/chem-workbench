import {officialReader, publisherGuide, textbookPortal, textbooks} from './chem-textbook-data.js?v=2';
import {textbookNotes} from './chem-textbook-notes.js?v=2';
import {modelMarkup, mountModels, unmountModels} from './chem-textbook-models.js?v=2';
import {labMarkup, mountLabs, unmountLabs} from './chem-textbook-labs.js?v=2';
import './chem-textbook-preview.js?v=3';
import './chem-book.js?v=4';

const electrolysisSection = {volume:'selective-1', section:'electrolysis'};

const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[c]);
const normal = text => String(text ?? '').normalize('NFKC').toLowerCase().replace(/[\s、，。·∶–—-]/g, '');
const kindNames = {intro:'导读', lab:'实验活动', review:'复习', appendix:'附录'};
const bookName = book => book.title === book.label ? book.title : book.label + ' · ' + book.title;
const officialLink = (href, label, className = 'ct-official') =>
  `<a class="${className}" href="${escape(href)}" target="_blank" rel="noopener noreferrer">${escape(label)} <span aria-hidden="true">↗</span></a>`;

function entries(book) {
  return book.groups.flatMap(([group, rows]) => {
    let index = 0;
    return rows.map(([id, title, page, guide, links = '']) => {
      const kind = id.split('-')[0];
      const tag = kindNames[kind] || '第' + '一二三四五六七八九'[index++] + '节';
      return {id, title, page, guide, links:links.split(' ').filter(Boolean), group, tag};
    });
  });
}

function routeLink(href, label, className) {
  return `<a href="${escape(href)}" data-ct-route class="${className}">${escape(label)}</a>`;
}

function volumeMarkup(book, href) {
  const heading = book.groups.find(([group]) => group)?.[0] || book.label;
  return `<a class="ct-volume ct-${book.id}" data-ct-route href="${escape(href)}" aria-label="翻开${escape(bookName(book))}">
    <div class="ct-book-well" aria-hidden="true">
      <div class="ct-book-object">
        <div class="ct-book-back"></div>
        <div class="ct-book-fore"></div>
        <div class="ct-book-heel"></div>
        <div class="ct-book-page"><span>目录</span><p>${escape(heading)}</p><i></i><i></i><i></i></div>
        <div class="ct-book-cover">
          <div class="ct-book-face ct-book-front">
            <span>${book.label}</span><strong>${escape(book.imprint)}</strong>
          </div>
          <div class="ct-book-face ct-book-inside"></div>
        </div>
      </div>
    </div>
    <div class="ct-volume-copy">
      ${book.title !== book.label ? `<span>${book.label}</span>` : ''}
      <h2>${escape(book.title)}</h2><p>${escape(book.summary)}</p>
      <span class="ct-read">翻开 <span aria-hidden="true">↗</span></span>
    </div>
  </a>`;
}

function shelfMarkup(env) {
  return `<div class="ct-shelf-hero">
    <div class="ct-shelf-intro"><header class="ct-header"><div>
      <p class="ct-edition">人教版 · 普通高中</p>
      <h1 data-ct-heading>高中化学课本</h1>
      <p>翻开课本，按章节读重点、做实验。</p>
    </div></header>
    <section class="ct-find" aria-labelledby="ct-find-label">
      <label id="ct-find-label" for="ct-query">搜全套课本</label>
      <div class="ct-query-wrap"><input type="search" id="ct-query" name="textbook-query" placeholder="输入章节、实验或知识点…" autocomplete="off" maxlength="80">
        <button class="cw-secondary" type="button" data-ct-clear hidden>清空</button></div>
      <div data-ct-results hidden></div>
      <span class="ct-sr-only" data-ct-search-status role="status"></span>
    </section>
    <button class="cw-secondary" type="button" data-cw-action="home">返回工作台</button></div>
    <section class="ct-feature" aria-labelledby="ct-feature-title">
      <textbook-lab-preview></textbook-lab-preview>
      <div class="ct-feature-copy"><h2 id="ct-feature-title">电解水</h2>
        ${routeLink(env.href(electrolysisSection), '翻到《电解池》', 'ct-primary')}</div>
    </section>
  </div>
  <section class="ct-shelf" aria-label="五册教材">
    ${textbooks.map(book=>volumeMarkup(book,env.href({volume:book.id}))).join('')}
  </section>
  <details class="ct-legacy"><summary>浏览全部实验</summary><div class="cb-catalog">${env.experiments()}</div></details>
  <footer class="ct-foot">${officialLink(textbookPortal,'国家中小学智慧教育平台')}${officialLink(publisherGuide,'人教社教材介绍')}</footer>`;
}

function outlineMarkup(book, rows, selected, href) {
  return book.groups.map(([group]) => {
    const chapterRows = rows.filter(row => row.group === group);
    const current = chapterRows.some(row => row.id === selected.id);
    const list = chapterRows.map(row => `<li><a data-ct-route href="${escape(href({volume:book.id, section:row.id}))}"
      ${row.id === selected.id ? 'aria-current="page"' : ''}>
      <span>${escape(row.title)}</span>${row.page ? `<small aria-label="第 ${row.page} 页">${row.page}</small>` : ''}</a></li>`).join('');
    if (!group) return `<ul class="ct-outline-intro">${list}</ul>`;
    return `<details ${current ? 'open' : ''}><summary>${escape(group)}</summary><ul>${list}</ul></details>`;
  }).join('');
}

const noteStyles = [['core','核心概念'], ['method','怎么判断'], ['trap','常见易错']];

function learningMarkup(selected, notes, title = '本节重点') {
  if (!notes) return `<section class="ct-reading"><h3>学习提示</h3><p>${escape(selected.guide)}</p></section>`;
  return `<section class="ct-key-points" aria-label="本节重点">
    ${title ? `<h3>${title}</h3>` : ''}
    <dl>${notes.map((note, i) => {
      const [style, label] = noteStyles[i];
      const emphasis = escape(note).replace(/\[([^\[\]]+)\]/g, '<strong>$1</strong>');
      return `<div class="ct-key-point ct-key-point--${style}"><dt>${label}</dt><dd>${emphasis}</dd></div>`;
    }).join('')}</dl>
  </section>`;
}

function resourceMarkup(book, selected, env, resources) {
  return resources.length ? `<section class="ct-resources"><h3>配套资源</h3>
    <ul>${resources.map(resource => `<li><a data-ct-route href="${escape(env.resourceHref(book,selected,resource))}">
      <span class="ct-resource-kind">${escape(resource.kindLabel)}</span><strong>${escape(resource.name)}</strong><span aria-hidden="true">→</span></a></li>`).join('')}</ul>
  </section>` : '';
}

function chapterMarkup(book, rows, selected, env) {
  const inline = book.id === electrolysisSection.volume && selected.id === electrolysisSection.section;
  const resources = selected.links.filter(key => !inline || key !== 'lab:water').map(key => env.resource(key)).filter(Boolean);
  const notes = textbookNotes[book.id]?.[selected.id];
  const index = rows.indexOf(selected);
  const adjacent = [rows[index - 1], rows[index + 1]];
  const sectionHeading = selected.tag.startsWith('第') ? selected.tag : '';
  const breadcrumb = `<nav class="ct-breadcrumb" aria-label="课本导航">
    ${routeLink(env.href({}), '高中化学课本', 'ct-bread')}
    <span aria-hidden="true">/</span><span aria-current="page">${escape(bookName(book))}</span></nav>`;
  const heading = `<p class="ct-location">${escape(selected.group || selected.tag)}${sectionHeading ? ' · ' + escape(sectionHeading) : ''}</p>
    <h2 id="ct-lesson-title" data-ct-heading>${escape(selected.title)}</h2>
    ${selected.page ? `<p class="ct-page">原书第 <strong>${selected.page}</strong> 页 <span>按纸书印刷页码</span></p>` : ''}`;
  const links = resourceMarkup(book,selected,env,resources);
  const outline = outlineMarkup(book,rows,selected,env.href);
  const original = officialLink(officialReader(book),'查看这册教材原文','ct-secondary');
  const otherVolumes = routeLink(env.href({}), '查看其他册', 'ct-secondary');
  const pageTurns = `<div class="ct-page-turns" aria-label="前后章节">${adjacent.map((row,i)=>row
    ? routeLink(env.href({volume:book.id,section:row.id}),i === 0 ? '← 上一项' : '下一项 →','ct-secondary')
    : '<span></span>').join('')}</div>`;
  if (inline) return `<div class="ct-inline-top">
    ${breadcrumb}
    <div class="ct-head-actions">
      <details class="ct-inline-directory"><summary class="ct-secondary">本册目录</summary>
        <nav class="ct-outline" aria-label="本册目录">${outline}</nav></details>
      ${original}
    </div>
  </div>
  <div class="ct-inline-spread">
    <div class="ct-turn-sheet" aria-hidden="true"></div>
    <chemistry-book embedded aria-labelledby="ct-lesson-title">
      <div class="ct-inbook-heading" data-book-context>${heading}</div>
      <details class="ct-inbook-reading" data-book-reading>
        <summary>本节重点</summary>${learningMarkup(selected,notes,'')}
      </details>
    </chemistry-book>
  </div>
  <div class="ct-inline-footer">${links}${pageTurns}</div>`;

  return `${breadcrumb}
  <header class="ct-header ct-chapter-head"><div>
    <p class="ct-edition">${escape(book.title === book.label ? '人教版 · 普通高中' : book.label)}</p>
    <h1>${escape(book.title)}</h1><p class="ct-book-isbn">ISBN ${book.isbn}</p>
  </div><div class="ct-head-actions">
    ${original}
    ${otherVolumes}
  </div></header>
  <div class="ct-spread">
    <nav class="ct-outline" aria-label="本册目录">
      <h2>本册目录</h2>${outline}
    </nav>
    <article class="ct-lesson" aria-labelledby="ct-lesson-title">
      <div class="ct-turn-sheet" aria-hidden="true"></div>
      ${heading}
      ${learningMarkup(selected, notes)}
      ${modelMarkup(book, selected, env)}
      ${labMarkup(book, selected, env)}
      ${links || `<p class="ct-no-resources">${selected.page ? '本节可按上方页码查阅教材原文。' : '可在官方教材里查看这一项。'}</p>`}
      ${pageTurns}
    </article>
  </div>
  <footer class="ct-foot"><span>目录按 2019 审定教材编排，页码以所选电子版为准。</span>
    ${officialLink(textbookPortal,'官方教材目录')}${officialLink(publisherGuide,'人教社教材介绍')}
  </footer>`;
}

function keywordIndex(env) {
  return textbooks.flatMap(book => entries(book).map(row => {
    const resourceNames = row.links.map(key => env.resource(key)?.name || '').join(' ');
    const title = normal(row.title);
    return {book, row, title,
      text:normal([bookName(book),row.group,row.title,resourceNames].join(' '))};
  }));
}

function enableSearch(host, env, value = '') {
  const input = host.querySelector('#ct-query'), result = host.querySelector('[data-ct-results]');
  const status = host.querySelector('[data-ct-search-status]'), clear = host.querySelector('[data-ct-clear]');
  const index = keywordIndex(env);
  input.value = value.slice(0,80);

  function draw() {
    const value = input.value.trim();
    env.onQuery(value);
    const key = normal(value);
    clear.hidden = !value;
    result.hidden = !key;
    if (!key) {
      result.replaceChildren();
      status.textContent = '';
      return;
    }

    const matches = index.filter(item => item.text.includes(key))
      .sort((a,b) => Number(b.title.includes(key)) - Number(a.title.includes(key)));
    status.textContent = matches.length ? '找到 ' + matches.length + ' 项' : '没有找到相关章节';
    result.innerHTML = matches.length
      ? `<p class="ct-result-count">找到 ${matches.length} 项</p><ul>${matches.map(({book,row}) =>
        `<li><a href="${escape(env.href({volume:book.id,section:row.id}))}" data-ct-route>
          <strong>${escape(row.title)}</strong><span>${escape(bookName(book))}${row.group ? ' · ' + escape(row.group) : ''}</span>
        </a></li>`).join('')}</ul>`
      : '<p class="ct-result-count">没有找到相关章节。试试教材里的名称，如「电解池」或「晶体」。</p>';
  }
  input.addEventListener('input',draw);
  input.addEventListener('search',draw);
  clear.addEventListener('click',()=>{
    input.value = '';
    draw();
    input.focus();
  });
  draw();
}

export function mountTextbook(host, {volume, section, bookQuery}, env) {
  unmountModels();
  unmountLabs();
  const book = textbooks.find(book => book.id === volume);
  if (!book) {
    host.innerHTML = shelfMarkup(env);
    enableSearch(host,env,bookQuery);
  } else {
    const rows = entries(book);
    const selected = rows.find(row => row.id === section) ?? rows.find(row => row.group) ?? rows[0];
    host.innerHTML = chapterMarkup(book, rows, selected, env);
  }
  mountModels(host);
  mountLabs(host);
  const heading = host.querySelector('[data-ct-heading]');
  heading.tabIndex = -1;
  heading.focus({preventScroll:true});
}
