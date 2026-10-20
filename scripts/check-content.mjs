#!/usr/bin/env node
/**
 * 校验 content/zh 下的中文内容是否符合 docs/content-schema.md，并与 data/inventory.json 对齐。
 * 用法：node scripts/check-content.mjs [--strict]
 * 退出码：0 = 无 error；1 = 存在 error。
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const STRICT = process.argv.includes('--strict');
const ZH = (p) => path.join(ROOT, 'content', 'zh', p);

const inventory = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'inventory.json'), 'utf8'));
const invByN = new Map(inventory.chapters.map((c) => [c.n, c]));

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push({ where, msg });
const warn = (where, msg) => warnings.push({ where, msg });

const GROUPS = new Set(['cells-tissues', 'organ-systems', 'quiz']);
const HTML = /<[a-z/][^>]*>/i;
const URL = /https?:\/\//i;

function textOf(v) {
  return typeof v === 'string' ? v : '';
}
function plain(s) {
  return textOf(s).trim();
}
function checkPlain(where, field, value, min, max, { optional = false } = {}) {
  const s = plain(value);
  if (!s) {
    if (!optional) err(where, `${field} 缺失`);
    return;
  }
  if (HTML.test(s)) err(where, `${field} 含 HTML 标签`);
  if (URL.test(s)) err(where, `${field} 含链接，应由站点生成器拼接`);
  if (s.length < min) err(where, `${field} 过短（${s.length} < ${min}）：${s.slice(0, 20)}…`);
  if (max && s.length > max) warn(where, `${field} 过长（${s.length} > ${max}）：${s.slice(0, 20)}…`);
}

// ---------- 章节 ----------
const present = new Set();
const chapterTermPairs = [];
for (let n = 1; n <= 21; n++) {
  const file = ZH(`chapters/${String(n).padStart(2, '0')}.json`);
  const where = `chapters/${String(n).padStart(2, '0')}.json`;
  let doc;
  try {
    doc = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (e) {
    err(where, '文件缺失或 JSON 解析失败');
    continue;
  }
  present.add(n);
  const inv = invByN.get(n);
  if (!inv) {
    err(where, 'inventory 中无此章');
    continue;
  }
  if (doc.schema !== 1) err(where, 'schema 必须为 1');
  if (doc.n !== n) err(where, `n 与文件名不一致：${doc.n}`);
  if (doc.group !== inv.group) err(where, `group 不一致：${doc.group} != ${inv.group}`);
  if (doc.titleEn !== inv.titleEn) err(where, `titleEn 不一致：${doc.titleEn} != ${inv.titleEn}`);
  checkPlain(where, 'titleZh', doc.titleZh, 2, 12);
  checkPlain(where, 'guide', doc.guide, 110, 260);

  if (!Array.isArray(doc.examFocus) || doc.examFocus.length < 3 || doc.examFocus.length > 6)
    err(where, 'examFocus 需 3–6 条');
  else doc.examFocus.forEach((x, i) => checkPlain(where, `examFocus[${i}]`, x, 8, 60));

  // 小节必须与 inventory 完全一致（第 21 章原站无 h3 小节，允许空数组）
  const invSections = inv.sections.map((s) => s.en);
  const invSet = new Set(invSections);
  const docSections = Array.isArray(doc.sections) ? doc.sections : [];
  if (!docSections.length && invSections.length > 0) err(where, 'sections 为空');
  const seen = new Set();
  for (const [i, s] of docSections.entries()) {
    const w = `${where} sections[${i}]`;
    if (!invSet.has(s.en)) err(w, `en 不在原站小节清单中：“${s.en}”`);
    else if (seen.has(s.en)) err(w, `en 重复：“${s.en}”`);
    seen.add(s.en);
    checkPlain(w, 'zh', s.zh, 2, 20);
    if (!Array.isArray(s.notes) || s.notes.length < 2 || s.notes.length > 5)
      err(w, 'notes 需 2–5 条');
    else s.notes.forEach((x, k) => checkPlain(w, `notes[${k}]`, x, 15, 80));
    if (!s.identify) err(w, 'identify 缺失');
    else {
      checkPlain(w, 'identify.low', s.identify.low, 8, 60);
      checkPlain(w, 'identify.high', s.identify.high, 8, 60);
    }
    if (s.pitfall) checkPlain(w, 'pitfall', s.pitfall, 6, 80, { optional: true });
  }
  const missing = invSections.filter((x) => !seen.has(x));
  if (missing.length) warn(where, `未覆盖小节 ${missing.length}/${invSections.length}：${missing.slice(0, 6).join(' | ')}`);

  // 标本中文名
  const need = inv.specimens.filter((s) => s.kind === 'slide').map((s) => s.name);
  const map = doc.specimenZh && typeof doc.specimenZh === 'object' ? doc.specimenZh : {};
  const missingSpec = need.filter((name) => !map[name] || !plain(map[name].zh));
  if (missingSpec.length)
    warn(where, `未命名标本 ${missingSpec.length}/${need.length}：${missingSpec.slice(0, 5).join(' | ')}`);
  for (const [name, v] of Object.entries(map)) {
    if (!need.includes(name)) warn(`${where} specimenZh`, `标本名不在本章清单中：“${name}”`);
    else if (!plain(v && v.zh)) err(`${where} specimenZh`, `“${name}” 缺少 zh`);
    else checkPlain(`${where} specimenZh`, name, v.zh, 2, 30);
  }

  if (doc.confusions && !Array.isArray(doc.confusions)) err(where, 'confusions 必须为数组');
  if (Array.isArray(doc.confusions) && doc.confusions.length > 3) warn(where, 'confusions 建议 ≤3 条');

  if (!Array.isArray(doc.quiz) || doc.quiz.length < 6) err(where, 'quiz 至少 6 题');
  else {
    doc.quiz.forEach((q, i) => {
      checkPlain(where, `quiz[${i}].q`, q.q, 6, 120);
      checkPlain(where, `quiz[${i}].a`, q.a, 1, 160);
      if (!['识别', '概念', '对比'].includes(q.tag)) err(`${where} quiz[${i}]`, `tag 非法：${q.tag}`);
    });
  }

  if (!Array.isArray(doc.terms) || doc.terms.length < 5) err(where, 'terms 至少 5 条');
  else {
    for (const [i, t] of doc.terms.entries()) {
      checkPlain(where, `terms[${i}].en`, t.en, 2, 60);
      checkPlain(where, `terms[${i}].zh`, t.zh, 1, 30);
      if (plain(t.en) && plain(t.zh)) chapterTermPairs.push({ n, en: plain(t.en).toLowerCase(), zh: plain(t.zh), where });
    }
  }

  if (!Array.isArray(doc.unverified)) err(where, 'unverified 必须为数组（可为空）');
}

// ---------- 术语表 ----------
const CATS = new Set(['组织', '细胞', '细胞器', '细胞外基质', '器官结构', '染色与技术', '其他']);
let terms = [];
const termsFile = ZH('terms.json');
try {
  const doc = JSON.parse(await fs.readFile(termsFile, 'utf8'));
  if (doc.schema !== 1) err('terms.json', 'schema 必须为 1');
  terms = Array.isArray(doc.terms) ? doc.terms : [];
  if (!terms.length) err('terms.json', 'terms 为空');
} catch {
  err('terms.json', '文件缺失或 JSON 解析失败');
}

const termIds = new Set();
const termEns = new Map();
for (const [i, t] of terms.entries()) {
  const w = `terms.json[${i}]`;
  checkPlain(w, 'id', t.id, 2, 80);
  checkPlain(w, 'zh', t.zh, 1, 30);
  checkPlain(w, 'en', t.en, 2, 80);
  checkPlain(w, 'definition', t.definition, 20, 140);
  if (!CATS.has(t.category)) err(w, `category 非法：${t.category}`);
  if (typeof t.verified !== 'boolean') err(w, 'verified 必须为布尔值');
  if (!Array.isArray(t.chapters) || !t.chapters.length) err(w, 'chapters 至少 1 项');
  else
    for (const c of t.chapters) if (!invByN.has(c)) err(w, `chapters 含无效章号：${c}`);
  if (t.aliases && !Array.isArray(t.aliases)) err(w, 'aliases 必须为数组');
  if (termIds.has(t.id)) err(w, `id 重复：${t.id}`);
  termIds.add(t.id);
  const key = plain(t.en).toLowerCase();
  if (termEns.has(key)) err(w, `en 重复：${t.en}`);
  else termEns.set(key, t);
}

// 章节术语与术语表一致性（术语表为准）
let mismatches = 0;
for (const p of chapterTermPairs) {
  const t = termEns.get(p.en);
  if (!t) {
    warn(p.where, `术语表中缺少：“${p.en}”`);
    continue;
  }
  if (plain(t.zh) !== p.zh) {
    mismatches++;
    warn(p.where, `译名与术语表不一致：“${p.en}” 章节=${p.zh} 术语表=${t.zh}`);
  }
}

const unverified = terms.filter((t) => t.verified === false).length;
const report = {
  checkedAt: new Date().toISOString(),
  strict: STRICT,
  chaptersPresent: [...present].sort((a, b) => a - b),
  chaptersMissing: Array.from({ length: 21 }, (_, i) => i + 1).filter((n) => !present.has(n)),
  terms: { total: terms.length, unverified, mismatches },
  errors: errors.length,
  warnings: warnings.length,
  errorList: errors,
  warningList: warnings.slice(0, 200)
};
await fs.mkdir(path.join(ROOT, 'data', 'reports'), { recursive: true });
await fs.writeFile(path.join(ROOT, 'data', 'reports', 'content-check.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');

console.log(`章节文件：${present.size}/21 | 术语：${terms.length}（待核验 ${unverified}）| 术语不一致 ${mismatches}`);
if (errors.length) {
  console.log(`\n错误 ${errors.length} 条：`);
  for (const e of errors.slice(0, 40)) console.log(`  [E] ${e.where}: ${e.msg}`);
}
if (warnings.length) {
  console.log(`\n警告 ${warnings.length} 条（显示前 20）：`);
  for (const w of warnings.slice(0, 20)) console.log(`  [W] ${w.where}: ${w.msg}`);
}
console.log('\n报告：data/reports/content-check.json');
process.exit(errors.length || (STRICT && warnings.length) ? 1 : 0);
