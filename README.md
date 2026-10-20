# 组织学显微镜复习站 · Histology Guide 非官方中文学习改编版

以 [Histology Guide](https://histologyguide.com/) 的章节体系与标本编号为索引，构建的**非官方中文组织学复习站**。纯静态页面，可在线访问，也可双击在本地浏览器打开，不需要后端、数据库或账号。

> **许可与署名（重要）**
>
> Histology Guide 的 [Terms of Use](https://histologyguide.com/about-us/license.html) 默认禁止复制、展示、存储与系统性汇集其内容，其材料**不是公有领域**。
>
> **2026-10-20 已取得作者团队（T. Clark Brelje，Histology Guide Team）新的书面许可**：允许创建并**在 GitHub Pages 公开托管**所选教育内容的**非商业中文改编版**，条件是：全站清晰署名、链接回原页面、声明非官方且未获背书、不得去除/篡改版权声明与水印、遵从任何单独署名、保持非商业与免费访问、除 GitHub Pages 学习资源外不得再分发、发布后把 live URL 发给作者复核。此前 2026-10-18 的个人离线学习许可仍作为历史记录保留。
>
> 本站据此执行：中文要点/术语/自测为**独立编写**；所选图像的**中分辨率概览**公开托管并逐张署名、链接原页面；原站英文正文段落与测验题不复制。原始图像与文字版权归 **Histology Guide 及/或原始贡献者** 所有。**本站不用于出售、许可或其他商业利用；除本站外不得再分发其中保存的原始材料。** 许可原文与 8 条条件落实见 [docs/05-permission.md](docs/05-permission.md)、[docs/06-publication.md](docs/06-publication.md) 与站内 [来源与许可](site/sources.html) 页。

> **在线地址（已部署）**：<https://blog.acretiondisk.top/histology-guide-zh/>（GitHub Pages；`anacreationdisk9986.github.io` 项目地址不直接提供内容）
>
> **换新对话继续任务**：见项目根目录 [`RESTART-PROMPT.md`](RESTART-PROMPT.md)，内含可直接粘贴的提示词与当前状态快照。

## 快速开始

```powershell
# 1. 在线访问（推荐）
start https://blog.acretiondisk.top/histology-guide-zh/

# 2. 本地直接打开（离线可用）
start site\index.html

# 3. 或启动本地静态服务器
npx serve site
#    然后访问 http://localhost:3000
```

不需要安装任何 npm 依赖。若要在本机重新生成站点，需要 Node 18+；图像拼接需要 Python 3 + Pillow（本机运行时已自带）。

## 站点功能

| 页面 | 内容 |
| --- | --- |
| 首页 | 章节入口、总量统计、本地图像数量、最近学习、完成进度 |
| 章节目录 | 21 章按「细胞与基本组织 / 器官系统 / 鉴别练习」分组，进度条显示中文要点覆盖度 |
| 章节页 | 自编导语、复习重点、易混对比、逐小节要点、低倍/高倍识别顺序、标本卡片（本地概览图 + 中文名 + 原站编号 + 原站切片链接）、电镜清单、自编自测、完成标记 |
| 组织学图谱 | 347 张光镜切片 + 363 张电镜照片 + 18 幅示意图索引；光镜切片与示意图已全部本地化，可直接放大 |
| 术语表 | 中英双向搜索、7 类分类、按章筛选、待核验标记 |
| 复习模式 | 术语 / 自测题 / 标本识别三种抽认卡，易错本，键盘操作 |
| 来源与许可 | 非官方声明与统一署名句、8 条许可条件逐条落实、来源页 URL、抓取时间、HTTP 状态、SHA-256、**本地图像清单（含署名与来源页）**、线上地址与许可联系 |
| 使用说明 | 在线地址、本地启动方式、离线/在线功能对照、署名与许可、快捷键、已知限制、目录结构 |

其他：**每页顶部的全站署名栏与页脚署名**（非官方、未背书、© 归属、非商业、不得再分发）、深色/浅色主题（记忆偏好）、响应式（桌面 / 平板 / 手机）、键盘导航（`/` 搜索、`Esc` 关闭、空格翻卡）、图片点击放大（灯箱：滚轮/按钮/拖动）、学习进度与易错本存 `localStorage`。

## 内容规模

| 项目 | 数量 |
| --- | --- |
| 章节 | 21（1–8 细胞与基本组织，9–20 器官系统，21 组织鉴别练习） |
| 小节 | 152（中文要点 152/152 完成） |
| 光镜切片索引 | 347 |
| 电镜照片索引 | 363 |
| 示意图索引 | 18 |
| 中英术语 | 335（9 条标注“待核验”） |
| 自测题 | 186 |
| 标本中文命名 | 347/347 |
| 本地概览图（经许可公开托管） | **284 张**（266 张唯一切片 + 18 幅示意图；284/284 图像目标已完成，约 566.6 MB；详见 `data/local-images.json`） |
| 本地图像覆盖 | 284/728 张（39.0%，按图片张数）；实际覆盖 **365/728** 个图谱条目（**50.1%**，全部光镜切片与示意图条目，电镜 363 条仍在线） |

## 目录结构

```
├─ README.md
├─ NOTICE.md                   版权、许可与非官方声明（中英双语）
├─ docs/
│  ├─ 01-audit.md              第一阶段：站点审计与版权结论（历史快照）
│  ├─ 02-tech-plan.md          第二阶段：技术方案
│  ├─ 03-implementation-plan.md 实施计划与里程碑状态（含出版阶段）
│  ├─ 04-qa-report.md          验收与抽样检查报告
│  ├─ 05-permission.md         书面许可记录与执行边界（2026-10-18 / 2026-10-20）
│  ├─ 06-publication.md        出版记录、条件落实、线上验收清单与作者邮件草稿
│  ├─ content-schema.md        中文内容编写规范
│  └─ permission/              许可邮件截图（证据）
├─ .github/workflows/pages.yml GitHub Pages 部署（发布 site/）
├─ scripts/
│  ├─ fetch.mjs                元数据采集（限速 / 重试 / 缓存 / robots 检查）
│  ├─ scaffold.mjs             inventory 汇总 + 内容脚手架
│  ├─ check-content.mjs        中文内容与术语一致性校验
│  ├─ fetch-images.mjs         按许可下载所选图像的概览层级（限速 / 可增量）
│  ├─ stitch_tiles.py          本地瓦片拼接（Python + Pillow）
│  ├─ build.mjs                生成 site/ 静态站点（含全站署名栏、sitemap、404）
│  ├─ verify-site.mjs          Chrome CDP 真实浏览器验收（含全站署名/内链检查）
│  ├─ verify-live.mjs          GitHub Pages 线上验收（页面、sitemap、图片、404）
│  ├─ check-links.mjs          原站链接可用性抽查（可选，需网络）
│  └─ import-local-images.mjs  导入自备图片（备用，不走原站）
├─ data/
│  ├─ sources.json             采集页面清单
│  ├─ raw-meta/*.json          41 个页面元数据（含来源指纹）
│  ├─ inventory.json           章节 / 小节 / 标本总清单
│  ├─ local-images.json        本地图像清单（来源、层级、尺寸、SHA-256、署名）
│  └─ reports/                 采集、图像、内容校验、站点验收报告
├─ content/zh/
│  ├─ chapters/01–21.json      每章自编中文内容
│  ├─ terms.json               中英术语表
│  └─ _scaffold/               生成的小节与标本脚手架
└─ site/                       生成的静态站点（GitHub Pages 发布目录，含 images/ 概览图）
```

## 重新生成

```powershell
node scripts/fetch.mjs           # 1. 增量采集元数据（已成功页面自动跳过；--force 重抓）
node scripts/scaffold.mjs        # 2. 汇总 inventory，刷新内容脚手架
node scripts/check-content.mjs   # 3. 校验中文内容（error 必须为 0）
node scripts/fetch-images.mjs    # 4. 按许可下载所选图像（默认每章 1 张切片 + 全部示意图）
node scripts/build.mjs           # 5. 生成 site/（含 404、sitemap、.nojekyll）
node scripts/verify-site.mjs     # 6. 浏览器验收（需要本机 Chrome/Edge，--shots 可出截图）
git add -A; git commit -m "update"; git push    # 7. 推送到 main，GitHub Actions 自动发布 site/
node scripts/verify-live.mjs     # 8. 线上验收（29 页、sitemap、图片、404；结果写入 data/reports/）
```

图像采集是**可增量**的：已存在的图像会跳过；可用参数控制范围与分辨率，例如：

```powershell
node scripts/fetch-images.mjs --figures-only                 # 只补示意图
node scripts/fetch-images.mjs --slides-only --per-chapter=2  # 每章 2 张切片
node scripts/fetch-images.mjs --chapter=2 --all-slides --width=10000   # 第 2 章更高分辨率
node scripts/fetch-images.mjs --dry                          # 只统计请求数与体积
```

> 说明：原站单张切片金字塔可达数百 MB，脚本只按 HTTP Range 读取**一个中分辨率层级**的瓦片（约 4000–5200 px 宽），并限速、失败重试、单目标过慢时自动跳过。若原站响应变慢，请停一段时间再续跑（保护原站，也避免被限速）。

## 离线 / 在线

| 功能 | 离线 | 说明 |
| --- | --- | --- |
| 在线公开访问（GitHub Pages） | ❌ 需联网 | <https://blog.acretiondisk.top/histology-guide-zh/> |
| 章节要点、术语表、搜索、自测、抽认卡、进度、易错本 | ✅ | 数据内嵌在 `site/assets/data.js`，进度存浏览器 |
| 已下载的本地概览图（可放大） | ✅ | 经许可保存的中分辨率概览，见“来源与许可”页清单 |
| 电镜图像（363 张）、完整分辨率、结构标注 | ❌ 需联网 | 点击“原站切片”进入原站虚拟显微镜 |
| 原站 Quiz / Gallery / Index | ❌ 需联网 | 已在来源页保留入口 |

本站**不生成无效的本地图像控件**；所有“原站切片”按钮都指向真实存在的原站页面，每张本地图都带 © 署名与原页面链接。

## 部署与仓库

- **GitHub 仓库**：<https://github.com/AnAcretiondisk9986/histology-guide-zh>（公开仓库，仅用于发布本站）。
- **发布方式**：`.github/workflows/pages.yml` 在每次推送到 `main` 后，把 `site/` 作为 Pages 构件发布（不需要 `gh-pages` 分支）。
- **仓库包含**：源码、数据、`content/`、以及 `site/`（含 `site/images/` 的 284 张经许可概览图，约 566.6 MB）。
- **再分发限制**：仓库公开是为了让 GitHub Pages 能提供站点，**不代表授权**克隆、镜像、打包或再分发其中的图像与内容；除本站外使用须另行取得作者书面许可。

## 已知限制

详见 [使用说明](site/help.html)。要点：

- 本地图像是**中分辨率概览**（非完整切片），高倍与标注需在线；这是刻意设计，避免“用缩略图冒充完整切片”。
- 公开托管已获作者 2026-10-20 书面许可，但**仅限非商业教育用途并免费访问**；不得出售、许可或其他商业利用，不得在本站之外再分发。
- 术语释义为自编，个别条目“待核验”，以人卫版《组织学与胚胎学》为准。
- 第 20 章原站电镜页本身为空，第 21 章原站无电镜页。
- 原站英文正文、测验题、关键词索引未采集。

## 许可

- **原站图像与文字**：© **Histology Guide 及/或原始贡献者**，不是公有领域。经作者团队 2026-10-20 书面许可（此前 2026-10-18 另有个人离线学习许可），本站作为**非商业中文学习改编版**公开托管于 GitHub Pages；每张图保留 © 署名与原页面链接；不得去除/篡改版权声明、水印或来源署名；不得出售、许可或其他商业利用；除本站外不得再分发。若某材料另有单独作者/机构署名，须遵从该署名并另行取得许可。证据见 [docs/05-permission.md](docs/05-permission.md)、[docs/permission/](docs/permission/) 与 [NOTICE.md](NOTICE.md)。
- **本站自编内容**（中文要点、术语释义、自测题、代码与页面）：由本项目编写，可自由用于个人学习；转载时请保留非官方声明与原站署名链接。
- **如需扩大使用范围**（商业使用、在 GitHub Pages 之外再分发、更高分辨率批量获取等），必须另行取得作者书面许可：`tcbrelje@gmail.com`。

