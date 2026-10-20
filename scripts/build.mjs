#!/usr/bin/env node
/**
 * 静态站点生成器：把 data/inventory.json + content/zh/* 生成 site/ 下的静态页面。
 * 页面不依赖任何服务器接口，可直接双击打开（数据内嵌在 assets/data.js）。
 *
 * 用法：node scripts/build.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SITE = path.join(ROOT, 'site');
const ZH = path.join(ROOT, 'content', 'zh');

/* ---------- 许可与公开托管（2026-10-20 作者书面许可） ---------- */
const HG_HOME = 'https://histologyguide.com';
const SITE_URL = 'https://blog.acretiondisk.top/histology-guide-zh/';
const ATTRIBUTION_EN =
  'Source: Histology Guide (histologyguide.com). Original content © Histology Guide and/or original contributors. This is an unofficial Chinese-language educational adaptation.';
const ATTRIBUTION_EN_HTML = `Source: <a href="${HG_HOME}/" target="_blank" rel="noopener noreferrer">Histology Guide</a> (histologyguide.com). Original content © Histology Guide and/or original contributors. This is an unofficial Chinese-language educational adaptation.`;
const UNOFFICIAL_ZH =
  '本站是 Histology Guide 的非官方中文学习改编版，与 Histology Guide 无隶属关系，未经其认可或背书。';
const PERMISSION_ZH =
  '本站按作者 2026-10-20 书面许可公开托管于 GitHub Pages，仅限非商业教育用途并免费访问；不得出售、许可或其他商业利用，不得在本站之外再分发本站保存的原始材料。';

const inventory = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'inventory.json'), 'utf8'));
const SOURCES = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'sources.json'), 'utf8'));

/* ---------- 中文兜底（内容未写完时站点仍可用） ---------- */
const DEFAULT_ZH = {
  1: '细胞', 2: '上皮组织', 3: '结缔组织', 4: '肌组织', 5: '软骨与骨', 6: '神经组织',
  7: '血液', 8: '血细胞发生', 9: '循环系统', 10: '淋巴系统', 11: '皮肤', 12: '外分泌腺',
  13: '内分泌腺', 14: '消化管', 15: '肝与胆囊', 16: '泌尿系统', 17: '呼吸系统',
  18: '女性生殖系统', 19: '男性生殖系统', 20: '感觉器官', 21: '组织鉴别练习'
};

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const pad2 = (n) => String(n).padStart(2, '0');

async function readJsonOr(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/* ---------- 合并内容 ---------- */
const termDoc = await readJsonOr(path.join(ZH, 'terms.json'), { terms: [] });
const terms = Array.isArray(termDoc.terms) ? termDoc.terms : [];

/* ---------- 经许可保存的本地概览图（默认无；由 scripts/fetch-images.mjs 生成） ---------- */
const localImages = await readJsonOr(path.join(ROOT, 'data', 'local-images.json'), { slides: {} });
const imgBySlug = localImages.slides || {};
const localImageList = Object.entries(imgBySlug)
  .filter(([, v]) => v && v.file)
  .map(([slug, v]) => ({ slug, ...v }))
  .sort((a, b) => (a.chapter || 99) - (b.chapter || 99) || String(a.specimen).localeCompare(String(b.specimen)));
const slugOf = (href) => {
  const m = /^\/(?:slideview|EM-view|figureview)\/([^/]+)\//.exec(href || '');
  return m ? m[1] : null;
};
const imgFor = (href) => {
  const s = slugOf(href);
  return s && imgBySlug[s] ? imgBySlug[s] : null;
};

const chapters = [];
for (const inv of inventory.chapters) {
  const content = await readJsonOr(path.join(ZH, 'chapters', `${pad2(inv.n)}.json`), null);
  const sectionMap = new Map();
  let covered = 0;
  const sections = inv.sections.map((s, i) => {
    const authored = content && Array.isArray(content.sections) ? content.sections.find((x) => x.en === s.en) : null;
    const out = {
      en: s.en,
      id: s.id || `sec-${i + 1}`,
      zh: (authored && authored.zh) || s.en,
      authored: !!(authored && authored.notes && authored.notes.length),
      notes: (authored && authored.notes) || [],
      identify: (authored && authored.identify) || null,
      pitfall: (authored && authored.pitfall) || ''
    };
    if (out.authored) covered++;
    sectionMap.set(s.en, out);
    return out;
  });

  const specimenZh = (content && content.specimenZh) || {};
  const specimens = inv.specimens.map((sp) => {
    const im = imgFor(sp.href);
    return {
      name: sp.name,
      kind: sp.kind,
      caption: sp.caption,
      stain: sp.stain,
      section: sp.section,
      url: sp.href,
      img: im ? im.file : null,
      imgW: im ? im.w : null,
      imgH: im ? im.h : null,
      zh: (specimenZh[sp.name] && specimenZh[sp.name].zh) || '',
      note: (specimenZh[sp.name] && specimenZh[sp.name].note) || ''
    };
  });
  const named = specimens.filter((s) => s.zh).length;
  const em = (inv.emItems || []).map((x) => {
    const im = imgFor(x.href);
    return {
      name: x.name,
      caption: x.caption,
      technique: x.technique,
      section: x.section,
      url: x.href,
      img: im ? im.file : null,
      imgW: im ? im.w : null,
      imgH: im ? im.h : null,
      zh: (specimenZh[x.name] && specimenZh[x.name].zh) || ''
    };
  });

  const authoredCount = sections.filter((s) => s.authored).length;
  const contentStatus = !content
    ? 'pending'
    : sections.length === 0
      ? (content.quiz && content.quiz.length >= 6 && content.guide ? 'authored' : 'pending')
      : authoredCount === sections.length
        ? 'authored'
        : authoredCount > 0
          ? 'partial'
          : 'pending';

  chapters.push({
    n: inv.n,
    slug: inv.slug,
    group: inv.group,
    titleEn: inv.titleEn,
    titleZh: (content && content.titleZh) || DEFAULT_ZH[inv.n] || inv.titleEn,
    guide: (content && content.guide) || '',
    examFocus: (content && content.examFocus) || [],
    confusions: (content && content.confusions) || [],
    unverified: (content && content.unverified) || [],
    url: inv.slideboxUrl,
    emUrl: inv.emUrl,
    sections,
    specimens,
    em,
    quiz: (content && content.quiz) || [],
    terms: (content && content.terms) || [],
    contentStatus,
    coverage: {
      sections: sections.length,
      covered: authoredCount,
      specimens: specimens.filter((s) => s.kind === 'slide').length,
      named,
      local: specimens.filter((s) => s.img).length,
      em: em.length,
      quiz: (content && content.quiz && content.quiz.length) || 0
    }
  });
}

const totals = {
  chapters: chapters.length,
  sections: chapters.reduce((a, c) => a + c.coverage.sections, 0),
  coveredSections: chapters.reduce((a, c) => a + c.coverage.covered, 0),
  slides: chapters.reduce((a, c) => a + c.coverage.specimens, 0),
  emPhotos: chapters.reduce((a, c) => a + c.em.length, 0),
  terms: terms.length,
  quizzes: chapters.reduce((a, c) => a + c.quiz.length, 0),
  authoredChapters: chapters.filter((c) => c.contentStatus === 'authored').length
};

/* ---------- 来源清单 ---------- */
const sourcesList = [
  { kind: '入口页', name: '首页 Home', url: 'https://histologyguide.com/', status: '仅链接' },
  { kind: '入口页', name: 'Slide Box 章节索引', url: 'https://histologyguide.com/slidebox/slidebox.html', status: '仅链接' },
  { kind: '入口页', name: 'Gallery 图库索引', url: 'https://histologyguide.com/gallery/gallery.html', status: '仅链接' },
  { kind: '入口页', name: 'Electron Microscopy 索引', url: 'https://histologyguide.com/EM-atlas/EM-atlas.html', status: '仅链接' },
  { kind: '入口页', name: 'Quiz 索引', url: 'https://histologyguide.com/quizzes/quizzes.html', status: '仅链接' },
  { kind: '入口页', name: 'Keyword Index A–Z', url: 'https://histologyguide.com/index/index-A.html', status: '仅链接' },
  { kind: '入口页', name: 'Search', url: 'https://histologyguide.com/search.html', status: '仅链接' },
  { kind: '许可', name: 'Terms of Use', url: 'https://histologyguide.com/about-us/license.html', status: '已阅读' },
  { kind: 'robots', name: 'robots.txt', url: 'https://histologyguide.com/robots.txt', status: '已检查' }
];
for (const c of inventory.chapters) {
  sourcesList.push({
    kind: '章节页',
    name: `Chapter ${c.n} - ${c.titleEn}`,
    url: c.slideboxUrl,
    status: '已采集元数据',
    fetchedAt: c.slideboxFetchedAt,
    httpStatus: c.slideboxHttpStatus,
    sha256: c.slideboxSha256,
    items: c.specimens.length
  });
  if (c.emUrl) {
    sourcesList.push({
      kind: '电镜页',
      name: `EM Chapter ${c.n} - ${c.titleEn}`,
      url: c.emUrl,
      status: c.emItems.length ? '已采集元数据' : '原站无内容',
      fetchedAt: c.emFetchedAt,
      httpStatus: c.emHttpStatus,
      sha256: c.emSha256,
      items: c.emItems.length
    });
  }
}

/* ---------- 生成 assets/data.js ---------- */
const data = {
  generatedAt: new Date().toISOString(),
  sourceSite: SOURCES.site,
  license:
    '本站为 Histology Guide 的非官方中文学习改编版，与 Histology Guide 无隶属关系、未经其认可或背书。原始内容版权归 Histology Guide 及/或原始贡献者所有。经作者 2026-10-20 书面许可，本站公开托管于 GitHub Pages，仅限非商业教育用途并免费访问；不得出售、许可或其他商业利用，不得在本站之外再分发本站保存的原始材料。中文要点、术语与自测题为自编。',
  attribution: ATTRIBUTION_EN,
  permissionDate: '2026-10-20',
  siteUrl: SITE_URL,
  totals,
  chapters,
  terms,
  sources: sourcesList
};
await fs.mkdir(path.join(SITE, 'assets'), { recursive: true });
await fs.writeFile(
  path.join(SITE, 'assets', 'data.js'),
  '/* 由 scripts/build.mjs 生成，请勿手工编辑 */\nwindow.HG = ' + JSON.stringify(data) + ';\n',
  'utf8'
);

/* ---------- HTML 组件 ---------- */
const NAV = [
  ['index.html', '首页'],
  ['chapters.html', '章节目录'],
  ['atlas.html', '组织学图谱'],
  ['glossary.html', '术语表'],
  ['review.html', '复习模式'],
  ['sources.html', '来源与许可']
];

function shell({ base = '', title, description, active = '', body, pageClass = '', pagePath = 'index.html' }) {
  const nav = NAV.map(
    ([href, label]) =>
      `<a href="${base}${href}"${active === href ? ' aria-current="page"' : ''}>${label}</a>`
  ).join('');
  return `<!doctype html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE_URL}${pagePath}">
<meta name="theme-color" content="#f7f6f3">
<link rel="stylesheet" href="${base}assets/app.css">
</head>
<body>
<a class="skip-link" href="#main">跳到正文</a>
<div class="license-bar" role="note" aria-label="非官方声明与内容来源署名">
  <div class="license-bar-inner">
    <p class="license-bar-zh"><strong>非官方中文学习改编版</strong> · 与 Histology Guide 无隶属关系，未经其认可或背书 · 仅限非商业教育用途</p>
    <p class="license-bar-en">${ATTRIBUTION_EN_HTML}</p>
    <a class="license-bar-more" href="${base}sources.html">署名与许可条件 →</a>
  </div>
</div>
<header class="site-header">
  <div class="header-inner">
    <a class="brand" href="${base}index.html"><span class="logo-dot"></span>组织学复习<span style="font-weight:400;color:var(--text-faint)">·</span><small>Histology Guide 中文学习层</small></a>
    <nav class="main-nav" aria-label="主导航">${nav}</nav>
    <div class="header-tools">
      <button class="icon-btn search-btn" id="open-search" type="button" aria-label="打开搜索">搜索 <kbd>/</kbd></button>
      <button class="icon-btn" id="theme-toggle" type="button" aria-label="切换主题">☾</button>
    </div>
  </div>
</header>
<main id="main" class="page ${pageClass}">
${body}
</main>
<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-main">
      <p><strong>非官方中文学习改编版</strong>：${UNOFFICIAL_ZH} ${ATTRIBUTION_EN}</p>
      <p>${PERMISSION_ZH}中文要点、术语与自测题为自编；每张本地图像均保留 © 署名与原页面链接，且不改变原图内容与水印。</p>
    </div>
    <div class="footer-links"><a href="${base}sources.html">署名与许可条件</a> · <a href="${base}help.html">使用说明</a> · <a href="${HG_HOME}/" target="_blank" rel="noopener noreferrer">原站 Histology Guide ↗</a></div>
  </div>
</footer>
<div class="search-overlay" id="search-overlay" role="dialog" aria-modal="true" aria-label="站内搜索">
  <div class="search-panel">
    <div class="search-row">
      <span aria-hidden="true" style="color:var(--text-faint)">⌕</span>
      <input id="search-input" type="search" placeholder="搜索章节、小节、标本编号或中英术语…" aria-label="站内搜索" autocomplete="off">
      <button class="btn small ghost" type="button" id="search-close" aria-label="关闭搜索">Esc</button>
    </div>
    <div class="search-results" id="search-results" role="listbox" aria-label="搜索结果"></div>
  </div>
</div>
<script>window.HG_BASE='${base}';</script>
<script src="${base}assets/data.js"></script>
<script src="${base}assets/app.js"></script>
</body>
</html>
`;
}

function breadcrumb(base, items) {
  return `<div class="breadcrumb">${items
    .map(([href, label], i) =>
      i === items.length - 1 ? `<span aria-current="page">${esc(label)}</span>` : `<a href="${base}${href}">${esc(label)}</a><span>/</span>`
    )
    .join('')}</div>`;
}

function specimenCard(sp, base = '../') {
  const code = (String(sp.name).match(/^(MH[S]?|EM|LA|Fig)\s*[-\w]*/i) || [sp.name])[0];
  const isEm = sp.kind === 'em';
  const link = SOURCES.site + sp.url;
  const hasImg = !!sp.img;
  const dims = sp.imgW && sp.imgH ? `${sp.imgW}×${sp.imgH}` : '';
  return `<article class="specimen" data-specimen="${esc(sp.name)}">
    <div class="thumb">${
      hasImg
        ? `<img src="${esc(base + sp.img)}" alt="${esc(sp.zh || sp.name)}（本地概览图，© Histology Guide 及/或原始贡献者，经许可）" loading="lazy" data-zoom="${esc(base + sp.img)}">`
        : esc(code)
    }<div class="thumb-note">${hasImg ? '点击图片放大 · 本地概览' : `${isEm ? '电镜' : '显微'}图像仅在线查看`}</div></div>
    <div class="body">
      <div class="code">${esc(sp.name)}</div>
      ${sp.zh ? `<div class="name-zh">${esc(sp.zh)}</div>` : '<div class="name-zh faint" style="font-weight:400">（中文名待编写）</div>'}
      ${sp.caption ? `<div class="caption">${esc(sp.caption)}</div>` : ''}
      <div class="tags">
        ${(sp.stain || sp.technique) ? `<span class="badge accent">${esc(sp.stain || sp.technique)}</span>` : ''}
        <span class="badge${hasImg ? ' ok' : ' online'}">${hasImg ? '本地概览' : '在线'}</span>
        ${hasImg && dims ? `<span class="badge">${dims}</span>` : ''}
      </div>
      ${hasImg ? `<div class="img-credit">图像 © Histology Guide 及/或原始贡献者 · 非商业教育用途，经许可保存；原页面链接见下方</div>` : ''}
      <div class="actions">
        <a class="btn small" data-open-slide="${esc(sp.name)}" href="${esc(link)}" target="_blank" rel="noopener noreferrer" aria-label="在新标签页打开原站切片 ${esc(sp.name)}">原站切片 ↗</a>
      </div>
    </div>
  </article>`;
}

function emList(items) {
  if (!items.length) return '';
  return `<details class="em-block">
    <summary>电镜照片 ${items.length} 张（在线查看）</summary>
    <ul class="em-list">${items
      .map(
        (x) =>
          `<li><a href="${esc(SOURCES.site + x.url)}" target="_blank" rel="noopener noreferrer">${esc(
            x.zh || x.name
          )}</a> <span class="faint small">${esc(x.name)}${x.caption ? ' · ' + esc(x.caption) : ''}${
            x.technique ? ' · ' + esc(x.technique) : ''
          }</span></li>`
      )
      .join('')}</ul>
  </details>`;
}

function figList(items) {
  if (!items.length) return '';
  return `<details class="em-block fig-block">
    <summary>示意图 ${items.length} 幅（在线查看）</summary>
    <ul class="fig-list">${items
      .map(
        (x) =>
          `<li><a href="${esc(SOURCES.site + x.url)}" target="_blank" rel="noopener noreferrer">${esc(
            x.name
          )}</a> <span class="faint small">${esc(x.caption || '')}</span></li>`
      )
      .join('')}</ul>
  </details>`;
}

/* ---------- 章节页 ---------- */
async function buildChapterPage(c) {
  const base = '../';
  const sections = c.sections;
  const bySection = new Map();
  for (const sp of c.specimens) {
    const key = sp.section || '__none__';
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key).push(sp);
  }
  const emBySection = new Map();
  for (const x of c.em) {
    const key = x.section || '__none__';
    if (!emBySection.has(key)) emBySection.set(key, []);
    emBySection.get(key).push(x);
  }

  const toc = sections.length
    ? `<nav class="toc" id="chapter-toc" aria-label="本章小节"><h2>本章小节</h2><ol>${sections
        .map((s) => `<li><a href="#${esc(s.id)}">${esc(s.zh)} <span class="faint small">${esc(s.en)}</span></a></li>`)
        .join('')}</ol></nav>`
    : '';

  const sectionsHtml = sections
    .map((s) => {
      const sps = bySection.get(s.en) || [];
      const ems = emBySection.get(s.en) || [];
      const named = sps.filter((x) => x.kind === 'slide');
      const figs = sps.filter((x) => x.kind === 'figure');
      return `<section class="section" id="${esc(s.id)}">
        <div class="section-head"><h2>${esc(s.zh)}</h2><span class="en">${esc(s.en)}</span>
          ${s.authored ? '' : '<span class="badge draft">中文要点编写中</span>'}</div>
        ${s.notes.length ? `<ul class="notes">${s.notes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${s.identify ? `<div class="identify">
          <div><b>低倍镜</b>${esc(s.identify.low || '')}</div>
          <div><b>高倍镜</b>${esc(s.identify.high || '')}</div>
        </div>` : ''}
        ${s.pitfall ? `<p class="pitfall"><strong>易混提示：</strong>${esc(s.pitfall)}</p>` : ''}
        ${named.length ? `<h3>相关标本 · ${named.length}</h3><div class="specimen-grid">${named.map((s) => specimenCard(s, base)).join('')}</div>` : ''}
        ${figList(figs)}
        ${emList(ems)}
      </section>`;
    })
    .join('');

  // 未归属小节的标本（按对象身份去重，避免同名条目被误删）
  const usedSpecimens = new Set();
  for (const s of sections) for (const x of bySection.get(s.en) || []) usedSpecimens.add(x);
  const leftovers = c.specimens.filter((x) => !usedSpecimens.has(x));
  const leftoverHtml = leftovers.length
    ? `<section class="section" id="sec-other"><div class="section-head"><h2>本章其他图谱</h2></div>
      <div class="specimen-grid">${leftovers.map((s) => specimenCard(s, base)).join('')}</div></section>`
    : '';

  // 未归属小节的电镜照片（电镜页的小节标题与光镜页不一定对应，必须保证不丢失）
  const usedEmItems = new Set();
  for (const s of sections) for (const x of emBySection.get(s.en) || []) usedEmItems.add(x);
  const emLeft = c.em.filter((x) => !usedEmItems.has(x));
  const emLeftHtml = emLeft.length
    ? `<section class="section" id="sec-em"><div class="section-head"><h2>本章电镜照片</h2><span class="en">${emLeft.length} 张 · 需在线查看</span></div>
      ${emList(emLeft)}</section>`
    : '';

  const quizHtml = c.quiz.length
    ? `<section class="section" id="quiz"><div class="section-head"><h2>自测</h2><span class="en">${c.quiz.length} 题 · 自编</span></div>
      <p class="muted small">先自己回答，再点“显示答案”。标记为易错的项目会进入复习模式。</p>
      <div class="quiz-list">${c.quiz
        .map(
          (q) => `<div class="quiz">
            <p class="q">${esc(q.q)}</p>
            <div class="quiz-actions">
              <button class="btn small btn-reveal" type="button" aria-expanded="false">显示答案</button>
              <button class="btn small ghost btn-wrong" type="button" aria-pressed="false">加入易错</button>
              <span class="badge">${esc(q.tag || '')}</span>
            </div>
            <div class="a">${esc(q.a)}</div>
          </div>`
        )
        .join('')}</div></section>`
    : `<section class="section" id="quiz"><div class="section-head"><h2>自测</h2><span class="en">编写中</span></div>
      <p class="muted">本章自测题尚未编写。你可以先到原站 <a href="${esc(SOURCES.site)}/quizzes/quizzes.html" target="_blank" rel="noopener noreferrer">Quiz 页面</a>（第 1–8、21 章有）在线练习。</p></section>`;

  const guideHtml = c.guide
    ? `<div class="callout"><h3>本章导语</h3><p style="margin:0">${esc(c.guide)}</p></div>`
    : `<div class="callout warn"><h3>本章导语</h3><p style="margin:0">中文导语尚未编写。当前展示的是原站小节标题与标本编号，图像与英文说明请通过每条标本的“在线查看切片”进入原站。</p></div>`;

  const focusHtml = c.examFocus.length
    ? `<div class="callout" style="margin-top:14px"><h3>复习重点</h3><ul>${c.examFocus.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`
    : '';

  const confHtml = c.confusions.length
    ? `<div class="callout warn" style="margin-top:14px"><h3>易混淆对比</h3><ul>${c.confusions
        .map((x) => `<li><strong>${esc(x.a)}</strong> vs <strong>${esc(x.b)}</strong>：${esc(x.how)}</li>`)
        .join('')}</ul></div>`
    : '';

  const unverifiedHtml = c.unverified.length
    ? `<p class="small faint">待核验译名：${c.unverified.map((x) => esc(x)).join('；')}</p>`
    : '';

  const body = `${breadcrumb(base, [['chapters.html', '章节目录'], [`chapter/${pad2(c.n)}.html`, `第 ${c.n} 章`]])}
    <div class="chapter-head">
      <p class="eyebrow">Chapter ${pad2(c.n)} · ${esc(c.group === 'cells-tissues' ? '细胞与基本组织' : c.group === 'organ-systems' ? '器官系统' : '鉴别练习')}</p>
      <h1>${esc(c.titleZh)}</h1>
      <div class="sub">${esc(c.titleEn)} · ${c.coverage.sections} 小节 · ${c.coverage.specimens} 张切片 · ${c.coverage.em} 张电镜${c.coverage.local ? ` · <span class="badge ok" style="vertical-align:1px">本地概览 ${c.coverage.local} 张</span>` : ''}</div>
      <div class="toolbar">
        <button class="btn" id="mark-done" type="button" aria-pressed="false">标记本章完成</button>
        <a class="btn ghost" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">原站本章 ↗</a>
        ${c.emUrl && c.coverage.em ? `<a class="btn ghost" href="${esc(c.emUrl)}" target="_blank" rel="noopener noreferrer">原站电镜页 ↗</a>` : ''}
        <a class="btn ghost" href="${base}atlas.html?chapter=${c.n}">本章图谱</a>
        <a class="btn ghost" href="${base}review.html?chapter=${c.n}">本章复习</a>
      </div>
    </div>
    <div id="chapter-content" data-chapter="${c.n}">
      ${guideHtml}
      ${focusHtml}
      ${confHtml}
      ${unverifiedHtml}
      ${toc}
      <div class="notice small" style="margin:20px 0">
        <strong>阅读提示：</strong>本页中文要点为自编复习笔记，<strong>不是原站正文的翻译</strong>；标本图像为经作者书面许可保存的中分辨率概览，每张卡片保留 © 署名与原页面链接，“原站本章/原站切片”可查看高倍与结构标注。本站为 Histology Guide 的非官方中文学习改编版，未经其认可或背书。
      </div>
      ${sectionsHtml}
      ${leftoverHtml}
      ${emLeftHtml}
      ${quizHtml}
    </div>`;

  return shell({
    base,
    title: `${c.titleZh}（${c.titleEn}）· 第 ${c.n} 章 · 组织学复习`,
    description: `${c.titleZh}（${c.titleEn}）中文复习要点、标本索引与自测；图像为经许可的中分辨率概览，并保留原站页面链接。`,
    active: '',
    pageClass: 'narrow',
    pagePath: `chapter/${pad2(c.n)}.html`,
    body
  });
}

/* ---------- 首页 ---------- */
function buildIndexPage() {
  const t = totals;
  const body = `<section class="hero">
    <p class="eyebrow">Histology Guide · 非官方中文学习改编版</p>
    <h1>组织学显微镜复习站</h1>
    <p class="lede">以 Histology Guide 的章节体系与标本编号为索引，提供中文术语、复习要点、标本对照与自测。${localImageList.length} 张所选切片/示意图按作者书面许可保存为中分辨率概览并公开托管于本站，可直接放大；其余图像、完整分辨率与结构标注通过每张卡片的“原站切片”链接在线查看。</p>
    <p class="small muted" style="margin-top:12px;max-width:78ch">${UNOFFICIAL_ZH}原始图像与文字的版权归 Histology Guide 及/或原始贡献者所有，本站不以公有领域材料对待；仅限非商业教育用途并免费访问，不提供出售、许可或其他商业利用。详见 <a href="sources.html">署名与许可条件</a>。</p>
    <div class="meta">
      <span class="badge accent">21 章</span>
      <span class="badge">${t.sections} 个小节</span>
      <span class="badge">${t.slides} 张光镜切片索引</span>
      <span class="badge">${t.emPhotos} 张电镜照片索引</span>
      <span class="badge">${t.terms} 条术语</span>
      ${localImageList.length ? `<span class="badge ok">${localImageList.length} 张本地概览图</span>` : ''}
    </div>
  </section>

  <div class="grid cols-2" style="align-items:start">
    <div class="card">
      <h2 style="font-size:16px">学习进度</h2>
      <div id="progress-summary" class="muted"></div>
      <h2 style="font-size:16px;margin-top:20px">最近学习</h2>
      <div id="recent-list"></div>
      <div class="btn-row" style="margin-top:16px">
        <a class="btn primary" href="chapters.html">开始复习</a>
        <a class="btn" href="review.html">抽认卡片</a>
      </div>
    </div>
    <div class="card">
      <h2 style="font-size:16px">怎么用</h2>
      <ol class="small" style="padding-left:20px;margin:0;color:var(--text-dim)">
        <li>先读章节页的中文要点，建立结构—功能对应。</li>
        <li>点开标本卡片，在原站虚拟显微镜里按“低倍→高倍”顺序观察。</li>
        <li>回到本页用自测与复习模式检验，标记易错项。</li>
        <li>进度与易错本保存在本机浏览器（localStorage），不上传。</li>
      </ol>
      <hr class="sep">
      <p class="small faint" style="margin:0">离线可用：章节索引、术语表、自测、进度。<br>需要网络：原站图像与虚拟显微镜。详见 <a href="help.html">使用说明</a>。</p>
    </div>
  </div>

  <div id="chapter-grid" style="margin-top:34px"></div>`;

  return shell({
    title: '组织学显微镜复习站 · Histology Guide 非官方中文学习改编版',
    description: 'Histology Guide 非官方中文学习改编站：章节导航、术语表、标本索引、自测与学习进度；仅限非商业教育用途。',
    active: 'index.html',
    pagePath: 'index.html',
    body
  });
}

/* ---------- 章节目录 ---------- */
function buildChapterIndexPage() {
  const body = `${breadcrumb('', [['index.html', '首页'], ['chapters.html', '章节目录']])}
    <h1 style="font-family:var(--serif)">章节目录</h1>
    <p class="muted">按“细胞与基本组织 → 器官系统 → 鉴别练习”顺序组织。进度条表示该章中文要点已覆盖的小节比例。</p>
    <div class="toolbar">
      <input class="input" id="chapter-filter" type="search" placeholder="筛选章节（中文或英文）" aria-label="筛选章节">
      <span class="spacer"></span>
      <a class="btn ghost" href="atlas.html">浏览全部标本</a>
    </div>
    <div id="chapter-index"></div>`;
  return shell({
    title: '章节目录 · 组织学复习',
    description: '21 章组织学内容目录：细胞与基本组织、器官系统、组织鉴别练习。',
    active: 'chapters.html',
    pagePath: 'chapters.html',
    body
  });
}

/* ---------- 图谱页 ---------- */
function buildAtlasPage() {
  const body = `${breadcrumb('', [['index.html', '首页'], ['atlas.html', '组织学图谱']])}
    <h1 style="font-family:var(--serif)">组织学图谱索引</h1>
    <p class="muted" style="max-width:72ch">共 ${totals.slides} 张光镜切片与 ${totals.emPhotos} 张电镜照片的索引。其中 <strong>${localImageList.length} 张</strong>已按作者书面许可保存为中分辨率概览并公开托管于本站，可直接放大查看；其余在线查看。</p>
    <div class="callout warn small" style="margin:16px 0">
      <strong>关于图像与署名：</strong>显微图像 © Histology Guide 及/或原始贡献者，经作者 2026-10-20 书面许可在本站（GitHub Pages）公开托管，<strong>仅限非商业教育用途并免费访问</strong>；不得出售、许可或其他商业利用，不得在本站之外再分发。<strong>每张卡片保留 © 署名与原页面链接</strong>；本站为 Histology Guide 的非官方中文学习改编版，未经其认可或背书。本地图为中分辨率概览（非完整切片），高倍与结构标注请点“原站切片”在线查看。详见 <a href="sources.html">署名与许可条件</a>。
    </div>
    <div class="toolbar">
      <input class="input" id="atlas-q" type="search" placeholder="搜索中文名 / 英文名 / 编号 / 染色" aria-label="搜索标本">
      <select class="input" id="atlas-chapter" aria-label="按章节筛选"></select>
      <select class="input" id="atlas-kind" aria-label="按类型筛选">
        <option value="">全部类型</option>
        <option value="slide">光镜切片</option>
        <option value="em">电镜照片</option>
        <option value="figure">示意图</option>
      </select>
      <label class="small muted" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="atlas-local"> 仅本地概览图</label>
      <span class="spacer"></span>
      <span class="small faint" id="atlas-count"></span>
    </div>
    <div id="atlas-root"></div>`;
  return shell({
    title: '组织学图谱索引 · 组织学复习',
    description: 'Histology Guide 切片与电镜照片的中文索引：本地概览图、© 署名与原站在线查看入口。',
    active: 'atlas.html',
    pagePath: 'atlas.html',
    body
  });
}

/* ---------- 术语表 ---------- */
function buildGlossaryPage() {
  const cats = [...new Set(terms.map((t) => t.category))];
  const body = `${breadcrumb('', [['index.html', '首页'], ['glossary.html', '术语表']])}
    <h1 style="font-family:var(--serif)">中英术语表</h1>
    <p class="muted" style="max-width:72ch">以人卫版《组织学与胚胎学》术语体系为参照整理，支持中英文双向搜索。标注“待核验”的词条表示译名或释义仍有分歧，使用时请以教材为准。</p>
    <div class="toolbar">
      <input class="input" id="gloss-q" type="search" placeholder="搜索中文 / English / 别名" aria-label="搜索术语">
      <select class="input" id="gloss-cat" aria-label="按分类筛选"></select>
      <select class="input" id="gloss-chapter" aria-label="按章节筛选"></select>
      <label class="small muted" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="gloss-verified"> 仅看待核验</label>
      <span class="spacer"></span>
      <span class="small faint" id="gloss-count"></span>
    </div>
    <div class="card flush" style="overflow-x:auto">
      <table class="term-table">
        <thead><tr><th style="width:22%">中文 / English</th><th style="width:10%">分类</th><th>释义</th><th style="width:12%">章节</th></tr></thead>
        <tbody id="term-tbody"></tbody>
      </table>
    </div>
    <p class="small faint" style="margin-top:14px">分类说明：${cats.map((c) => esc(c)).join(' · ')}。释义为自编，不含原站原文。</p>`;
  return shell({
    title: '中英术语表 · 组织学复习',
    description: '组织学中英术语对照表，支持双向搜索、分类与章节筛选。',
    active: 'glossary.html',
    pagePath: 'glossary.html',
    body,
    pageClass: ''
  });
}

/* ---------- 复习模式 ---------- */
function buildReviewPage() {
  const body = `${breadcrumb('', [['index.html', '首页'], ['review.html', '复习模式']])}
    <h1 style="font-family:var(--serif)">复习模式</h1>
    <p class="muted" style="max-width:72ch">抽认卡自测：先在心里作答，按空格或“显示答案”核对。标记“再练”的题会进入易错清单。</p>
    <div class="toolbar">
      <select class="input" id="review-mode" aria-label="复习内容">
        <option value="term">术语（英文 → 中文）</option>
        <option value="quiz">自测题</option>
        <option value="specimen">标本识别</option>
      </select>
      <select class="input" id="review-scope" aria-label="复习范围"></select>
      <button class="btn ghost" id="review-restart" type="button">重新洗牌</button>
      <span class="spacer"></span>
      <span class="small faint" id="review-progress"></span>
    </div>
    <div class="flashcard" id="flashcard">
      <div class="fc-front" id="fc-front">准备开始</div>
      <div class="fc-sub" id="fc-sub"></div>
      <div class="fc-answer" id="fc-answer"></div>
      <div class="hint">空格：显示答案 / 记为记住 · ← 再练 · → 记住</div>
    </div>
    <div class="btn-row" style="margin-top:16px">
      <button class="btn primary" id="fc-reveal" type="button">显示答案</button>
      <button class="btn" id="fc-known" type="button">记住了 →</button>
      <button class="btn" id="fc-again" type="button">← 再练</button>
    </div>
    <div class="review-stats" id="review-stats" style="margin-top:16px"></div>
    <hr class="sep">
    <h2 style="font-size:18px">易错本</h2>
    <div id="wrong-list"></div>`;
  return shell({
    title: '复习模式 · 组织学复习',
    description: '术语、自测题与标本识别的抽认卡复习，支持易错本与键盘操作。',
    active: 'review.html',
    pagePath: 'review.html',
    body,
    pageClass: 'narrow'
  });
}

/* ---------- 来源与许可 ---------- */
function buildSourcesPage() {
  const rows = sourcesList
    .map(
      (s) => `<tr>
        <td>${esc(s.kind)}</td>
        <td><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a><div class="small faint mono" style="word-break:break-all">${esc(s.url)}</div></td>
        <td>${esc(s.status)}${s.items != null ? `（${s.items} 项）` : ''}</td>
        <td class="small">${s.fetchedAt ? esc(s.fetchedAt.replace('T', ' ').slice(0, 19)) + ' UTC' : '—'}</td>
        <td class="small">${s.httpStatus ? esc(s.httpStatus) : '—'}</td>
        <td class="small mono">${s.sha256 ? esc(s.sha256.slice(0, 16)) + '…' : '—'}</td>
      </tr>`
    )
    .join('');

  const imgRows = localImageList
    .map(
      (im) => `<tr>
        <td>${im.kind === 'figure' ? '示意图' : '光镜切片'}</td>
        <td>${esc(im.specimen || im.slug)}<div class="small faint mono">${esc(im.slug)}</div></td>
        <td class="small">第 ${esc(im.chapter)} 章</td>
        <td class="small">${esc(im.w)}×${esc(im.h)}</td>
        <td class="small">${(Number(im.bytes) / 1024).toFixed(0)} KB</td>
        <td class="small"><a href="${esc(im.sourcePage)}" target="_blank" rel="noopener noreferrer">原页面 ↗</a></td>
      </tr>`
    )
    .join('');

  const body = `${breadcrumb('', [['index.html', '首页'], ['sources.html', '署名与许可']])}
    <h1 style="font-family:var(--serif)">资源来源、署名与使用许可</h1>

    <div class="callout warn">
      <h3>非官方声明与统一署名</h3>
      <p style="margin:0 0 8px"><strong>本站是 Histology Guide 的非官方中文学习改编版，与 Histology Guide 无隶属关系，未经其认可或背书。</strong>本站不是 Histology Guide 的官方中文版，也不代表 Histology Guide 或其贡献者的观点。</p>
      <p style="margin:0 0 8px">按作者要求，全站每页顶部与页脚均使用以下署名通知（英文为作者给出的示例措辞，逐字保留）：</p>
      <blockquote style="margin:10px 0;padding:10px 14px;border-left:3px solid var(--accent);background:var(--bg-sunken);font-size:13.5px;line-height:1.65">${ATTRIBUTION_EN_HTML}</blockquote>
      <p style="margin:0">中文说明：原始图像与文字的版权归 <strong>Histology Guide 及/或原始贡献者</strong> 所有；这些材料<strong>不属于公有领域</strong>，不得在本许可之外自由复用。本站的中文要点、术语释义、自测题、页面代码为项目自编，不使用原站英文正文段落的翻译。</p>
    </div>

    <div class="notice" style="margin:20px 0">
      <h3>书面许可与边界</h3>
      <ul class="small" style="margin:0;padding-left:20px">
        <li><strong>2026-10-20</strong>：Histology Guide 团队（tcbrelje）回信，明确允许项目“<em>create and publicly host a non-commercial Chinese-language version of selected educational content … on GitHub Pages</em>”，并附 8 条条件（见下表）。</li>
        <li><strong>2026-10-18</strong>：此前的书面许可仅覆盖个人离线学习与私有资源；2026-10-20 的许可将其扩展为<strong>公开托管于 GitHub Pages</strong>，但<strong>仍然仅限非商业教育用途</strong>。</li>
        <li>许可仅覆盖本站这一项学习资源；<strong>不</strong>涵盖商用、售卖、许可、数据集发布，也<strong>不</strong>允许在 GitHub Pages 之外再分发本站保存的原始材料。</li>
        <li>原站 <a href="https://histologyguide.com/about-us/license.html" target="_blank" rel="noopener noreferrer">Terms of Use</a> 仍然有效：未经书面许可不得复制、展示、分发、修改、发布、存储或系统性汇集其内容。本站仅在作者书面许可范围内行事。</li>
      </ul>
    </div>

    <h2 style="font-size:18px">8 条许可条件与本站落实</h2>
    <div class="card flush" style="overflow-x:auto;margin-bottom:20px">
      <table class="data-table">
        <thead><tr><th style="width:30%">条件（作者原文要点）</th><th>本站落实</th><th style="width:22%">证据位置</th></tr></thead>
        <tbody>
          <tr><td>每页或显著的全站通知中提供清晰署名</td><td>每页顶部“非官方中文学习改编版”署名栏 + 页脚完整的英文示例句与中文说明；本站即全站统一通知页。</td><td>全部页面顶部与页脚；本页</td></tr>
          <tr><td>尽可能链接回对应的 Histology Guide 原页面</td><td>每张标本卡片有“原站切片 ↗”；每章页有“原站本章 ↗ / 原站电镜页 ↗”；本页图像清单逐张给出来源页链接。</td><td>章节页、图谱页、下方清单</td></tr>
          <tr><td>明确说明中文版是非官方翻译/改编，且未获 Histology Guide 背书</td><td>署名栏、页脚、首页、本页、使用说明页均写明“非官方”“无隶属关系”“未经认可或背书”。</td><td>全部页面</td></tr>
          <tr><td>不得去除或篡改版权声明、水印、来源署名</td><td>本地图像按采集到的原始像素保存，未裁剪、未抹除、未添加遮挡；每张图保留 © 署名与原页面链接；不采集/不展示任何去除水印的版本。</td><td>标本卡片、图像清单</td></tr>
          <tr><td>若某材料另有作者/机构署名，须遵从该署名并另行取得许可</td><td>已核对 <code class="mono">data/local-images.json</code> 中全部 ${localImageList.length} 条记录，署名均为 Histology Guide 及/或原始贡献者，未发现单独署名条目；如后续发现，将遵从该署名并删除或另行取得许可。</td><td><code class="mono">data/local-images.json</code></td></tr>
          <tr><td>保持非商业、可免费访问；不得出售、许可或其他商业利用</td><td>站点无付费墙、无广告、无许可售卖、不提供付费下载；全部内容公开免费访问；仓库与站点不用于任何商业目的。</td><td>首页、页脚、本页</td></tr>
          <tr><td>未经进一步许可，不得在 GitHub Pages 学习资源之外再分发材料</td><td>README、NOTICE、使用说明均声明：本仓库仅用于发布本站；禁止克隆、镜像、转存或再分发其中的图像与内容。站点不提供打包下载。</td><td>README、NOTICE、使用说明</td></tr>
          <tr><td>发布后把 live URL 发给作者，供其复核署名</td><td>本页与 <code class="mono">docs/06-publication.md</code> 记录线上地址；部署后按作者要求发送说明邮件。</td><td>本页末节、<code class="mono">docs/06-publication.md</code></td></tr>
        </tbody>
      </table>
    </div>

    <div class="grid cols-2" style="margin:20px 0">
      <div class="notice"><h3>本站保存并公开托管的内容</h3><ul class="small">
        <li>章节 / 小节 / 标本编号与名称等导航元数据</li>
        <li>自编中文要点、术语释义、自测题</li>
        <li><strong>经许可保存的所选图像概览</strong>（${localImageList.length} 张，见下方清单）</li>
        <li>每个来源页的 URL、抓取时间、HTTP 状态、响应摘要（SHA-256）</li>
        <li>访客学习进度<strong>只存其本机浏览器</strong>（localStorage），不上传</li>
      </ul></div>
      <div class="notice"><h3>本站不采集的内容</h3><ul class="small">
        <li>原站英文正文段落（不抓取、不翻译、不转存）</li>
        <li>原站完整分辨率切片金字塔（只取一个概览层级）</li>
        <li>原站测验题目、关键词索引</li>
        <li>任何账号、Cookie 或访客个人数据</li>
      </ul></div>
    </div>

    <h2 style="font-size:18px">本地图像清单（经许可公开托管）</h2>
    <p class="muted small">共 ${localImageList.length} 张。每张图由原站 BigTIFF 金字塔中的一个中分辨率层级拼接而来，不等同于原站完整分辨率；卡片上保留“原站切片”链接用于高倍观察。图像 © Histology Guide 及/或原始贡献者，仅限非商业教育用途，不得在本站之外再分发。</p>
    ${
      localImageList.length
        ? `<div class="card flush" style="overflow-x:auto"><table class="data-table">
        <thead><tr><th>类型</th><th>标本</th><th>章节</th><th>本地分辨率</th><th>体积</th><th>来源</th></tr></thead>
        <tbody>${imgRows}</tbody></table></div>`
        : '<div class="empty">尚未下载本地图像。运行 <code class="mono">node scripts/fetch-images.mjs</code> 按许可获取所选图像。</div>'
    }
    <h2 style="font-size:18px;margin-top:28px">页面清单与采集记录</h2>
    <p class="muted small">共 ${sourcesList.length} 条。元数据采集遵循 <a href="https://histologyguide.com/robots.txt" target="_blank" rel="noopener noreferrer">robots.txt</a>（避开 /assets /css /js 等目录），请求间隔 ≥1.2 秒；图像按许可以单文件或 Range 分层请求获取，限速并记录请求数。SHA-256 为抓取时的响应体摘要。</p>
    <div class="card flush" style="overflow-x:auto">
      <table class="data-table">
        <thead><tr><th>类型</th><th>页面</th><th>状态</th><th>抓取时间</th><th>HTTP</th><th>SHA-256</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <h2 style="font-size:18px;margin-top:28px">站点地址、仓库与许可联系</h2>
    <div class="notice small">
      <p style="margin:0 0 8px"><strong>本站（GitHub Pages）：</strong><a href="${SITE_URL}" target="_blank" rel="noopener noreferrer">${SITE_URL}</a></p>
      <p style="margin:0 0 8px"><strong>部署仓库：</strong><a href="https://github.com/AnAcretiondisk9986/histology-guide-zh" target="_blank" rel="noopener noreferrer">github.com/AnAcretiondisk9986/histology-guide-zh</a>（公开仓库仅用于发布本站，不代表授权再分发）</p>
      <p style="margin:0 0 8px"><strong>许可联系：</strong>如需扩大使用范围（商业使用、在 GitHub Pages 之外再分发、更高分辨率批量获取等），必须另行取得作者书面许可：<a href="mailto:tcbrelje@gmail.com">tcbrelje@gmail.com</a>。</p>
      <p style="margin:0"><strong>署名纠错：</strong>如你是权利人，认为某处署名或使用方式不符合许可，请通过上述邮箱或仓库 Issue 联系，我们会及时更正或移除相关内容。</p>
    </div>`;
  return shell({
    title: '资源来源、署名与使用许可 · 组织学复习',
    description: 'Histology Guide 内容来源、非官方声明、8 条许可条件落实、本地图像清单与采集记录。',
    active: 'sources.html',
    pagePath: 'sources.html',
    body
  });
}

/* ---------- 使用说明 ---------- */
function buildHelpPage() {
  const body = `${breadcrumb('', [['index.html', '首页'], ['help.html', '使用说明']])}
    <h1 style="font-family:var(--serif)">使用说明与已知限制</h1>
    <p class="muted" style="max-width:75ch">本站是 Histology Guide 的非官方中文学习改编版，与 Histology Guide 无隶属关系、未经其认可或背书。原始图像与文字版权归 Histology Guide 及/或原始贡献者所有；本站按作者 2026-10-20 书面许可公开托管，仅限非商业教育用途并免费访问。</p>

    <h2 style="font-size:18px">在线访问（推荐）</h2>
    <p>公开地址：<a href="${SITE_URL}" target="_blank" rel="noopener noreferrer">${SITE_URL}</a>。无需安装，直接用浏览器打开；学习进度只保存在你自己的浏览器里。</p>

    <h2 style="font-size:18px">本地打开与重新生成</h2>
    <p>项目克隆到本机后，也可直接打开或本地起服务：</p>
    <ol>
      <li><strong>直接打开：</strong>双击 <code class="mono">site/index.html</code>，用浏览器打开即可（Chrome / Edge / Firefox / Safari 均可）。所有数据随页面内嵌，离线可用。</li>
      <li><strong>本地静态服务器（可选）：</strong>在项目根目录运行 <code class="mono">npx serve site</code> 或 <code class="mono">python -m http.server 8080 -d site</code>，再访问 <code class="mono">http://localhost:8080</code>。</li>
    </ol>

    <h2 style="font-size:18px">离线 / 在线功能对照</h2>
    <div class="card flush" style="overflow-x:auto">
      <table class="data-table">
        <thead><tr><th>功能</th><th>离线可用</th><th>说明</th></tr></thead>
        <tbody>
          <tr><td>章节导航、小节要点、术语表、搜索、自测、抽认卡、进度与易错本</td><td><span class="badge ok">是</span></td><td>数据内嵌于 assets/data.js；进度存 localStorage</td></tr>
          <tr><td><strong>已下载的本地概览图</strong>（${localImageList.length} 张所选切片/示意图），点击放大</td><td><span class="badge ok">是</span></td><td>经作者书面许可保存的中分辨率概览，见“署名与许可”页清单与署名</td></tr>
          <tr><td>其余切片 / 电镜图像、完整分辨率、标注</td><td><span class="badge online">否</span></td><td>原站切片为 BigTIFF 金字塔；点击“原站切片”在线查看高倍与标注（需网络）</td></tr>
          <tr><td>原站 Quiz 互动题</td><td><span class="badge online">否</span></td><td>本站提供自编自测题；原站 Quiz 需在线访问</td></tr>
          <tr><td>原站 Gallery / Index / Search</td><td><span class="badge online">否</span></td><td>已在“署名与许可”页保留入口</td></tr>
        </tbody>
      </table>
    </div>

    <h2 style="font-size:18px">署名与许可（重要）</h2>
    <div class="callout warn">
      <p style="margin:0 0 8px"><strong>${UNOFFICIAL_ZH}</strong>${PERMISSION_ZH}</p>
      <blockquote style="margin:10px 0;padding:10px 14px;border-left:3px solid var(--accent);background:var(--bg-sunken);font-size:13px;line-height:1.6">${ATTRIBUTION_EN_HTML}</blockquote>
      <ul class="small" style="margin:0;padding-left:20px">
        <li>每张图像保留 © 署名与原页面链接；<strong>不得</strong>去除或篡改版权声明、水印、来源署名。</li>
        <li>仅限非商业教育用途、免费访问；<strong>不得</strong>出售、许可或以其他方式商业利用。</li>
        <li>除本站（GitHub Pages）这一学习资源外，<strong>不得</strong>再分发本站保存的原始材料；本仓库仅用于发布本站，克隆、镜像、转存均需作者另行书面许可。</li>
        <li>原始材料不属于公有领域；如你是权利人，认为某处署名或使用方式不符合许可，请联系更正或删除。</li>
      </ul>
      <p style="margin:8px 0 0">完整条件、逐条落实证据与联系渠道见 <a href="sources.html">署名与许可</a> 页。</p>
    </div>

    <h2 style="font-size:18px">键盘操作</h2>
    <dl class="kv">
      <dt><kbd>/</kbd></dt><dd>打开搜索</dd>
      <dt><kbd>↑</kbd> <kbd>↓</kbd> <kbd>Enter</kbd></dt><dd>搜索结果选择与跳转</dd>
      <dt><kbd>Esc</kbd></dt><dd>关闭搜索</dd>
      <dt><kbd>空格</kbd></dt><dd>复习模式：显示答案 / 记为记住</dd>
      <dt><kbd>→</kbd> / <kbd>←</kbd></dt><dd>复习模式：记住 / 再练</dd>
    </dl>

    <h2 style="font-size:18px">已知限制</h2>
    <ul>
      <li><strong>本地图像是概览：</strong>已保存 ${localImageList.length} 张所选图像的中分辨率概览（约 4000–5200 px 宽），完整分辨率与结构标注需在原站查看；“不冒充完整切片”是刻意设计。</li>
      <li><strong>许可范围：</strong>公开托管于 GitHub Pages 已获作者 2026-10-20 书面许可，但<strong>仅限非商业教育用途并免费访问</strong>；不得出售、许可或其他商业利用，不得在本站之外再分发；图像署名与原页面链接见每张卡片及“署名与许可”页。</li>
      <li><strong>术语共 ${terms.length} 条：</strong>释义与译名为自编，个别条目标注“待核验”，请以人卫版教材为准。</li>
      <li><strong>内容完成度：</strong>${totals.authoredChapters}/${totals.chapters} 章中文要点已写完，界面不会把未完成章节标为已完成。当前覆盖 ${totals.coveredSections}/${totals.sections} 个小节。</li>
      <li><strong>第 20 章电镜：</strong>原站该章电镜页本身无内容；第 21 章原站无电镜页。</li>
      <li><strong>不抓取：</strong>原站英文正文段落、测验题、关键词索引与搜索页均未采集，仅保留入口链接。</li>
    </ul>

    <h2 style="font-size:18px">目录结构与重新生成</h2>
    <pre class="card" style="overflow-x:auto;font:12.5px/1.7 var(--mono);margin:0"><code>scripts/fetch.mjs        元数据采集（限速 / 可增量 / 遵守 robots）
scripts/scaffold.mjs     汇总 inventory + 生成内容脚手架
scripts/check-content.mjs 校验中文内容与术语一致性
scripts/fetch-images.mjs 按书面许可下载所选图像的概览层级（可增量）
scripts/stitch_tiles.py  本地拼接瓦片（Pillow）
scripts/build.mjs        生成 site/ 静态页面与内嵌数据
content/zh/chapters/     每章中文内容 JSON
content/zh/terms.json    术语表
data/inventory.json      章节 / 小节 / 标本清单
data/local-images.json   本地图像清单（含来源、尺寸、SHA-256、署名）
site/                    生成后的网站（可直接打开）</code></pre>
    <p class="small muted" style="margin-top:10px">重新生成：<code class="mono">node scripts/fetch.mjs</code> → <code class="mono">node scripts/scaffold.mjs</code> → <code class="mono">node scripts/build.mjs</code>；图像：<code class="mono">node scripts/fetch-images.mjs --per-chapter=1</code>（可断点续跑，已存在则跳过）。</p>`;
  return shell({
    title: '使用说明 · 组织学复习',
    description: '本站在线地址、本地启动方式、离线与在线功能对照、署名与许可、键盘操作与已知限制。',
    active: '',
    pagePath: 'help.html',
    body,
    pageClass: 'narrow'
  });
}

/* ---------- 404 与站点级文件 ---------- */
function buildNotFoundPage() {
  const body = `${breadcrumb(SITE_URL, [['index.html', '首页'], ['404.html', '页面不存在']])}
    <h1 style="font-family:var(--serif)">页面不存在</h1>
    <p class="muted">你访问的地址不在此站中，可能是链接过期或拼写错误。</p>
    <div class="btn-row" style="margin-top:16px">
      <a class="btn primary" href="${SITE_URL}index.html">回到首页</a>
      <a class="btn" href="${SITE_URL}chapters.html">章节目录</a>
      <a class="btn ghost" href="${SITE_URL}sources.html">署名与许可</a>
    </div>`;
  return shell({
    base: SITE_URL,
    title: '页面不存在 · 组织学复习',
    description: '页面不存在。Histology Guide 非官方中文学习改编版。',
    pagePath: '404.html',
    body,
    pageClass: 'narrow'
  });
}

const sitemapPages = [
  'index.html',
  'chapters.html',
  'atlas.html',
  'glossary.html',
  'review.html',
  'sources.html',
  'help.html',
  ...chapters.map((c) => `chapter/${pad2(c.n)}.html`)
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapPages.map((p) => `  <url><loc>${SITE_URL}${p}</loc></url>`).join('\n')}
</urlset>
`;

/* ---------- 写文件 ---------- */
await fs.mkdir(path.join(SITE, 'chapter'), { recursive: true });
await fs.writeFile(path.join(SITE, 'index.html'), buildIndexPage(), 'utf8');
await fs.writeFile(path.join(SITE, 'chapters.html'), buildChapterIndexPage(), 'utf8');
await fs.writeFile(path.join(SITE, 'atlas.html'), buildAtlasPage(), 'utf8');
await fs.writeFile(path.join(SITE, 'glossary.html'), buildGlossaryPage(), 'utf8');
await fs.writeFile(path.join(SITE, 'review.html'), buildReviewPage(), 'utf8');
await fs.writeFile(path.join(SITE, 'sources.html'), buildSourcesPage(), 'utf8');
await fs.writeFile(path.join(SITE, 'help.html'), buildHelpPage(), 'utf8');
await fs.writeFile(path.join(SITE, '404.html'), buildNotFoundPage(), 'utf8');
await fs.writeFile(path.join(SITE, 'sitemap.xml'), sitemap, 'utf8');
await fs.writeFile(
  path.join(SITE, 'robots.txt'),
  `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}sitemap.xml\n`,
  'utf8'
);
await fs.writeFile(path.join(SITE, '.nojekyll'), '', 'utf8');
for (const c of chapters) {
  await fs.writeFile(path.join(SITE, 'chapter', `${pad2(c.n)}.html`), await buildChapterPage(c), 'utf8');
}

console.log('站点已生成 → site/');
console.log('章节：', chapters.length, '| 已完成内容章节：', totals.authoredChapters, '| 小节覆盖：', `${totals.coveredSections}/${totals.sections}`);
console.log('术语：', totals.terms, '| 自测题：', totals.quizzes, '| 来源条目：', sourcesList.length);
const pending = chapters.filter((c) => c.contentStatus !== 'authored').map((c) => c.n);
if (pending.length) console.log('仍待编写内容章节：', pending.join(', '));

