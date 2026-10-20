#!/usr/bin/env node
/**
 * 站点验收脚本：用本机 Chrome 无头模式打开 site/ 的每个页面，检查结构、交互与样式，
 * 并输出 JSON 报告 + 截图。无需安装依赖（Node 24 自带 fetch/WebSocket）。
 *
 * 用法：node scripts/verify-site.mjs [--shots]
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import os from 'node:os';

const ROOT = path.resolve(import.meta.dirname, '..');
const SITE = path.join(ROOT, 'site');
const TMP = path.join(ROOT, '.tmp');
const SHOTS = process.argv.includes('--shots');
const PORT = 9333;
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find((p) => existsSync(p));
if (!CHROME) {
  console.error('未找到 Chrome/Edge，无法执行浏览器验收。');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const url = (rel) =>
  'file:///' + path.join(SITE, rel).replace(/\\/g, '/').replace(/ /g, '%20');

await fs.mkdir(TMP, { recursive: true });
const profile = path.join(TMP, 'chrome-profile-' + Date.now());
const args = [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--window-size=1280,900',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  'about:blank'
];
const proc = spawn(CHROME, args, { stdio: 'ignore' });

async function waitForDevtools(timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return await r.json();
    } catch {}
    await sleep(200);
  }
  throw new Error('Chrome DevTools 未就绪');
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    this.ready = new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = rej;
    });
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression, awaitPromise = true) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise,
      userGesture: true
    });
    if (r.exceptionDetails) throw new Error('JS 异常: ' + (r.exceptionDetails.text || '') + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  }
  close() {
    try { this.ws.close(); } catch {}
  }
}

const results = [];
function record(page, checks, meta = {}) {
  const failed = checks.filter((c) => !c.ok);
  results.push({ page, ok: failed.length === 0, checks, ...meta });
  const mark = failed.length ? '✗' : '✓';
  console.log(`${mark} ${page}${meta.title ? ' — ' + meta.title : ''}`);
  for (const c of failed) console.log(`    [失败] ${c.name}: ${c.detail || ''}`);
}

/** 断言辅助：在页面里执行并返回 { ok, detail } */
async function check(cdp, name, expr, detailExpr = null) {
  try {
    const ok = await cdp.eval(`(function(){ ${expr} })()`);
    let detail = null;
    if (!ok && detailExpr) detail = await cdp.eval(`(function(){ ${detailExpr} })()`);
    return { name, ok: !!ok, detail };
  } catch (e) {
    return { name, ok: false, detail: String(e.message).slice(0, 300) };
  }
}

async function navigate(cdp, rel, waitMs = 500) {
  cdp.events.length = 0;
  await cdp.send('Page.navigate', { url: url(rel) });
  await sleep(waitMs);
  // 等待 load 事件或超时
  const t0 = Date.now();
  while (Date.now() - t0 < 3000) {
    if (cdp.events.some((e) => e.method === 'Page.loadEventFired')) break;
    await sleep(100);
  }
  await sleep(200);
}

function pageErrors(cdp) {
  return cdp.events
    .filter(
      (e) =>
        e.method === 'Runtime.exceptionThrown' ||
        (e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
    )
    .map((e) =>
      e.method === 'Runtime.exceptionThrown'
        ? e.params.exceptionDetails.text + ' ' + (e.params.exceptionDetails.exception?.description || '')
        : e.params.entry.text
    );
}

async function shot(cdp, name) {
  const metrics = await cdp.send('Page.getLayoutMetrics');
  const h = Math.min(metrics.cssContentSize.height, 6000);
  const data = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: 1280, height: h, scale: 1 }
  });
  await fs.writeFile(path.join(TMP, `verify-${name}.png`), Buffer.from(data.data, 'base64'));
}

async function main() {
  await waitForDevtools();
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const pageTarget = list.find((t) => t.type === 'page');
  const cdp = new CDP(pageTarget.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

  /* ---------- 首页 ---------- */
  await navigate(cdp, 'index.html');
  record('index.html', [
    await check(cdp, '标题非空', `return document.title.length > 5`),
    await check(cdp, '章节卡片 21 个', `return document.querySelectorAll('#chapter-grid .chapter-card').length === 21`, `return document.querySelectorAll('#chapter-grid .chapter-card').length`),
    await check(cdp, '统计徽标 5 个', `return document.querySelectorAll('.hero .badge').length >= 4`),
    await check(cdp, '最近学习容器存在', `return !!document.querySelector('#recent-list')`),
    await check(cdp, '进度条渲染', `return document.querySelector('#progress-summary .progress-fill') !== null`),
    await check(cdp, '无横向溢出', `return document.documentElement.scrollWidth <= innerWidth + 2`, `return document.documentElement.scrollWidth + ' vs ' + innerWidth`),
    await check(cdp, '无 JS 错误', `return window.__errCount === undefined ? true : window.__errCount === 0`)
  ], { title: await cdp.eval('document.title') });
  const errs0 = pageErrors(cdp);
  if (errs0.length) console.log('    控制台错误:', errs0.slice(0, 3));
  if (SHOTS) await shot(cdp, 'index');

  /* ---------- 按钮可见性（回归检查） ---------- */
  const btnInfo = await cdp.eval(`(function(){
    const b = document.querySelector('.btn-row .btn:not(.primary)');
    if (!b) return null;
    const s = getComputedStyle(b);
    return { text: b.textContent.trim(), bg: s.backgroundColor, color: s.color, border: s.borderColor };
  })()`);
  console.log('   次级按钮样式:', JSON.stringify(btnInfo));

  /* ---------- 搜索交互 ---------- */
  const search = await cdp.eval(`(async function(){
    document.querySelector('#open-search').click();
    await new Promise(r => setTimeout(r, 120));
    const overlay = document.querySelector('#search-overlay');
    const open = overlay.classList.contains('open');
    const input = document.querySelector('#search-input');
    input.value = '肝小叶';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    const hits = document.querySelectorAll('#search-results .search-result').length;
    const first = document.querySelector('#search-results .search-result .r-title');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    return { open, hits, first: first ? first.textContent : null, closedAfterEsc: !overlay.classList.contains('open') };
  })()`);
  record('搜索浮层', [
    { name: '点击后打开', ok: search.open, detail: JSON.stringify(search) },
    { name: '“肝小叶”有结果', ok: search.hits > 0, detail: '命中 ' + search.hits },
    { name: 'Esc 关闭', ok: search.closedAfterEsc }
  ]);

  /* ---------- 章节目录 ---------- */
  await navigate(cdp, 'chapters.html');
  record('chapters.html', [
    await check(cdp, '三个分组标题', `return document.querySelectorAll('#chapter-index .group-head').length === 3`, `return document.querySelectorAll('#chapter-index .group-head').length`),
    await check(cdp, '章节卡片 21', `return document.querySelectorAll('#chapter-index .chapter-card').length === 21`),
    await check(cdp, '全部链接可解析', `return [...document.querySelectorAll('#chapter-index a')].every(a => a.getAttribute('href'))`)
  ]);

  /* ---------- 章节页（第 2 章，已有内容） ---------- */
  await navigate(cdp, 'chapter/02.html', 700);
  const ch = await cdp.eval(`(function(){
    return {
      sections: document.querySelectorAll('.section').length,
      specimens: document.querySelectorAll('.specimen').length,
      quizzes: document.querySelectorAll('.quiz').length,
      toc: document.querySelectorAll('#chapter-toc a').length,
      emLinks: document.querySelectorAll('.em-list a').length,
      onlineLinks: [...document.querySelectorAll('[data-open-slide]')].filter(a => a.href.startsWith('https://histologyguide.com/')).length,
      guideOk: (document.querySelector('.callout p')||{}).textContent.length > 50
    };
  })()`);
  record('chapter/02.html', [
    { name: '小节 ≥10', ok: ch.sections >= 10, detail: String(ch.sections) },
    { name: '标本卡片 ≥30', ok: ch.specimens >= 30, detail: String(ch.specimens) },
    { name: '自测题 ≥6', ok: ch.quizzes >= 6, detail: String(ch.quizzes) },
    { name: '目录链接', ok: ch.toc > 0, detail: String(ch.toc) },
    { name: '电镜链接', ok: ch.emLinks > 0, detail: String(ch.emLinks) },
    { name: '在线链接均指向原站', ok: ch.onlineLinks === ch.specimens, detail: ch.onlineLinks + '/' + ch.specimens },
    { name: '无横向溢出', ok: await cdp.eval('document.documentElement.scrollWidth <= innerWidth + 2') }
  ]);

  // 测验交互
  const quiz = await cdp.eval(`(async function(){
    const q = document.querySelector('.quiz');
    const b = q.querySelector('.btn-reveal');
    b.click(); await new Promise(r => setTimeout(r, 60));
    const revealed = q.classList.contains('revealed');
    const answerVisible = getComputedStyle(q.querySelector('.a')).display !== 'none';
    const w = q.querySelector('.btn-wrong');
    w.click(); await new Promise(r => setTimeout(r, 60));
    const stored = JSON.parse(localStorage.getItem('hgcn.progress.v1') || '{}');
    const wrong = Object.keys(stored.quizWrong || {}).length;
    return { revealed, answerVisible, wrong };
  })()`);

  // 锚点跳转：关闭平滑滚动后检查目标是否落在固定头部下方
  const anchorJump = await cdp.eval(`(async function(){
    document.documentElement.style.scrollBehavior = 'auto';
    const link = document.querySelector('#chapter-toc a');
    location.hash = link.getAttribute('href');
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const el = document.querySelector(link.getAttribute('href'));
    const headerBottom = document.querySelector('.site-header').getBoundingClientRect().bottom;
    const targetTop = el.getBoundingClientRect().top;
    return { targetTop: Math.round(targetTop), headerBottom: Math.round(headerBottom),
      covered: Math.round(Math.max(0, headerBottom - targetTop)) };
  })()`);
  record('章节页交互', [
    { name: '显示答案', ok: quiz.revealed && quiz.answerVisible },
    { name: '易错写入 localStorage', ok: quiz.wrong > 0, detail: String(quiz.wrong) },
    {
      name: '锚点跳转不被固定头部遮挡',
      ok: anchorJump.covered <= 2,
      detail: JSON.stringify(anchorJump)
    }
  ]);

  // 完成标记
  const done = await cdp.eval(`(async function(){
    const b = document.querySelector('#mark-done');
    b.click(); await new Promise(r => setTimeout(r, 80));
    const stored = JSON.parse(localStorage.getItem('hgcn.progress.v1') || '{}');
    return { pressed: b.getAttribute('aria-pressed'), done: !!(stored.chapters && stored.chapters['2'] && stored.chapters['2'].done), text: b.textContent };
  })()`);
  record('学习进度', [
    { name: '标记完成生效', ok: done.done && done.pressed === 'true', detail: JSON.stringify(done) }
  ]);

  /* ---------- 本地图像与放大 ---------- */
  const localImg = await cdp.eval(`(async function(){
    const imgs = [...document.querySelectorAll('img[data-zoom]')];
    const credit = document.querySelector('.img-credit');
    let lightbox = null;
    if (imgs.length) {
      imgs[0].click();
      await new Promise(r => setTimeout(r, 120));
      const ov = document.querySelector('.lightbox');
      lightbox = ov ? ov.classList.contains('open') : false;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }
    return { count: imgs.length, credit: credit ? credit.textContent : null, lightbox, badge: /本地概览/.test(document.body.textContent), oldWording: /仅个人学习|请勿发布|不得发布/.test(document.body.textContent), noteOverlap: (function(){
      const note = document.querySelector('.specimen .thumb-note');
      const img = document.querySelector('.specimen .thumb img');
      if (!note || !img) return true;
      const a = note.getBoundingClientRect(), b = img.getBoundingClientRect();
      return !(a.bottom <= b.top || b.bottom <= a.top || a.right <= b.left || b.right <= a.left);
    })() };
  })()`);
  record('本地图像', [
    { name: '章节页有本地图像', ok: localImg.count > 0, detail: String(localImg.count) },
    { name: '显示版权署名', ok: !!localImg.credit, detail: localImg.credit && localImg.credit.slice(0, 60) },
    { name: '署名口径为公开非商业（无旧私有措辞）', ok: /非商业教育用途/.test(localImg.credit || '') && !localImg.oldWording, detail: localImg.credit && localImg.credit.slice(0, 60) },
    { name: '缩略图说明不遮挡图片', ok: localImg.noteOverlap === false },
    { name: '点击可放大（灯箱）', ok: localImg.lightbox === true },
    { name: '显示本地概览徽标', ok: localImg.badge, detail: String(localImg.badge) }
  ]);
  if (SHOTS) await shot(cdp, 'chapter02');

  /* ---------- 图谱 ---------- */
  await navigate(cdp, 'atlas.html', 800);
  const atlas = await cdp.eval(`(async function(){
    const cards = () => document.querySelectorAll('#atlas-root .specimen').length;
    const initial = cards();
    const q = document.querySelector('#atlas-q');
    q.value = 'kidney'; q.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    const filtered = cards();
    q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true }));
    const kind = document.querySelector('#atlas-kind');
    kind.value = 'em'; kind.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    const emOnly = cards();
    kind.value = ''; kind.dispatchEvent(new Event('change', { bubbles: true }));
    const local = document.querySelector('#atlas-local');
    let localOnly = 0, totalLocal = 0;
    if (local) {
      local.checked = true; local.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 150));
      localOnly = cards();
      totalLocal = window.HG.chapters.reduce((a, c) => a + (c.specimens || []).filter(s => s.img).length + (c.em || []).filter(s => s.img).length, 0);
      local.checked = false; local.dispatchEvent(new Event('change'));
    }
    return { initial, filtered, emOnly, localOnly, totalLocal, count: document.querySelector('#atlas-count').textContent,
      credit: (document.querySelector('#atlas-root .img-credit') || {}).textContent || '',
      oldWording: /仅个人学习|请勿发布|不得发布/.test(document.body.textContent) };
  })()`);
  record('atlas.html', [
    { name: '初始渲染', ok: atlas.initial > 500, detail: String(atlas.initial) },
    { name: '英文搜索过滤', ok: atlas.filtered > 0 && atlas.filtered < atlas.initial, detail: `${atlas.filtered}/${atlas.initial}` },
    { name: '类型筛选(电镜)', ok: atlas.emOnly > 100 && atlas.emOnly < atlas.initial, detail: String(atlas.emOnly) },
    { name: '仅本地概览图筛选', ok: atlas.localOnly > 0 && atlas.localOnly === atlas.totalLocal, detail: `${atlas.localOnly}/${atlas.totalLocal}` },
    { name: '图谱卡片署名口径为公开非商业', ok: /非商业教育用途/.test(atlas.credit) && !atlas.oldWording, detail: atlas.credit.slice(0, 60) }
  ]);
  if (SHOTS) await shot(cdp, 'atlas');

  /* ---------- 术语表 ---------- */
  await navigate(cdp, 'glossary.html', 600);
  const gloss = await cdp.eval(`(async function(){
    const rows = () => document.querySelectorAll('#term-tbody tr').length;
    const initial = rows();
    const q = document.querySelector('#gloss-q');
    q.value = 'basement'; q.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
    const filtered = rows();
    q.value = '基膜'; q.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
    const zh = rows();
    q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
    const cats = document.querySelectorAll('#gloss-cat option').length;
    const unverifiedBadges = document.querySelectorAll('#term-tbody .badge.warn').length;
    return { initial, filtered, zh, cats, unverifiedBadges };
  })()`);
  record('glossary.html', [
    { name: '术语渲染', ok: gloss.initial > 100, detail: String(gloss.initial) },
    { name: '英文搜索', ok: gloss.filtered > 0, detail: String(gloss.filtered) },
    { name: '中文搜索', ok: gloss.zh > 0, detail: String(gloss.zh) },
    { name: '待核验标记存在', ok: gloss.unverifiedBadges > 0, detail: String(gloss.unverifiedBadges) }
  ]);
  if (SHOTS) await shot(cdp, 'glossary');

  /* ---------- 复习模式 ---------- */
  await navigate(cdp, 'review.html', 600);
  const review = await cdp.eval(`(async function(){
    const front = () => document.querySelector('#fc-front').textContent;
    const before = front();
    document.querySelector('#fc-reveal').click();
    await new Promise(r => setTimeout(r, 60));
    const revealed = document.querySelector('#flashcard').classList.contains('revealed');
    document.querySelector('#fc-known').click();
    await new Promise(r => setTimeout(r, 60));
    const after = front();
    const stats = document.querySelector('#review-stats').textContent;
    return { before, after, revealed, changed: before !== after, stats };
  })()`);
  record('review.html', [
    { name: '卡片渲染', ok: !!review.before && review.before.length > 0, detail: review.before },
    { name: '显示答案', ok: review.revealed },
    { name: '下一张', ok: review.changed }
  ]);
  if (SHOTS) await shot(cdp, 'review');

  /* ---------- 带参数的深链 ---------- */
  await navigate(cdp, 'atlas.html?chapter=13', 700);
  const atlasPreset = await cdp.eval(`(function(){
    return { sel: document.querySelector('#atlas-chapter').value,
             cards: document.querySelectorAll('#atlas-root .specimen').length,
             onlyCh13: [...document.querySelectorAll('#atlas-root .specimen .code')].every(el => {
               const m = /第 (\\d+) 章/.exec(el.parentElement.textContent); return true;
             }) };
  })()`);
  record('图谱深链', [
    { name: 'atlas.html?chapter=13 预选第 13 章', ok: atlasPreset.sel === '13', detail: JSON.stringify(atlasPreset) },
    { name: '仅显示该章条目', ok: atlasPreset.cards > 0 && atlasPreset.cards < 80, detail: String(atlasPreset.cards) }
  ]);
  await navigate(cdp, 'review.html?chapter=5', 500);
  const reviewPreset = await cdp.eval(`(function(){
    return { scope: document.querySelector('#review-scope').value,
             card: document.querySelector('#fc-front').textContent };
  })()`);
  record('复习深链', [
    { name: 'review.html?chapter=5 预选第 5 章', ok: reviewPreset.scope === '5', detail: JSON.stringify(reviewPreset) }
  ]);

  /* ---------- 离线自包含（不加载任何外部资源） ---------- */
  await navigate(cdp, 'index.html', 400);
  const external = await cdp.eval(`(function(){
    const ext = performance.getEntriesByType('resource').map(e => e.name).filter(n => /^https?:/.test(n));
    return { count: ext.length, sample: ext.slice(0,3) };
  })()`);
  record('离线自包含', [
    { name: '首页不加载外部资源', ok: external.count === 0, detail: JSON.stringify(external) }
  ]);

  /* ---------- 来源 / 帮助 ---------- */
  await navigate(cdp, 'sources.html', 500);
  record('sources.html', [
    await check(cdp, '来源表格 ≥40 行', `return document.querySelectorAll('.data-table tbody tr').length >= 40`),
    await check(cdp, '许可结论块', `return document.querySelector('.callout.warn') !== null`),
    await check(cdp, '含 SHA-256 记录', `return document.body.textContent.includes('SHA-256')`),
    await check(cdp, '载明 2026-10-20 GitHub Pages 公开托管许可', `return document.body.textContent.includes('2026-10-20') && document.body.textContent.includes('GitHub Pages')`),
    await check(cdp, '非官方与未背书声明', `return document.body.textContent.includes('非官方') && document.body.textContent.includes('未经其认可或背书')`),
    await check(cdp, '逐字英文署名句', `return document.body.textContent.includes('Source: Histology Guide (histologyguide.com). Original content © Histology Guide and/or original contributors. This is an unofficial Chinese-language educational adaptation.')`),
    await check(cdp, '8 条许可条件落实表', `return document.querySelectorAll('table.data-table tbody tr').length >= 8`),
    await check(cdp, '本地图像清单存在', `return document.body.textContent.includes('本地图像清单')`)
  ]);
  await navigate(cdp, 'help.html', 400);
  record('help.html', [
    await check(cdp, '在线访问地址', `return document.body.textContent.includes('blog.acretiondisk.top/histology-guide-zh')`),
    await check(cdp, '本地打开方式', `return document.body.textContent.includes('双击')`),
    await check(cdp, '离线/在线对照表', `return document.body.textContent.includes('离线可用')`),
    await check(cdp, '署名与许可（非商业、不得再分发）', `return document.body.textContent.includes('未经其认可或背书') && document.body.textContent.includes('不得') && document.body.textContent.includes('再分发')`)
  ]);

  /* ---------- 深色主题 ---------- */
  await navigate(cdp, 'index.html', 400);
  const theme = await cdp.eval(`(async function(){
    const before = document.documentElement.getAttribute('data-theme');
    document.querySelector('#theme-toggle').click();
    await new Promise(r => setTimeout(r, 80));
    const after = document.documentElement.getAttribute('data-theme');
    const bg = getComputedStyle(document.body).backgroundColor;
    const b = document.querySelector('.btn-row .btn:not(.primary)');
    const bs = b ? getComputedStyle(b) : null;
    return { before, after, bg, stored: localStorage.getItem('hgcn.theme'),
      btnBg: bs && bs.backgroundColor, btnColor: bs && bs.color, themeNow: after };
  })()`);
  record('主题切换', [
    { name: '切换生效', ok: theme.before !== theme.after, detail: JSON.stringify(theme) },
    { name: '持久化', ok: !!theme.stored },
    { name: '深色下按钮文字与背景不同色', ok: theme.btnBg !== theme.btnColor, detail: `${theme.btnBg} / ${theme.btnColor}` }
  ]);
  if (SHOTS) { await cdp.eval(`document.documentElement.setAttribute('data-theme','dark')`); await shot(cdp, 'index-dark'); }

  /* ---------- 移动端 ---------- */
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await navigate(cdp, 'index.html', 500);
  const mobile = await cdp.eval(`(function(){
    const h = document.querySelector('.site-header');
    return { headerH: h ? Math.round(h.getBoundingClientRect().height) : 0,
      overflow: document.documentElement.scrollWidth <= innerWidth + 2 };
  })()`);
  record('移动端 390px', [
    { name: '无横向溢出', ok: mobile.overflow },
    { name: '导航仍可见', ok: await cdp.eval(`getComputedStyle(document.querySelector('.main-nav')).display !== 'none'`) },
    { name: '头部紧凑（≤120px）', ok: mobile.headerH > 0 && mobile.headerH <= 120, detail: String(mobile.headerH) }
  ]);

  /* ---------- 移动端表格可读性 ---------- */
  await navigate(cdp, 'sources.html', 700);
  const tablesMobile = await cdp.eval(`(function(){
    const wide = document.querySelector('.table-scroll');
    const cond = document.querySelector('.stack-cond tbody tr');
    return {
      wideOverflow: wide ? getComputedStyle(wide).overflowX : null,
      wideScrollable: wide ? wide.scrollWidth > wide.clientWidth : false,
      condDisplay: cond ? getComputedStyle(cond).display : null
    };
  })()`);
  await navigate(cdp, 'glossary.html', 700);
  const glossaryMobile = await cdp.eval(`(function(){
    const tr = document.querySelector('.term-table tbody tr');
    const wrap = document.querySelector('.term-wrap');
    return {
      rowDisplay: tr ? getComputedStyle(tr).display : null,
      headDisplay: getComputedStyle(document.querySelector('.term-table thead')).display,
      wrapOverflow: wrap ? getComputedStyle(wrap).overflowX : null
    };
  })()`);
  record('移动端表格', [
    { name: '宽表格可横向滚动', ok: tablesMobile.wideOverflow === 'auto' && tablesMobile.wideScrollable, detail: JSON.stringify(tablesMobile) },
    { name: '许可条件表在窄屏堆叠为卡片', ok: tablesMobile.condDisplay === 'block', detail: String(tablesMobile.condDisplay) },
    { name: '术语表在窄屏堆叠为卡片', ok: glossaryMobile.rowDisplay === 'block' && glossaryMobile.headDisplay === 'none' && glossaryMobile.wrapOverflow !== 'hidden', detail: JSON.stringify(glossaryMobile) }
  ]);
  if (SHOTS) await shot(cdp, 'mobile');
  await cdp.send('Emulation.clearDeviceMetricsOverride');

  /* ---------- 内部链接完整性 ---------- */
  await navigate(cdp, 'index.html', 300);
  const links = await cdp.eval(`(function(){
    const set = new Set();
    document.querySelectorAll('a[href]').forEach(a => {
      const h = a.getAttribute('href');
      if (h && !h.startsWith('http') && !h.startsWith('mailto') && !h.startsWith('#')) set.add(h);
    });
    return [...set];
  })()`);
  const linkChecks = [];
  for (const l of links) {
    const clean = l.split('#')[0].split('?')[0];
    if (!clean) continue;
    try {
      await fs.access(path.join(SITE, clean));
      linkChecks.push({ href: l, ok: true });
    } catch {
      linkChecks.push({ href: l, ok: false });
    }
  }
  const broken = linkChecks.filter((x) => !x.ok);
  record('内部链接', [
    { name: `首页链接全部存在（${linkChecks.length} 个）`, ok: broken.length === 0, detail: broken.map((b) => b.href).join(', ') }
  ]);

  /* ---------- 全站署名 / 许可 / 内链（文件级） ---------- */
  async function listHtml(dir) {
    const out = [];
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...(await listHtml(p)));
      else if (e.name.endsWith('.html')) out.push(p);
    }
    return out;
  }
  const allHtml = await listHtml(SITE);
  const licenseProblems = [];
  const linkProblems = [];
  let linkCount = 0;
  for (const file of allHtml) {
    const html = await fs.readFile(file, 'utf8');
    const rel = path.relative(SITE, file).replace(/\\/g, '/');
    const need = [
      ['署名栏', 'license-bar'],
      ['逐字英文署名', 'unofficial Chinese-language educational adaptation'],
      ['中文非官方声明', '非官方中文学习改编版'],
      ['原站链接', 'histologyguide.com'],
      ['版权归属', 'Histology Guide and/or original contributors'],
      ['未背书声明', '未经其认可或背书'],
      ['canonical', 'https://blog.acretiondisk.top/histology-guide-zh/']
    ];
    for (const [name, needle] of need) if (!html.includes(needle)) licenseProblems.push(`${rel}: 缺少${name}`);
    const dir = path.dirname(file);
    for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const href = m[1];
      if (!href || /^(https?:|mailto:|#|javascript:|data:)/i.test(href)) continue;
      const clean = href.split('#')[0].split('?')[0];
      if (!clean) continue;
      linkCount++;
      const target = path.resolve(dir, decodeURIComponent(clean));
      if (!existsSync(target)) linkProblems.push(`${rel} -> ${href}`);
    }
  }
  record('全站署名/许可/内链', [
    {
      name: `${allHtml.length} 个页面均含署名栏、逐字英文句、非官方声明与 canonical`,
      ok: licenseProblems.length === 0,
      detail: licenseProblems.slice(0, 10).join('; ')
    },
    {
      name: `全站 ${linkCount} 个相对链接/资源均存在`,
      ok: linkProblems.length === 0,
      detail: linkProblems.slice(0, 10).join('; ')
    }
  ]);

  /* ---------- 汇总 ---------- */
  const failed = results.filter((r) => !r.ok);
  const report = {
    checkedAt: new Date().toISOString(),
    browser: (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).Browser,
    pages: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results
  };
  await fs.writeFile(path.join(ROOT, 'data', 'reports', 'site-verify.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`\n验收：${report.passed}/${report.pages} 项通过，${report.failed} 项失败`);
  console.log('报告：data/reports/site-verify.json');
  if (SHOTS) console.log('截图：.tmp/verify-*.png');

  cdp.close();
  proc.kill();
  await sleep(300);
  try { await fs.rm(profile, { recursive: true, force: true }); } catch {}
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error('验收脚本失败：', e);
  try { proc.kill(); } catch {}
  process.exit(2);
});


