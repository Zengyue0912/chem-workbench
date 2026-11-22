// 课本章节 → 预制 SOP 映射。数据按册拆在 4 个分文件里，这里合并后导出。
// 每个 SOP 编号（如 M01）只出现在一个章节；章节页用 sopMarkup 渲染「本节 SOP」。
import {sopMap as required} from './chem-textbook-sop-required.js?v=1';
import {sopMap as selective1} from './chem-textbook-sop-selective-1.js?v=1';
import {sopMap as selective2} from './chem-textbook-sop-selective-2.js?v=1';
import {sopMap as selective3} from './chem-textbook-sop-selective-3.js?v=1';

const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[c]);

export const textbookSop = {};
for (const part of [required, selective1, selective2, selective3]) {
  for (const [volume, sections] of Object.entries(part)) {
    textbookSop[volume] ||= {};
    for (const [section, ids] of Object.entries(sections)) {
      textbookSop[volume][section] = [...(textbookSop[volume][section] || []), ...ids];
    }
  }
}
// 各分册合并后统一按编号排序（同一节可能来自多个分册）。
for (const sections of Object.values(textbookSop)) {
  for (const [section, ids] of Object.entries(sections)) sections[section] = [...ids].sort();
}

export function sopMarkup(book, selected, env) {
  const ids = textbookSop[book.id]?.[selected.id];
  if (!ids?.length) return '';
  const items = ids.map(id => env.resource('sop:' + id)).filter(Boolean);
  if (!items.length) return '';
  return `<section class="ct-resources ct-sop"><h3>本节 SOP</h3>
    <p class="ct-sop-note">照着这些解题流程做题，做完逐项自查。</p>
    <ul>${items.map(resource => `<li><a data-ct-route href="${escape(env.resourceHref(book,selected,resource))}">
      <span class="ct-resource-kind">${escape(resource.kindLabel)}</span><strong>${escape(resource.id + ' · ' + resource.name)}</strong><span aria-hidden="true">→</span></a></li>`).join('')}</ul>
  </section>`;
}
