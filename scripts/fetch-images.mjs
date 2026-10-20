#!/usr/bin/env node
/**
 * 授权图像采集 v2：解析原页面得到真实 .zif（BigTIFF 金字塔），按需取一个分辨率层级，
 * 自适应选层 + 少量并发 + 单张硬超时（默认 60 秒，超过即跳过并记录）。
 *
 * 依据：2026-10-20 Histology Guide 作者书面许可（docs/05-permission.md 第 9 节）：
 *   可创建并在 GitHub Pages 公开托管“所选”教育内容的非商业中文改编版；
 *   须保留署名与原页面链接；不得去除/篡改版权声明、水印或来源署名；
 *   不得出售、许可或其他商业利用；不得在 GitHub Pages 学习资源之外再分发。
 *   2026-10-18 的个人离线学习许可仍作为历史记录保留，现已被上述许可扩展。
 *   站方技术部门对连续请求有限速保护；作者确认可下载。本脚本保持限速与礼貌并发。
 *
 * 用法：
 *   node scripts/fetch-images.mjs                         # 每章 1 张代表切片 + 全部示意图
 *   node scripts/fetch-images.mjs --all-slides            # 全部光镜切片（耗时长）
 *   node scripts/fetch-images.mjs --figures-only
 *   node scripts/fetch-images.mjs --chapter=2 --all-slides --width=10000
 *   node scripts/fetch-images.mjs --em --per-chapter=1    # 每章 1 张电镜（如有，整包小文件）
 *   node scripts/fetch-images.mjs --dry                   # 只估计层数与请求数
 * 选项：--max-seconds=60 单张上限；--concurrency=4 并发；--delay=120 请求间隔；
 *       --full-limit=40000000 整包下载阈值；--only-slug=xxx；--no-resume 重抓
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SITE = path.join(ROOT, 'site');
const TMP = path.join(ROOT, '.tmp', 'tiles');
const INVENTORY = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'inventory.json'), 'utf8'));
const MANIFEST_PATH = path.join(ROOT, 'data', 'local-images.json');
const SOURCES_CACHE = path.join(ROOT, 'data', 'image-sources.json');
const REPORT_DIR = path.join(ROOT, 'data', 'reports');
const PYTHON = 'C:\\Users\\AnAcretiondisk\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\python\\python.exe';

const argv = process.argv.slice(2);
const opt = (name, dflt = null) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const flag = (name) => argv.includes(`--${name}`);

const ONLY_CHAPTER = opt('chapter') ? Number(opt('chapter')) : null;
const CHAPTERS = (opt('chapters', '') || '')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter(Boolean);
const CHAPTER_SET = CHAPTERS.length ? new Set(CHAPTERS) : null;
const ONLY_SLUG = opt('only-slug');
const PER_CHAPTER = Number(opt('per-chapter', 1));
const WIDTH = Number(opt('width', 5200));
const DELAY = Number(opt('delay', 120));
const CONCURRENCY = Math.max(1, Math.min(8, Number(opt('concurrency', 4))));
const MAX_SECONDS = Number(opt('max-seconds', 60));
const FULL_LIMIT = Number(opt('full-limit', 4 * 1024 * 1024));
const DRY = flag('dry');
const ALL_SLIDES = flag('all-slides');
const FIGURES_ONLY = flag('figures-only');
const SLIDES_ONLY = flag('slides-only');
const WITH_EM = flag('em');
const NO_RESUME = flag('no-resume');
const UA = 'HistologyGuideCNStudyIndex/0.3 (+non-commercial educational adaptation; written permission from site authors 2026-10-20)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const DIR = { figure: 'figures', slide: 'slides', em: 'em' };

/* ---------------------------- HTTP helpers ---------------------------- */
async function rangeFetch(url, start, len, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, Range: `bytes=${start}-${start + len - 1}` },
      signal: ctrl.signal
    });
    const type = (r.headers.get('content-type') || '').toLowerCase();
    const cr = r.headers.get('content-range') || '';
    const total = cr.includes('/') ? Number(cr.split('/')[1]) : null;
    const buf = Buffer.from(await r.arrayBuffer());
    return { buf, type, status: r.status, total };
  } finally {
    clearTimeout(timer);
  }
}
const isHtml = (type, buf = Buffer.alloc(0)) =>
  type.includes('text/html') || buf.subarray(0, 15).toString('latin1').toLowerCase().includes('<!doctype');

async function probeSize(url, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Range: 'bytes=0-0' }, signal: ctrl.signal });
    const type = (r.headers.get('content-type') || '').toLowerCase();
    const cr = r.headers.get('content-range') || '';
    const total = cr.includes('/') ? Number(cr.split('/')[1]) : null;
    try { await r.body?.cancel(); } catch {}
    return { type, total, status: r.status };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------- BigTIFF 读取 ---------------------------- */
class RemoteBigTiff {
  constructor(url, buffer = null) {
    this.url = url;
    this.buffer = buffer;
    this.head = null;
    this.cache = new Map();
    this.requests = 0;
    this.bytes = 0;
    this.totalBytes = buffer ? buffer.length : null;
  }
  async read(off, len) {
    if (this.buffer) return this.buffer.subarray(off, Math.min(off + len, this.buffer.length));
    if (this.head && off + len <= this.head.length) return this.head.subarray(off, off + len);
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const { buf, type, status, total } = await rangeFetch(this.url, off, len);
        if (isHtml(type, buf)) throw new Error('NO_ZIF');
        if (status !== 206 && status !== 200) throw new Error('HTTP ' + status);
        if (total) this.totalBytes = total;
        this.requests++;
        this.bytes += buf.length;
        if (buf.length < len && !(this.totalBytes && off + buf.length >= this.totalBytes)) {
          throw new Error(`短读 ${buf.length}/${len}`);
        }
        return buf;
      } catch (e) {
        if (e.message === 'NO_ZIF' || attempt === 4) throw e;
        await sleep(500 * attempt);
      }
    }
  }
  async init() {
    // 只读 64 KB 头部：实测该站对大 Range 读取会显著变慢（1 MB 约 33 s，64 KB 约 1.6 s）
    this.head = await this.read(0, 64 * 1024);
    if (this.head.subarray(0, 2).toString() !== 'II') throw new Error('不是小端 TIFF');
    if (this.head.readUInt16LE(2) !== 43) throw new Error('不是 BigTIFF');
    this.ifd0 = Number(this.head.readBigUInt64LE(8));
    this.levels = [];
    let off = this.ifd0;
    for (let i = 0; i < 16 && off; i++) {
      const { entries, next } = await this._readIFD(off);
      const g = (t) => (entries.has(t) ? Number(entries.get(t).val) : null);
      this.levels.push({
        idx: i, off, w: g(256), h: g(257), comp: g(259), tw: g(322), th: g(323),
        tileCount: entries.has(324) ? entries.get(324).count : 0, entries
      });
      off = next;
    }
    return this;
  }
  async _readIFD(off) {
    const n = Number((await this.read(off, 8)).readBigUInt64LE(0));
    if (n > 400) throw new Error('异常 IFD 条目数 ' + n);
    const d = await this.read(off, 8 + n * 20 + 8);
    const entries = new Map();
    for (let i = 0; i < n; i++) {
      const e = d.subarray(8 + i * 20, 8 + (i + 1) * 20);
      entries.set(e.readUInt16LE(0), {
        typ: e.readUInt16LE(2),
        count: Number(e.readBigUInt64LE(4)),
        val: Number(e.readBigUInt64LE(12))
      });
    }
    return { entries, next: Number(d.readBigUInt64LE(8 + n * 20)) };
  }
  async array(level, tag) {
    const key = `${level.idx}:${tag}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const ent = level.entries.get(tag);
    if (!ent) return null;
    const sizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8, 17: 8, 18: 8 };
    const size = (sizes[ent.typ] || 1) * ent.count;
    let buf;
    if (size <= 8) {
      const t = Buffer.alloc(8);
      t.writeBigUInt64LE(BigInt(ent.val), 0);
      buf = t.subarray(0, size);
    } else buf = await this.read(ent.val, size);
    const out = [];
    for (let i = 0; i < ent.count; i++) {
      if (ent.typ === 3) out.push(buf.readUInt16LE(i * 2));
      else if (ent.typ === 4) out.push(buf.readUInt32LE(i * 4));
      else if (ent.typ === 16) out.push(Number(buf.readBigUInt64LE(i * 8)));
      else out.push(buf[i]);
    }
    this.cache.set(key, out);
    return out;
  }
}

/* ---------------------------- 目标列表 ---------------------------- */
const targets = [];
const seen = new Set();
const push = (kind, slug, name, chapter, pageUrl) => {
  if (seen.has(kind + ':' + slug)) return;
  seen.add(kind + ':' + slug);
  targets.push({ kind, slug, name, chapter, pageUrl, zifUrl: null });
};

for (const ch of INVENTORY.chapters) {
  if (ONLY_CHAPTER && ch.n !== ONLY_CHAPTER) continue;
  if (CHAPTER_SET && !CHAPTER_SET.has(ch.n)) continue;
  if (!SLIDES_ONLY) {
    for (const f of ch.specimens.filter((s) => s.kind === 'figure')) {
      const m = /^\/figureview\/([^/]+)\//.exec(f.href);
      if (m) push('figure', m[1], f.name, ch.n, `https://histologyguide.com${f.href}`);
    }
  }
  if (!FIGURES_ONLY) {
    const slides = ch.specimens.filter((s) => s.kind === 'slide');
    const pick = ALL_SLIDES ? slides : slides.slice(0, PER_CHAPTER);
    for (const s of pick) {
      const m = /^\/slideview\/([^/]+)\//.exec(s.href);
      if (m) push('slide', m[1], s.name, ch.n, `https://histologyguide.com${s.href}`);
    }
    if (WITH_EM) {
      const ems = (ch.emItems || []).slice(0, Math.max(1, PER_CHAPTER));
      for (const s of ems) {
        const m = /^\/EM-view\/([^/]+)\//.exec(s.href);
        if (m) push('em', m[1], s.name, ch.n, `https://histologyguide.com${s.href}`);
      }
    }
  }
}
if (ONLY_SLUG) for (let i = targets.length - 1; i >= 0; i--) if (targets[i].slug !== ONLY_SLUG) targets.splice(i, 1);

/* ---------------------------- 清单与缓存 ---------------------------- */
for (const d of Object.values(DIR)) await fs.mkdir(path.join(SITE, 'images', d), { recursive: true });
await fs.mkdir(TMP, { recursive: true });
await fs.mkdir(REPORT_DIR, { recursive: true });

let manifest = { schema: 1, importedAt: new Date().toISOString(), notes: [], slides: {}, figures: {} };
try {
  const prev = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
  manifest = { schema: 1, importedAt: prev.importedAt || manifest.importedAt, notes: prev.notes || [], slides: prev.slides || {}, figures: prev.figures || {} };
} catch {}
for (const [k, v] of Object.entries(manifest.slides || {})) {
  if (v && v.file && String(v.file).includes('/figures/') && !manifest.figures[k]) manifest.figures[k] = v;
}
let zifCache = {};
try { zifCache = JSON.parse(await fs.readFile(SOURCES_CACHE, 'utf8')); } catch {}
let cacheDirty = false;
async function saveCache() {
  if (!cacheDirty) return;
  await fs.writeFile(SOURCES_CACHE, JSON.stringify(zifCache, null, 2) + '\n', 'utf8');
  cacheDirty = false;
}
const saveManifest = async () => {
  manifest.importedAt = new Date().toISOString();
  const flat = { schema: 1, importedAt: manifest.importedAt, notes: manifest.notes, slides: { ...manifest.figures, ...manifest.slides }, figures: manifest.figures };
  // 原子写入：先写临时文件再重命名，避免强制中断时清单被写坏
  const tmpPath = MANIFEST_PATH + '.tmp';
  await fs.writeFile(tmpPath, JSON.stringify(flat, null, 2) + '\n', 'utf8');
  await fs.rename(tmpPath, MANIFEST_PATH);
};

/** 从原页面解析真实 .zif 地址（解决合并编号、图版/电镜路径不同的问题） */
async function resolveZif(t) {
  if (zifCache[t.pageUrl]) return zifCache[t.pageUrl];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  let html = '';
  try {
    const r = await fetch(t.pageUrl, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    html = await r.text();
  } finally {
    clearTimeout(timer);
  }
  const m = html.match(/\/(slides|figures|EMs)\/([^"'>\s]+?\.zif)/);
  if (!m) throw new Error('页面中未找到 .zif');
  const url = 'https://histologyguide.com' + m[0].replace(/['"]+$/, '');
  zifCache[t.pageUrl] = url;
  cacheDirty = true;
  await saveCache();
  return url;
}

/* ---------------------------- 选层与下载 ---------------------------- */
const report = {
  startedAt: new Date().toISOString(), targets: targets.length,
  ok: 0, skipped: 0, failed: 0, timeout: 0, requests: 0, bytes: 0,
  maxSeconds: MAX_SECONDS, concurrency: CONCURRENCY, items: []
};

const PROGRESS_LOG = path.join(REPORT_DIR, 'images-progress.log');
async function logLine(line) {
  console.log(line);
  try {
    await fs.appendFile(PROGRESS_LOG, `[${new Date().toISOString()}] ${line}\n`, 'utf8');
  } catch {}
}

async function stitch(workDir, outPath, meta) {
  const p = spawn(PYTHON, [
    path.join(ROOT, 'scripts', 'stitch_tiles.py'), workDir, outPath,
    String(meta.w), String(meta.h), String(meta.tw), String(meta.th)
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  p.stdout.on('data', (d) => (out += d));
  p.stderr.on('data', (d) => (err += d));
  const code = await new Promise((r) => p.on('close', r));
  if (code !== 0) throw new Error(`拼接失败(${code}): ${err.slice(0, 300)}`);
  return JSON.parse(out.trim().split('\n').pop());
}

/** 依据实测延迟与并发，选择能在 maxSeconds 内完成的最大分辨率层 */
async function chooseLevel(tiff) {
  const usable = tiff.levels.filter((l) => l.w && l.h && l.tileCount).sort((a, b) => b.w - a.w);
  if (!usable.length) throw new Error('无可用层级');
  const probe = usable.find((l) => l.tileCount <= 4) || usable[usable.length - 1];
  const po = await tiff.array(probe, 324);
  const pc = await tiff.array(probe, 325);
  let latency = 2.5;
  if (po && pc && po.length && pc[0] > 0) {
    const t0 = Date.now();
    await rangeFetch(tiff.url, po[0], pc[0], 30000);
    latency = Math.max(0.25, (Date.now() - t0) / 1000);
    tiff.requests++;
    tiff.bytes += pc[0];
  }
  const budget = Math.max(3, Math.floor((MAX_SECONDS * 0.8) / latency) * CONCURRENCY);
  const wantW = usable.filter((l) => l.w <= WIDTH);
  const pool = wantW.length ? wantW : usable;
  const fits = pool.find((l) => l.tileCount <= budget);
  const chosen = fits || pool[pool.length - 1];
  return { level: chosen, latency, budget };
}

async function downloadTiles(tiff, level, offs, counts, across, workDir, deadline) {
  const index = new Array(offs.length);
  let next = 0;
  let done = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, offs.length) }, async () => {
    while (true) {
      const n = next++;
      if (n >= offs.length) return;
      if (Date.now() > deadline) throw new Error('TIMEOUT');
      if (counts[n] === 0) {
        index[n] = { n, x: n % across, y: Math.floor(n / across), file: null };
        continue;
      }
      let buf = null;
      if (tiff.buffer) {
        buf = await tiff.read(offs[n], counts[n]);
      } else {
        for (let attempt = 1; attempt <= 3 && !buf; attempt++) {
          try {
            const { buf: b, type, status } = await rangeFetch(tiff.url, offs[n], counts[n]);
            if (isHtml(type, b)) throw new Error('NO_ZIF');
            if (status === 416 || status === 404 || status === 403) throw new Error('HTTP_' + status);
            if (status !== 206 && status !== 200) throw new Error('HTTP ' + status);
            buf = b;
            tiff.requests++;
            tiff.bytes += buf.length;
          } catch (e) {
            if (/^HTTP_|NO_ZIF/.test(e.message) || attempt === 3) throw new Error(`瓦片 ${n}: ${e.message}`);
            await sleep(350 * attempt);
          }
        }
        if (Date.now() > deadline) throw new Error('TIMEOUT');
      }
      const file = `${String(n).padStart(6, '0')}.jpg`;
      await fs.writeFile(path.join(workDir, file), buf);
      index[n] = { n, x: n % across, y: Math.floor(n / across), file };
      done++;
      if (done % 40 === 0) console.log(`    … ${tiff.label || ''}${done}/${offs.length} tiles`);
      if (!tiff.buffer && DELAY) await sleep(DELAY);
    }
  });
  await Promise.all(workers);
  return index.filter(Boolean);
}

/* ---------------------------- 主循环 ---------------------------- */
for (const [i, t] of targets.entries()) {
  const tag = `[${i + 1}/${targets.length}]`;
  const bucket = t.kind === 'figure' ? manifest.figures : manifest.slides;
  const relFile = `images/${DIR[t.kind]}/${t.slug}.jpg`;
  const outPath = path.join(SITE, relFile);
  if (!NO_RESUME && !DRY && bucket[t.slug] && existsSync(outPath)) {
    report.skipped++;
    report.items.push({ ...t, state: 'skipped', file: relFile });
    await logLine(`${tag} 跳过 ${t.slug}（已有 ${bucket[t.slug].w}×${bucket[t.slug].h}）`);
    continue;
  }

  const started = Date.now();
  const deadline = started + MAX_SECONDS * 1000;
  const checkDeadline = () => {
    if (Date.now() > deadline) throw new Error('TIMEOUT');
  };
  let workDir = null;
  try {
    t.zifUrl = await resolveZif(t);
    checkDeadline();
    // 小文件整包下载（1 次请求，快）
    let fullBuf = null;
    const probe = await probeSize(t.zifUrl);
    if (!isHtml(probe.type) && probe.total && probe.total <= FULL_LIMIT) {
      const remain = Math.max(5, Math.ceil((deadline - Date.now()) / 1000));
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), remain * 1000);
      try {
        const r = await fetch(t.zifUrl, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length === probe.total && buf.subarray(0, 2).toString() === 'II') fullBuf = buf;
      } catch {
        throw new Error('整包下载超时');
      } finally {
        clearTimeout(timer);
      }
    }

    const tiff = await new RemoteBigTiff(t.zifUrl, fullBuf).init();
    tiff.label = t.slug + ': ';
    checkDeadline();
    const { level, latency, budget } = await chooseLevel(tiff);
    checkDeadline();
    if (budget < 3) throw new Error(`实测延迟 ${latency.toFixed(1)}s，${MAX_SECONDS}s 内不足以取层`);
    const offs = await tiff.array(level, 324);
    const counts = await tiff.array(level, 325);
    if (!offs || !counts) throw new Error('缺少 TileOffsets');
    const across = Math.ceil(level.w / level.tw);

    if (DRY) {
      const bytes = counts.reduce((a, b) => a + b, 0);
      report.requests += offs.length;
      report.bytes += bytes;
      report.items.push({ ...t, state: 'dry', level: `${level.w}x${level.h}`, tiles: offs.length, bytes, latency });
      await logLine(`${tag} [dry] ${t.kind} ${t.slug}: L${level.idx} ${level.w}×${level.h}, ${offs.length} tiles, ${(bytes / 1e6).toFixed(2)} MB, 估 ${(offs.length * latency / CONCURRENCY).toFixed(0)}s`);
      continue;
    }

    // 整包模式下无需 60s 瓦片限制；仍受整包下载超时保护
    workDir = path.join(TMP, t.slug);
    await fs.rm(workDir, { recursive: true, force: true });
    await fs.mkdir(workDir, { recursive: true });
    if (fullBuf) {
      tiff.requests = 1;
      tiff.bytes = fullBuf.length;
    }
    const index = await downloadTiles(tiff, level, offs, counts, across, workDir, fullBuf ? Infinity : deadline);
    await fs.writeFile(
      path.join(workDir, 'index.json'),
      JSON.stringify({ w: level.w, h: level.h, tw: level.tw, th: level.th, across, tiles: index.map(({ n, x, y, file }) => ({ n, x, y, file })) }),
      'utf8'
    );
    const stitched = await stitch(workDir, outPath, { w: level.w, h: level.h, tw: level.tw, th: level.th });
    const bytes = (await fs.stat(outPath)).size;
    bucket[t.slug] = {
      file: relFile, w: stitched.w, h: stitched.h, bytes,
      sha256: sha256(await fs.readFile(outPath)),
      sourceLevel: { index: level.idx, w: level.w, h: level.h },
      sourceZif: t.zifUrl, sourcePage: t.pageUrl,
      specimen: t.name, chapter: t.chapter, kind: t.kind, mode: fullBuf ? 'full-archive' : 'range-tiles',
      elapsedSeconds: Math.round((Date.now() - started) / 100) / 10,
      attribution: '© Histology Guide 及/或原始贡献者（经作者书面许可，非商业教育用途）',
      permission: 'docs/05-permission.md'
    };
    await fs.rm(workDir, { recursive: true, force: true });
    workDir = null;
    await saveManifest();
    report.ok++;
    report.requests += tiff.requests;
    report.bytes += tiff.bytes;
    report.items.push({ ...t, state: 'ok', level: `${level.w}x${level.h}`, tiles: offs.length, netBytes: tiff.bytes, fileBytes: bytes, seconds: (Date.now() - started) / 1000 });
    await logLine(`${tag} ✓ ${t.kind} ${t.slug}: L${level.idx} ${level.w}×${level.h}, ${offs.length} tiles, ${(tiff.bytes / 1e6).toFixed(2)} MB 网络 / ${(bytes / 1e6).toFixed(2)} MB 本地, ${Math.round((Date.now() - started) / 1000)}s`);
  } catch (e) {
    const isTimeout = /TIMEOUT|超时/.test(e.message);
    if (isTimeout) report.timeout++;
    else report.failed++;
    report.items.push({ ...t, state: isTimeout ? 'skipped-timeout' : 'error', error: String(e.message || e) });
    await logLine(`${tag} ${isTimeout ? '⏱ 跳过（超过 ' + MAX_SECONDS + 's）' : '✗'} ${t.slug}: ${e.message}`);
    if (workDir) { try { await fs.rm(workDir, { recursive: true, force: true }); } catch {} }
  }
}

await saveManifest();
await saveCache();
report.finishedAt = new Date().toISOString();
report.summary = {
  targets: report.targets, ok: report.ok, skipped: report.skipped,
  timeout: report.timeout, failed: report.failed,
  requests: report.requests, networkBytes: report.bytes,
  maxSeconds: MAX_SECONDS, concurrency: CONCURRENCY
};
await fs.writeFile(path.join(REPORT_DIR, 'images-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(`\n完成：成功 ${report.ok}，已有跳过 ${report.skipped}，超时跳过 ${report.timeout}，失败 ${report.failed}；请求 ${report.requests} 次，网络 ${(report.bytes / 1e6).toFixed(1)} MB`);
console.log('清单：data/local-images.json；报告：data/reports/images-report.json');
