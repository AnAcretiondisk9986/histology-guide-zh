#!/usr/bin/env node
/**
 * 可选工具：把“用户自备且已获授权”的显微图片接入站点。
 *
 * 背景：原站使用条款不允许复制/展示其图像，因此项目默认不含任何图像。
 * 若你（1）自己拍摄/拥有图片，或（2）已取得 Histology Guide 作者书面许可，
 * 可用本脚本把图片放入 site/images/ 并在构建后显示缩略图 + 放大查看。
 *
 * 用法：
 *   node scripts/import-local-images.mjs <图片目录> [--overwrite]
 *
 * 文件名匹配规则：文件名（去掉扩展名）规范化后包含标本 slug 即视为匹配。
 *   MH-016-simple-epithelia.jpg            → /slideview/MH-016-simple-epithelia/...
 *   mh_016_simple_epithelia.png            → 同上（忽略大小写与分隔符）
 *   EM-072-mesothelium.jpg                 → /EM-view/EM-072-mesothelium/...
 *
 * 输出：site/images/<slug>.<ext> + data/local-images.json
 */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SITE = path.join(ROOT, 'site');
const OVERWRITE = process.argv.includes('--overwrite');
const srcDir = process.argv.find((a) => !a.startsWith('--') && a !== process.argv[0] && a !== process.argv[1]);

if (!srcDir) {
  console.error('用法：node scripts/import-local-images.mjs <图片目录> [--overwrite]');
  process.exit(1);
}

const inventory = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'inventory.json'), 'utf8'));
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');

/** slug → 标本信息 */
const slugMap = new Map();
for (const c of inventory.chapters) {
  for (const sp of [...c.specimens, ...c.emItems]) {
    const m = /^\/(?:slideview|EM-view|figureview)\/([^/]+)\//.exec(sp.href || '');
    if (!m) continue;
    const key = norm(m[1]);
    if (!slugMap.has(key)) slugMap.set(key, { slug: m[1], name: sp.name, chapter: c.n, kind: sp.kind });
  }
}

const IMG_RE = /\.(jpe?g|png|webp|gif|avif)$/i;
const entries = await fs.readdir(srcDir, { withFileTypes: true });
const imagesOut = path.join(SITE, 'images');
await fs.mkdir(imagesOut, { recursive: true });

const manifest = { schema: 1, importedAt: new Date().toISOString(), note: '用户自备/已授权图片；默认不存在此文件', slides: {} };
const matched = [];
const unmatched = [];

for (const ent of entries) {
  if (!ent.isFile() || !IMG_RE.test(ent.name)) continue;
  const base = norm(ent.name.replace(IMG_RE, ''));
  // 允许文件名带额外前缀/后缀：找最长匹配 slug
  let hit = null;
  for (const [key, val] of slugMap) {
    if (base === key) { hit = val; break; }
    if (!hit && (base.includes(key) || key.includes(base)) && key.length > 6) hit = val;
  }
  if (!hit) { unmatched.push(ent.name); continue; }

  const ext = path.extname(ent.name).toLowerCase();
  const destName = `${hit.slug}${ext}`;
  const dest = path.join(imagesOut, destName);
  const srcPath = path.join(srcDir, ent.name);
  const bytes = await fs.readFile(srcPath);
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');

  let exists = false;
  try { await fs.access(dest); exists = true; } catch {}
  if (exists && !OVERWRITE) {
    unmatched.push(`${ent.name}（目标已存在，跳过；用 --overwrite 覆盖）`);
    continue;
  }
  await fs.writeFile(dest, bytes);
  manifest.slides[hit.slug] = {
    file: `images/${destName}`,
    bytes: bytes.length,
    sha256: sha,
    specimen: hit.name,
    chapter: hit.chapter,
    kind: hit.kind,
    source: 'user-provided'
  };
  matched.push({ from: ent.name, to: destName, specimen: hit.name });
}

await fs.writeFile(
  path.join(ROOT, 'data', 'local-images.json'),
  JSON.stringify(manifest, null, 2) + '\n',
  'utf8'
);

console.log(`导入 ${matched.length} 张图片到 site/images/`);
for (const m of matched) console.log(`  ${m.from} → ${m.to}  (${m.specimen})`);
if (unmatched.length) {
  console.log(`\n未匹配 ${unmatched.length} 个文件：`);
  for (const u of unmatched.slice(0, 20)) console.log('  -', u);
}
console.log('\n清单：data/local-images.json；请重新运行 node scripts/build.mjs 使站点显示图片。');
console.log('注意：只导入你有权使用的图片；本项目不会下载原站图像。');
