#!/usr/bin/env node
/**
 * 原站链接可用性抽查（需要网络）。
 * 检查：21 个章节页 + 20 个电镜页 + 抽样 40 个切片/电镜条目链接。
 * 限速 1.2s，超时 15s，失败重试 1 次。输出 data/reports/link-check.json。
 *
 * 用法：node scripts/check-links.mjs [--all-specimens] [--delay=1200]
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const inventory = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'inventory.json'), 'utf8'));
const argv = process.argv.slice(2);
const ALL = argv.includes('--all-specimens');
const DELAY = Number((argv.find((a) => a.startsWith('--delay=')) || '--delay=1200').split('=')[1]);
const ORIGIN = 'https://histologyguide.com';
const UA = 'HistologyGuideCNStudyIndex/0.1 (+personal study index; link check)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const urls = [];
for (const c of inventory.chapters) {
  urls.push({ kind: 'chapter', chapter: c.n, url: c.slideboxUrl });
  if (c.emUrl) urls.push({ kind: 'em-chapter', chapter: c.n, url: c.emUrl });
}

// 抽样：每章取 2 个光镜条目，尽量覆盖不同章
let sampled = [];
for (const c of inventory.chapters) {
  sampled.push(...c.specimens.filter((s) => s.kind === 'slide').slice(0, 2));
}
if (ALL) {
  sampled = inventory.chapters.flatMap((c) => [...c.specimens, ...c.emItems]);
} else if (sampled.length > 40) {
  // 等距抽样，保持确定性
  const step = sampled.length / 40;
  sampled = Array.from({ length: 40 }, (_, i) => sampled[Math.floor(i * step)]);
}
const seen = new Set(urls.map((u) => u.url));
for (const s of sampled) {
  const u = ORIGIN + s.href;
  if (seen.has(u)) continue;
  seen.add(u);
  urls.push({ kind: s.kind, name: s.name, url: u });
}

async function probe(url) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const t0 = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch(url, { method: 'GET', headers: { 'User-Agent': UA }, signal: ctrl.signal });
      clearTimeout(timer);
      // 只读少量字节，确认可用
      await r.body?.cancel?.();
      return { ok: r.ok, status: r.status, ms: Date.now() - t0, finalUrl: r.url };
    } catch (e) {
      if (attempt === 2) return { ok: false, status: 0, ms: Date.now() - t0, error: String(e.message || e) };
      await sleep(900);
    }
  }
}

const results = [];
let bad = 0;
for (const [i, u] of urls.entries()) {
  const r = await probe(u.url);
  if (!r.ok) bad++;
  results.push({ ...u, ...r });
  console.log(`${r.ok ? '✓' : '✗'} [${i + 1}/${urls.length}] ${u.kind} ${u.chapter ? 'ch' + u.chapter : ''} ${u.url} → ${r.status || r.error}`);
  await sleep(DELAY);
}

const report = {
  checkedAt: new Date().toISOString(),
  total: urls.length,
  ok: urls.length - bad,
  failed: bad,
  failures: results.filter((r) => !r.ok),
  results
};
await fs.mkdir(path.join(ROOT, 'data', 'reports'), { recursive: true });
await fs.writeFile(path.join(ROOT, 'data', 'reports', 'link-check.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(`\n链接抽查：${report.ok}/${report.total} 可用，${report.failed} 个失败`);
console.log('报告：data/reports/link-check.json');
process.exit(bad ? 1 : 0);
