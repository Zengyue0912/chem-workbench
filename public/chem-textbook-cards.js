// 知识点卡片：每节的结构化速览（概念 / 方程式 / 易错点），与学习提示笔记互补。
// 各册数据分文件存放，由子任务按册编写；本模块只负责合并与渲染。
import {cards as r1} from './chem-textbook-cards-required-1.js?v=1';
import {cards as r2} from './chem-textbook-cards-required-2.js?v=1';
import {cards as s1} from './chem-textbook-cards-selective-1.js?v=1';
import {cards as s2} from './chem-textbook-cards-selective-2.js?v=1';
import {cards as s3} from './chem-textbook-cards-selective-3.js?v=1';

export const textbookCards = {
  'required-1': r1,
  'required-2': r2,
  'selective-1': s1,
  'selective-2': s2,
  'selective-3': s3,
};

const KINDS = {c: ['concept', '概念'], e: ['equation', '方程式'], p: ['pitfall', '易错点']};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function cardMarkup(book, selected) {
  const items = textbookCards[book.id]?.[selected.id];
  if (!items?.length) return '';
  return `<section class="ct-cards" aria-label="知识点卡片">
    <h3>知识点卡片</h3>
    <div class="ct-card-grid">${items.map(item => {
      const [cls, label] = KINDS[item.k] || KINDS.c;
      return `<div class="ct-card ct-card--${cls}"><p class="ct-card-tag">${label}</p><h4>${esc(item.t)}</h4><p class="ct-card-body">${esc(item.d)}</p></div>`;
    }).join('')}</div>
  </section>`;
}
