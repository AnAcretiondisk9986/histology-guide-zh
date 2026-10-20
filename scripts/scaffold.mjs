#!/usr/bin/env node
/**
 * 将 data/raw-meta/*.json 汇总为 data/inventory.json，
 * 并为中文内容编写生成“脚手架”文件（含小节、标本清单），
 * 以保证中文小节名与标本名能精确对应原站条目。
 *
 * 用法：node scripts/scaffold.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const META = path.join(ROOT, 'data', 'raw-meta');
const SCAFFOLD = path.join(ROOT, 'content', 'zh', '_scaffold');
const SOURCES = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'sources.json'), 'utf8'));

await fs.mkdir(SCAFFOLD, { recursive: true });
const files = await fs.readdir(META);

const byKey = new Map();
for (const f of files) {
  const d = JSON.parse(await fs.readFile(path.join(META, f), 'utf8'));
  byKey.set(`${d.pageType}:${d.chapter}`, d);
}

const chapters = [];
const captionIndex = new Map();
const sectionIndex = new Map();

for (const src of SOURCES.chapters) {
  const sb = byKey.get(`slidebox:${src.n}`);
  const em = byKey.get(`em:${src.n}`);
  if (!sb) continue;

  const sections = [];
  const seen = new Set();
  for (const h of sb.headings) {
    if (h.level < 3) continue;
    if (seen.has(h.text)) continue;
    seen.add(h.text);
    sections.push({ en: h.text, id: h.id });
  }

  const specimens = sb.items.map((it) => ({
    kind: it.kind,
    name: it.name,
    caption: it.caption || '',
    stain: it.stain || '',
    href: it.href,
    section: it.section || null
  }));

  const emItems = (em?.items || []).map((it) => ({
    kind: it.kind,
    name: it.name,
    caption: it.caption || '',
    technique: it.stain || '',
    href: it.href,
    section: it.section || null
  }));

  const chapter = {
    n: src.n,
    slug: src.slug,
    titleEn: src.en,
    group: src.group,
    slideboxUrl: sb.source.url,
    slideboxFetchedAt: sb.source.fetchedAt,
    slideboxSha256: sb.source.sha256,
    slideboxHttpStatus: sb.source.httpStatus,
    emUrl: em?.source?.url || null,
    emFetchedAt: em?.source?.fetchedAt || null,
    emSha256: em?.source?.sha256 || null,
    emHttpStatus: em?.source?.httpStatus ?? null,
    sectionCount: sections.length,
    sections,
    specimens,
    emItems,
    counts: {
      slides: specimens.filter((s) => s.kind === 'slide').length,
      figures: specimens.filter((s) => s.kind === 'figure').length,
      em: emItems.length
    }
  };
  chapters.push(chapter);

  for (const it of specimens) {
    if (it.caption) {
      const k = it.caption;
      const rec = captionIndex.get(k) || { caption: k, chapters: new Set(), count: 0 };
      rec.chapters.add(src.n);
      rec.count++;
      captionIndex.set(k, rec);
    }
  }
  for (const s of sections) {
    const rec = sectionIndex.get(s.en) || { en: s.en, chapters: new Set() };
    rec.chapters.add(src.n);
    sectionIndex.set(s.en, rec);
  }

  // 单章脚手架：给内容作者填写中文
  const scaffold = {
    schema: 1,
    n: src.n,
    titleEn: src.en,
    group: src.group,
    originalPage: sb.source.url,
    note: '此文件由 scripts/scaffold.mjs 生成，仅供内容编写参考；请把中文写入 content/zh/chapters/NN.json，不要修改本文件。',
    sections: sections.map((s) => {
      const items = specimens.filter((it) => it.section === s.en);
      return {
        en: s.en,
        specimenCount: items.length,
        specimenNames: items.map((it) => it.name)
      };
    }),
    specimens: specimens.map((s) => ({
      name: s.name,
      caption: s.caption,
      stain: s.stain,
      kind: s.kind,
      section: s.section,
      href: s.href
    })),
    emItems: emItems.map((s) => ({
      name: s.name,
      caption: s.caption,
      technique: s.technique,
      section: s.section,
      href: s.href
    }))
  };
  await fs.writeFile(
    path.join(SCAFFOLD, `chapter-${String(src.n).padStart(2, '0')}.json`),
    JSON.stringify(scaffold, null, 2) + '\n',
    'utf8'
  );
}

const inventory = {
  schema: 1,
  generatedAt: new Date().toISOString(),
  sourceSite: SOURCES.site,
  license: '内容版权归 T. Clark Brelje 与 Robert L. Sorenson 所有；本项目仅保存导航元数据，见 docs/01-audit.md',
  totals: {
    chapters: chapters.length,
    slides: chapters.reduce((a, c) => a + c.counts.slides, 0),
    figures: chapters.reduce((a, c) => a + c.counts.figures, 0),
    emPhotos: chapters.reduce((a, c) => a + c.counts.em, 0),
    sections: chapters.reduce((a, c) => a + c.sectionCount, 0)
  },
  chapters
};
await fs.writeFile(path.join(ROOT, 'data', 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n', 'utf8');

const captions = [...captionIndex.values()]
  .map((c) => ({ caption: c.caption, count: c.count, chapters: [...c.chapters].sort((a, b) => a - b) }))
  .sort((a, b) => b.count - a.count || a.caption.localeCompare(b.caption));
await fs.writeFile(
  path.join(SCAFFOLD, 'caption-index.json'),
  JSON.stringify({ schema: 1, note: '原站卡片中的“鉴定短语”词频表，可作为术语表候选', count: captions.length, captions }, null, 2) + '\n',
  'utf8'
);

const sectionList = [...sectionIndex.values()]
  .map((s) => ({ en: s.en, chapters: [...s.chapters].sort((a, b) => a - b) }))
  .sort((a, b) => a.en.localeCompare(b.en));
await fs.writeFile(
  path.join(SCAFFOLD, 'section-index.json'),
  JSON.stringify({ schema: 1, count: sectionList.length, sections: sectionList }, null, 2) + '\n',
  'utf8'
);

console.log('inventory totals:', inventory.totals);
console.log('distinct captions:', captions.length, '| distinct section titles:', sectionList.length);
