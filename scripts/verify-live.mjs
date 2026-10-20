import fs from 'node:fs/promises';

// 线上验收：检查 GitHub Pages 线上 URL 的 29 个页面、sitemap、图片与 404，
// 结果写入 data/reports/live-verify.json。
// 用法：node scripts/verify-live.mjs

const BASE = 'https://blog.acretiondisk.top/histology-guide-zh/';
const pages = [
  'index.html', 'chapters.html', 'atlas.html', 'glossary.html', 'review.html', 'sources.html', 'help.html', '404.html',
  ...Array.from({ length: 21 }, (_, i) => `chapter/${String(i + 1).padStart(2, '0')}.html`)
];
const needles = [
  ['license-bar', 'license-bar'],
  ['英文署名句', 'unofficial Chinese-language educational adaptation'],
  ['中文非官方声明', '非官方中文学习改编版'],
  ['未背书', '未经其认可或背书'],
  ['版权归属', 'Histology Guide and/or original contributors'],
  ['原站链接', 'histologyguide.com'],
  ['canonical', `https://blog.acretiondisk.top/histology-guide-zh/`]
];
const oldWording = ['仅个人学习', '请勿发布', '不得发布', '2026-10-18 书面许可保存'];
const results = [];
for (const p of pages) {
  const url = BASE + p;
  const r = await fetch(url);
  const text = r.status === 200 ? await r.text() : '';
  const missing = needles.filter(([, n]) => !text.includes(n)).map(([k]) => k);
  const old = oldWording.filter((n) => text.includes(n));
  results.push({ page: p, status: r.status, bytes: text.length, missing, old });
}
const pageFail = results.filter((x) => x.status !== 200 || x.missing.length || x.old.length);

const sitemap = await (await fetch(BASE + 'sitemap.xml')).text();
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const sitemapChecks = [];
for (const loc of locs) {
  const r = await fetch(loc, { method: 'HEAD' });
  sitemapChecks.push({ loc, status: r.status });
}
const badSitemap = sitemapChecks.filter((x) => x.status !== 200);

const imageSamples = [];
for (const rel of [
  'images/slides/MH-001-nuclear-morphology.jpg',
  'images/slides/MHS-268-269-270-pancreas.jpg',
  'images/slides/MH-172-cervix.jpg',
  'images/figures/fig-008-epithelium.jpg',
  'images/figures/fig-002-microscopes.jpg'
]) {
  const r = await fetch(BASE + rel);
  const buf = await r.arrayBuffer();
  imageSamples.push({ rel, status: r.status, type: r.headers.get('content-type'), bytes: buf.byteLength });
}
const badImages = imageSamples.filter((x) => x.status !== 200 || !/image\//.test(x.type || '') || x.bytes < 20000);

const missing = await fetch(BASE + 'no-such-page-123');
const missingText = await missing.text();
const notFoundOk = missing.status === 404 && missingText.includes('页面不存在');

const gi = await fetch('https://anacreationdisk9986.github.io/histology-guide-zh/');
const ghio = { status: gi.status };

const report = {
  checkedAt: new Date().toISOString(),
  base: BASE,
  pageCount: pages.length,
  pageFail,
  sitemapCount: locs.length,
  badSitemap,
  imageSamples,
  badImages,
  notFoundOk,
  ghio,
  pass: pageFail.length === 0 && badSitemap.length === 0 && badImages.length === 0 && notFoundOk && locs.length === pages.length - 1
};
await fs.writeFile(new URL('../data/reports/live-verify.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);


