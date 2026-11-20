/* ============================================================================
 * 高中化学 3D 考点工作台 — 分享与学习打卡（工作流 3）
 * 只做加法：独立文件，不修改 W1 的任何 JS 源码。
 *
 * 功能：
 * - 一键复制链接：ChemShare.copyLink()（Clipboard API + execCommand 兜底）。
 * - 学习打卡卡片：ChemShare.makeCheckinCard()，Canvas 绘制品牌卡片并下载 PNG。
 *   卡片含产品名、今日学习主题、日期、二维码占位区（占位，不伪造可扫码图案）。
 * - 打卡文案来源：优先读取页面面包屑（当前学习对象）；其次扫描 localStorage
 *   chem3d_ / chem3d_v2_ 学习记录中的主题名；读不到时用默认文案。
 *
 * 接入：给按钮加 data-share="copy" / data-share="checkin" 即可（委托点击，
 * 动态按钮同样生效；样式可用 css/enhance.css 的 .chem-share-btn）。
 * ========================================================================== */
(function () {
  'use strict';

  var DEFAULT_TOPIC = '高中化学 · 3D 考点复习';
  var PRODUCT_NAME = '高中化学 3D 考点工作台';
  var SCHOOL_NAME = '江西师范大学';
  var CARD_W = 1080, CARD_H = 1440;

  function track(event, data) {
    if (window.ChemAnalytics && typeof window.ChemAnalytics.track === 'function') {
      try { window.ChemAnalytics.track(event, data || {}); } catch (e) { /* 忽略 */ }
    }
  }

  /* 复用站内 toast 样式（#toast.show，与 js/inline-08-ui.js 的 toast 同款） */
  var toastTimer = 0;
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* ---------- 1. 一键复制链接 ---------- */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (e) {
        document.body.removeChild(ta);
        reject(e);
      }
    });
  }
  function copyLink(url) {
    var link = url || location.href;
    return copyText(link).then(function () {
      toast('链接已复制，快分享给同学吧');
      track('share_copy', { url: link });
      return true;
    }).catch(function () {
      toast('复制失败，请长按地址栏手动复制');
      return false;
    });
  }

  /* ---------- 2. 今日学习主题 ---------- */
  function topicFromCrumb() {
    var crumb = document.getElementById('crumb');
    if (!crumb) return '';
    /* 面包屑形如“工作台 / 化学实验 / 酸碱中和滴定”，取最后一段 */
    var text = (crumb.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    var parts = text.split(/[/>›]/).map(function (s) { return s.trim(); }).filter(Boolean);
    var last = parts[parts.length - 1] || '';
    if (!last || last === '工作台' || last === '首页') return '';
    return last;
  }
  function topicFromStorage() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || (key.indexOf('chem3d_') !== 0 && key.indexOf('chem3d_v2_') !== 0)) continue;
        var raw = localStorage.getItem(key);
        if (!raw) continue;
        var val = null;
        try { val = JSON.parse(raw); } catch (e) { continue; }
        if (val && typeof val === 'object') {
          var hit = val.topic || val.title || val.name || val.lastTopic || '';
          if (typeof hit === 'string' && hit.trim()) return hit.trim();
          /* 进度对象：取最近一条记录的主题 */
          var keys = Object.keys(val);
          for (var j = keys.length - 1; j >= 0; j--) {
            var item = val[keys[j]];
            if (item && typeof item === 'object' && typeof item.topic === 'string' && item.topic.trim()) {
              return item.topic.trim();
            }
          }
        }
      }
    } catch (e) { /* 存储不可读时回落默认文案 */ }
    return '';
  }
  function getTodayTopic() {
    return topicFromCrumb() || topicFromStorage() || DEFAULT_TOPIC;
  }

  function formatDate(d) {
    var week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 · 星期' + week;
  }
  function dateStamp(d) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
  }

  /* ---------- 3. 打卡卡片 ---------- */
  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); }; // 校徽加载失败时卡片仍可生成
      img.src = src;
    });
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function wrapText(ctx, text, maxWidth) {
    var lines = [], line = '';
    for (var i = 0; i < text.length; i++) {
      var test = line + text[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = text[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines.slice(0, 3);
  }

  function makeCheckinCard(options) {
    options = options || {};
    var topic = options.topic || getTodayTopic();
    var now = new Date();
    var emblemUrl = new URL('assets/jxnu-emblem.jpg', document.baseURI).toString();

    return loadImage(emblemUrl).then(function (emblem) {
      var canvas = document.createElement('canvas');
      canvas.width = CARD_W;
      canvas.height = CARD_H;
      var ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 不可用');

      /* 背景：品牌青绿渐变 + 装饰圆 */
      var grad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
      grad.addColorStop(0, '#0e6b57');
      grad.addColorStop(0.55, '#0f8a70');
      grad.addColorStop(1, '#14b8a6');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CARD_W, CARD_H);
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath(); ctx.arc(900, 180, 260, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(140, 1180, 220, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(980, 1080, 120, 0, Math.PI * 2); ctx.fill();

      /* 白色内容卡 */
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, 72, 72, CARD_W - 144, CARD_H - 144, 40);
      ctx.fill();

      /* 校徽 + 学校名 */
      var y = 150;
      if (emblem) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(170, y + 44, 44, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(emblem, 126, y, 88, 88);
        ctx.restore();
      }
      ctx.fillStyle = '#0e6b57';
      ctx.font = '600 34px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(SCHOOL_NAME, 240, y + 32);
      ctx.fillStyle = '#5b8a85';
      ctx.font = '26px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(PRODUCT_NAME, 240, y + 72);

      /* 分隔线 */
      ctx.strokeStyle = '#cdeee7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(140, 290);
      ctx.lineTo(CARD_W - 140, 290);
      ctx.stroke();

      /* 打卡标题 */
      ctx.fillStyle = '#134e4a';
      ctx.font = '700 58px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('今日学习打卡', 140, 390);

      /* 日期 */
      ctx.fillStyle = '#5b8a85';
      ctx.font = '30px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(formatDate(now), 140, 452);

      /* 学习主题（自动换行，最多 3 行） */
      ctx.fillStyle = '#0e6b57';
      ctx.font = '600 46px "PingFang SC", "Microsoft YaHei", sans-serif';
      var lines = wrapText(ctx, topic, CARD_W - 280);
      lines.forEach(function (line, i) {
        ctx.fillText(line, 140, 570 + i * 62);
      });

      /* 激励文案 */
      ctx.fillStyle = '#134e4a';
      ctx.font = '30px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('3D 实验 + 考点导航，今天也进步了一点点。', 140, 800);

      /* 二维码占位区（占位，不伪造可扫码图案；上线前替换为真实二维码图） */
      var qrX = 140, qrY = 880, qrS = 260;
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = '#14b8a6';
      ctx.lineWidth = 3;
      roundRect(ctx, qrX, qrY, qrS, qrS, 20);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#e6faf6';
      roundRect(ctx, qrX + 6, qrY + 6, qrS - 12, qrS - 12, 16);
      ctx.fill();
      ctx.fillStyle = '#0d9488';
      ctx.font = '600 30px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('扫码打开工作台', qrX + qrS / 2, qrY + qrS / 2 - 8);
      ctx.fillStyle = '#5b8a85';
      ctx.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('二维码占位', qrX + qrS / 2, qrY + qrS / 2 + 34);
      ctx.textAlign = 'left';

      /* 占位区右侧说明 */
      ctx.fillStyle = '#134e4a';
      ctx.font = '600 32px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('把今天的进步分享给同学', 450, 950);
      ctx.fillStyle = '#5b8a85';
      ctx.font = '28px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('分子 / 晶体 3D 演示', 450, 1004);
      ctx.fillText('高考真题 · 解题 SOP · 错题本', 450, 1050);

      /* 底部域名 */
      ctx.fillStyle = '#8aa8a1';
      ctx.font = '26px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(location.origin.replace(/^https?:\/\//, ''), CARD_W / 2, CARD_H - 130);
      ctx.textAlign = 'left';

      return canvas;
    }).then(function (canvas) {
      /* 下载 PNG */
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (!blob) { reject(new Error('图片生成失败')); return; }
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = '化学打卡-' + dateStamp(new Date()) + '.png';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
          toast('打卡卡片已下载');
          track('share_checkin', { topic: topic });
          resolve(canvas);
        }, 'image/png');
      });
    }).catch(function (err) {
      toast('卡片生成失败，请重试');
      if (window.console) console.warn('[ChemShare]', err);
      throw err;
    });
  }

  /* ---------- 委托绑定：data-share 按钮 ---------- */
  function init() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-share]') : null;
      if (!el) return;
      var kind = el.getAttribute('data-share');
      if (kind === 'copy') copyLink(el.getAttribute('data-share-url') || undefined);
      else if (kind === 'checkin') makeCheckinCard();
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ChemShare = {
    copyLink: copyLink,
    makeCheckinCard: makeCheckinCard,
    getTodayTopic: getTodayTopic
  };
})();
