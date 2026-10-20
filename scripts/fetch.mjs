#!/usr/bin/env node
/**
 * Histology Guide 中文学习层 —— 元数据采集器（可增量、可恢复、限速、遵守 robots）
 *
 * 合规边界（见 docs/01-audit.md）：
 *  - 仅采集“导航所需的最小元数据”：章节标题、小节标题、标本编号/名称、鉴定短语、染色名、原始 URL。
 *  - 不保存原站正文段落、不下载图片、不抓取 /slides 高清瓦片、不保存测验题目。
 *  - 每个页面记录 URL、抓取时间、响应字节数、响应 sha256，用于证明“何时处理过该页”。
 *  - 页面 HTML 只在内存中解析，解析后即丢弃（--dump-raw 仅供开发排查，仅对显式指定单页启用）。
 *
 * 用法：
 *   node scripts/fetch.mjs                 # 增量：跳过已成功页面
 *   node scripts/fetch.mjs --force         # 全部重抓
 *   node scripts/fetch.mjs --only=2,3      # 只抓第 2、3 章
 *   node scripts/fetch.mjs --type=em       # 只抓电镜章节
 *   node scripts/fetch.mjs --delay=2000    # 自定义间隔（毫秒）
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const META_DIR = path.join(ROOT, 'data', 'raw-meta');
const REPORT_DIR = path.join(ROOT, 'data', 'reports');
const SOURCES = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'sources.json'), 'utf8'));

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, dflt = null) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};

const FORCE = flag('force');
const DELAY = Number(opt('delay', 1600));
const ONLY = (opt('only', '') || '')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter(Boolean);
const TYPE = opt('type', 'all');
const DUMP = opt('dump-raw', null);

const ORIGIN = SOURCES.site;
const DISALLOWED = SOURCES.disallowedPrefixes;
const UA =
  'HistologyGuideCNStudyIndex/0.1 (+personal non-commercial study index; metadata extraction only; contact: local user)';

/** robots 前缀检查：只允许 robots.txt 未禁止的路径 */
function robotsAllowed(pathname) {
  return !DISALLOWED.some((p) => pathname === p || pathname.startsWith(p.endsWith('/') ? p : p + '/'));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/**
 * 解析章节页：返回 { headings, items }
 * items 只保留定位与命名信息（编号、名称、鉴定短语、染色、原站链接），不保留正文段落。
 */
function parseChapterPage(html, pageType) {
  // 去掉 HTML 注释，避免把被注释掉的段落当成结构
  const clean = html.replace(/<!--[\s\S]*?-->/g, '');

  const h2 = /<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(clean);

  // 标题：h2 章节 / h3 小节 / h4 子小节（保留层级与锚点）
  const headings = [];
  for (const m of clean.matchAll(/<h([234])(?:\s+id="([^"]*)")?[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    headings.push({ level: Number(m[1]), id: m[2] || null, text: stripTags(m[3]) });
  }

  // 卡片按起始位置切片解析（卡片之间不嵌套），避免正则跨卡片截断
  const startRe = /<div\b[^>]*class="fb-list-item"[^>]*>/g;
  const starts = [...clean.matchAll(startRe)].map((m) => m.index);
  const h3Positions = [...clean.matchAll(/<h[34](?:\s+id="[^"]*")?[^>]*>[\s\S]*?<\/h[34]>/gi)].map(
    (m) => ({ at: m.index, text: stripTags(m[0].replace(/<[^>]*>/g, ' ')) })
  );

  const sectionAt = (pos) => {
    let cur = null;
    for (const h of h3Positions) {
      if (h.at < pos) cur = h.text;
      else break;
    }
    return cur;
  };

  const items = [];
  for (const [i, start] of starts.entries()) {
    const end = i + 1 < starts.length ? starts[i + 1] : clean.length;
    const chunk = clean.slice(start, end);

    const linkM = /<div class="fb-list-name">\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(chunk);
    if (!linkM) continue;
    const href = linkM[1];
    let kind = 'other';
    if (href.startsWith('/slideview/')) kind = 'slide';
    else if (href.startsWith('/EM-view/')) kind = 'em';
    else if (href.startsWith('/figureview/')) kind = 'figure';

    const texts = [...chunk.matchAll(/<div class="fb-list-text">([\s\S]*?)<\/div>/g)].map((x) =>
      stripTags(x[1])
    );
    const img = /<img[^>]*src="([^"]+)"[^>]*>/i.exec(chunk);

    // 鉴定短语与染色名的位置不固定（有的卡片只有一个“H&E”），先存原文再判断
    const stainLike = /^(H\s*&\s*E|H&E|azan|wright'?s?|pas|pas-?hematoxylin|verhoeff|aldehyde fuchsin|toluidine blue|phosphotungstic|ptA|golgi|cajal|silver|osmium|orcein|masson|trichrome|reticulin|iron|prussian|sudan|nile|methyl|giemsa|leishman|peroxidase|atpase|lectin|immuno|fluorescence|frozen|ground|decalcified|maceration|injection|corrosion)/i;
    let caption = '';
    let stain = '';
    if (texts.length >= 2) {
      caption = texts[0];
      stain = texts[1];
    } else if (texts.length === 1) {
      if (stainLike.test(texts[0])) stain = texts[0];
      else caption = texts[0];
    }

    items.push({
      kind,
      name: stripTags(linkM[2]),
      caption,
      stain,
      texts,
      href,
      // 仅记录原站缩略图路径用于标识，不下载
      thumbPath: img ? img[1] : null,
      section: sectionAt(start)
    });
  }

  return {
    pageType,
    pageTitle: h2 ? stripTags(h2[1]) : null,
    headings,
    items,
    // 只记录“原站是否提供导语段落”，不保存文本
    hasIntroProse: /<p\b/.test(clean.slice(clean.indexOf('<h2'), clean.indexOf('<h2') + 6000))
  };
}

async function fetchPage(url) {
  const u = new URL(url);
  if (!robotsAllowed(u.pathname)) throw new Error(`robots.txt 禁止抓取：${u.pathname}`);

  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const t0 = Date.now();
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'text/html' },
        redirect: 'follow'
      });
      const html = await res.text();
      return {
        status: res.status,
        ok: res.ok,
        html,
        bytes: Buffer.byteLength(html, 'utf8'),
        sha256: sha256(html),
        ms: Date.now() - t0,
        finalUrl: res.url
      };
    } catch (e) {
      lastErr = e;
      await sleep(900 * attempt);
    }
  }
  throw lastErr;
}

async function main() {
  await fs.mkdir(META_DIR, { recursive: true });
  await fs.mkdir(REPORT_DIR, { recursive: true });

  const targets = [];
  for (const ch of SOURCES.chapters) {
    if (ONLY.length && !ONLY.includes(ch.n)) continue;
    if (TYPE === 'all' || TYPE === 'slidebox') {
      targets.push({ kind: 'slidebox', n: ch.n, slug: ch.slug, url: `${ORIGIN}/slidebox/${ch.slug}.html` });
    }
    if (TYPE === 'all' || TYPE === 'em') {
      if (ch.em === false) continue; // 原站无该章电镜页
      targets.push({ kind: 'em', n: ch.n, slug: ch.slug, url: `${ORIGIN}/EM-atlas/${ch.slug}.html` });
    }
  }

  const report = { startedAt: new Date().toISOString(), targets: [], summary: {} };
  let fetched = 0;
  let skipped = 0;
  let failed = 0;

  for (const [i, t] of targets.entries()) {
    const outPath = path.join(META_DIR, `${t.kind}-${t.slug}.json`);
    const entry = { ...t, outPath: path.relative(ROOT, outPath) };
    try {
      if (!FORCE) {
        try {
          const prev = JSON.parse(await fs.readFile(outPath, 'utf8'));
          if (prev?.source?.url === t.url && prev?.items) {
            entry.state = 'skipped-cached';
            entry.prevFetchedAt = prev.source.fetchedAt;
            entry.itemCount = prev.items.length;
            skipped++;
            report.targets.push(entry);
            continue;
          }
        } catch {
          /* 无缓存，继续抓取 */
        }
      }

      const page = await fetchPage(t.url);
      if (DUMP) await fs.writeFile(path.join(ROOT, '.tmp', path.basename(DUMP)), page.html, 'utf8');

      let meta;
      if (/<h2>\s*Page Not Found|<title>\s*404/i.test(page.html)) {
        entry.state = 'not-found';
        entry.status = page.status;
        failed++;
        report.targets.push(entry);
        continue;
      }
      meta = parseChapterPage(page.html, t.kind);

      const record = {
        schema: 1,
        source: {
          url: t.url,
          finalUrl: page.finalUrl,
          fetchedAt: new Date().toISOString(),
          httpStatus: page.status,
          bytes: page.bytes,
          sha256: page.sha256,
          userAgent: UA,
          note: '仅保存导航元数据；正文段落与图片未保存，遵循原站使用条款'
        },
        chapter: t.n,
        pageType: t.kind,
        pageTitle: meta.pageTitle,
        hasIntroProse: meta.hasIntroProse,
        headings: meta.headings,
        items: meta.items
      };
      await fs.writeFile(outPath, JSON.stringify(record, null, 2) + '\n', 'utf8');

      entry.state = 'ok';
      entry.status = page.status;
      entry.bytes = page.bytes;
      entry.itemCount = meta.items.length;
      entry.headings = meta.headings.length;
      fetched++;
      console.log(
        `[${i + 1}/${targets.length}] ${t.kind} ch${t.n} ok: ${meta.items.length} items, ${meta.headings.length} sections (${page.bytes} B)`
      );
    } catch (e) {
      entry.state = 'error';
      entry.error = String(e && e.message ? e.message : e);
      failed++;
      console.error(`[${i + 1}/${targets.length}] ${t.kind} ch${t.n} FAILED: ${entry.error}`);
    }
    report.targets.push(entry);
    await sleep(DELAY); // 限速：避免给原站造成负担
  }

  report.finishedAt = new Date().toISOString();
  report.summary = { total: targets.length, fetched, skipped, failed, delayMs: DELAY };
  await fs.writeFile(
    path.join(REPORT_DIR, 'fetch-report.json'),
    JSON.stringify(report, null, 2) + '\n',
    'utf8'
  );
  console.log(`\n完成：抓取 ${fetched}，跳过 ${skipped}，失败 ${failed}（间隔 ${DELAY}ms）`);
  console.log('报告：data/reports/fetch-report.json');
}

await main();
