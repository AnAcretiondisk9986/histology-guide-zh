# 第一阶段审计报告：Histology Guide 站点结构与采集可行性

> **2026-10-20 许可更新注记**
>
> 本文档第 6 节（默认条款分析）与第 9 节（2026-10-18 私有许可）的版权结论是**历史快照**，记录的是当时的条款与许可范围。2026-10-20 Histology Guide 作者团队另行授予「在 GitHub Pages 公开托管非商业中文改编版」的许可，附 8 条条件。
>
> 涉及**公开发布**的版权与许可判断，现以 `docs/05-permission.md` **第 9 节**为准；本文档保留原样，用于追溯当时的审计依据。

- 审计时间：2026-10-18（UTC+8）
- 审计对象：https://histologyguide.com/
- 审计方式：直接 HTTP 抓取 + 页面结构分析（未使用浏览器自动化大规模遍历）
- 审计产出：页面清单（`data/inventory.json`）、41 个章节页元数据（`data/raw-meta/`）、版权结论、采集方案

---

## 1. 结论摘要

| 项目 | 结果 |
| --- | --- |
| 站点可访问性 | 正常，HTTP 200；无登录、无付费墙、无地域限制 |
| 站点规模（本次审计） | 21 个章节（含 1 个鉴别练习章）；21 个光镜章节页 + 20 个电镜章节页 |
| 可导航条目 | 347 张光镜切片索引、363 张电镜照片索引、18 幅示意图、152 个小节 |
| 技术栈 | 静态 HTML + CSS + JavaScript；虚拟显微镜为前端放大组件（切片瓦片） |
| robots.txt | 禁止 `/assets /css /js /EMs /figures /slides /atlas-of-human-histology`，其余可访问 |
| 使用条款 | **明确禁止复制、展示、存储、制作衍生作品，以及“系统性检索内容以建立集合/数据库/目录”** |
| 采集决策 | 仅采集导航元数据（标题、编号、名称、染色、URL），**不采集正文段落、图片、切片、测验题** |
| 图像策略 | 不本地保存、不嵌入热链，仅提供原站深链；需网络在线查看 |

> 关键判断：原站条款同时禁止“复制/展示/存储/衍生”和“系统性汇集”，因此“把全站英文翻译成本地中文副本”在本项目授权范围内**不可行**。可行的合规方案是构建“中文学习层”：自编术语、要点、自测与进度，加上指向原站的图像入口。本报告第 6 节给出完整依据。

---

## 2. 站点信息架构

### 2.1 一级入口

| 入口 | URL | 类型 | 说明 |
| --- | --- | --- | --- |
| Home | `/` | 静态内容页 | 使命、历史、12 幅代表图（`/imgs/*.jpg`） |
| Slide Box | `/slidebox/slidebox.html` | 章节索引 | 21 章入口（1–20 章 + 21 鉴别练习） |
| Gallery | `/gallery/gallery.html` | 图库索引 | 20 个按章图库（`/galleryview/<slug>.html`） |
| Electron Microscopy | `/EM-atlas/EM-atlas.html` | 电镜索引 | 20 个电镜章节（无第 21 章） |
| Quiz | `/quizzes/quizzes.html` | 测验索引 | 仅第 1–8 章 + 第 21 章 |
| Index | `/index/index-A.html` | 关键词索引 A–Z | 26 个字母页，词条深链到切片坐标 |
| Search | `/search.html` | 前端搜索页 | 依赖 JS |
| Help / About / Terms | `/help.html`、`/about-us/*` | 静态内容页 | 使用说明与许可 |

### 2.2 二级结构（核心）

- **章节页** `/slidebox/<NN-slug>.html`
  - `h2` 为章标题；`h3`（带锚点 `id`）为小节；`h4` 为子小节（电镜页较多）
  - 正文段落 + `div.fb-list` 卡片列表
  - 每张卡片：`div.fb-list-item` → 缩略图链接（`/slideview/<ID>/imgs/slide.png`）、名称链接（`/slideview/<ID>/<NN>-slide-N.html`）、`fb-list-text`（鉴定短语）、`fb-list-text`（染色，如 `H&E`、`Azan`）
  - 示意图卡片指向 `/figureview/fig-XXX-.../NN-figure-1.html`
- **电镜章节页** `/EM-atlas/<NN-slug>.html`
  - 结构同上，卡片指向 `/EM-view/EM-XXX-.../NN-photo-1.html`，缩略图为 `photo-2c.png`
- **切片查看页** `/slideview/<ID>/<NN>-slide-N.html`
  - 标题 = 标本编号 + 名称；`h2` = 鉴定短语
  - 交互式虚拟显微镜：前端加载切片瓦片（`/slides/...`，robots 禁止）、工具栏、结构下拉标注、比例尺、分享
  - 侧栏为英文说明段落与示意图
- **测验页** `/quizzes/<NN-slug>.html`：前端交互题（点击热区 + 选项），题目与答案在页面内
- **Gallery 视图** `/galleryview/<slug>.html`：缩略图墙 + 悬停显示名称/染色
- **Index 词条**：形如 `/slideview/<ID>/<NN>-slide-N.html?x=68360&y=47331&z=3`，带坐标与缩放级别，本质是“切片深链”

---

## 3. 页面与技术特性分类

| 类别 | 代表 | 加载方式 | 本地化可行性 |
| --- | --- | --- | --- |
| 普通静态内容 | 首页、About、Help、章节页说明 | 服务端直出 HTML | 结构可解析；**文字受版权保护，不转存** |
| 章节结构 / 卡片 | `/slidebox/*.html` | 服务端直出 HTML | 可解析出章节、小节、标本编号、鉴定短语、染色、链接（元数据） |
| 虚拟显微镜 | `/slideview/*` | JS + 切片瓦片（`/slides/`） | 组件复杂且瓦片被 robots 禁止；离线复现无授权 |
| 图片标注 | 切片页下拉结构列表 | JS 驱动 | 同上；标注文本属原站内容 |
| 图库 | `/galleryview/*` | 静态 HTML + 缩略图 | 索引可解析，图像不保存 |
| 电镜 | `/EM-atlas/*`、`/EM-view/*` | 静态 HTML + 图片 | 索引可解析，图像不保存 |
| 测验 | `/quizzes/*` | 静态 HTML + JS 交互 | 题目属原站内容，不复制；改为自编自测 |
| 关键词索引 | `/index/index-*.html` | 静态 HTML，词条带坐标深链 | 属原站“汇编”，不复制；保留入口 |
| 搜索 | `/search.html` | 前端 JS | 不采集；本站自建本地搜索 |

---

## 4. 页面清单（采集结果）

采集器 `scripts/fetch.mjs` 按 `data/sources.json` 抓取 41 个目标页（21 光镜章节 + 20 电镜章节），间隔 ≥1.2 秒，遵守 robots。

| 指标 | 数值 |
| --- | --- |
| 目标页面 | 41 |
| 成功 | 39（另 2 页命中本地缓存） |
| 不存在 | 1（`/EM-atlas/21-look-alikes.html`，原站无此页） |
| 章节元数据文件 | 41 个（`data/raw-meta/*.json`） |
| 小节（去重后的标题实例） | 152 |
| 光镜切片索引 | 347 |
| 电镜照片索引 | 363 |
| 示意图索引 | 18 |
| 卡片“鉴定短语”去重 | 126 |

特殊页面处理：

- 第 21 章（Table Look-Alikes）卡片结构为 `<div id="top-01" class="fb-list-item">`，需要兼容带属性写法；共 27 个 `LA` 标本。
- 第 20 章电镜页（`/EM-atlas/20-organs-of-special-sense.html`）页面存在但**无任何卡片**（7 KB 空页），标记为“原站无内容”。
- 第 21 章无电镜页，采集器跳过。

完整页面清单：见 `site/sources.html`（含 URL、抓取时间、HTTP 状态、响应 SHA-256、条目数）。

---

## 5. 三个不同类型页面的采集测试

| 测试页 | 类型 | 验证内容 | 结果 |
| --- | --- | --- | --- |
| `/slidebox/02-epithelium.html` | 章节页 | 章节标题、10 个带锚点小节、31 张卡片（30 切片 + 1 示意图）、卡片名称/鉴定短语/染色/链接、卡片所属小节 | 全部提取正确；“H&E” 染色字段首版解析被截断，修复后正确 |
| `/slideview/MH-016-simple-epithelia/02-slide-1.html` | 切片查看页 | 标题、鉴定短语、侧栏说明、面包屑、邻近切片链接 | 结构可解析；说明段落与图像属受限内容，仅用于确认页面类型，不转存 |
| `/index/index-A.html` | 关键词索引 | 词条 → 切片坐标深链、章节归属 | 可解析，但属原站汇编，**不采集**，仅记录入口 |
| `/EM-atlas/02-epithelium.html` | 电镜章节 | h4 子小节、28 张电镜卡片、TEM/SEM 技术字段 | 提取正确 |
| `/quizzes/quizzes.html` | 测验 | 交互题结构、可用章节范围（1–8、21） | 确认为前端交互题，不复制 |

术语准确性抽查（样本）：

- `Simple Squamous Epithelium` → 单层扁平上皮；`Pseudostratified Columnar Epithelium` → 假复层纤毛柱状上皮（原站泛称 pseudostratified；中文按人卫版习惯在呼吸道上皮处加“纤毛”，已在 `unverified` 中说明）
- `Bowman's capsule` → 肾小体（肾小球）囊 / 鲍曼囊；“肾小体囊”为国内教材常用，保留英文原名
- `H&E` → 苏木精-伊红染色（HE 染色）；`Azan` → 偶氮卡红染色；`Verhoeff` → 韦罗霍夫弹性纤维染色；`Wright's stain` → 瑞氏染色
- `Lamina propria` → 固有层；`Ground substance` → 基质（细胞外基质无定形部分）

> 说明：术语以人卫版《组织学与胚胎学》为准；与英文原站用语有差异的条目在术语表中标注 `verified:false` 与差异说明，不做机械直译。

---

## 6. 版权与使用条款分析（决定架构）

来源：https://histologyguide.com/about-us/license.html （Terms of Use）

原文要点（节选）：

1. 站内全部内容——包括版面、设计、图像、程序、文本及其他信息——归站点所有者所有或经其许可，受版权及其他知识产权法保护。
2. “You may not copy, display, distribute, modify, publish, reproduce, store, transmit, create derivative works from, or sell or license all or any part of this Site in any medium to anyone...”
3. “You may print or download Content from the Site for your own personal, non-commercial use, provided that you keep intact all copyright or proprietary notices.”
4. “You may not engage in systematic retrieval of content from the Site to create or compile, directly or indirectly, a collection, compilation, database or directory without prior written permission from us.”
5. 许可申请联系：tcbrelje@gmail.com。

### 合规判定

| 计划中的做法 | 判定 | 处理 |
| --- | --- | --- |
| 保存原站图片 / 缩略图到本地 | 违反“不得复制、存储、展示” | **不做** |
| 把英文正文逐段翻译成本地中文 | 属于“衍生作品 + 复制” | **不做** |
| 系统性抓取全站建立内容库 | 明确禁止 | **不做** |
| 保存章节/小节标题、标本编号与名称、染色名、URL | 导航元数据，属最小必要事实信息 | 做（量很小，不构成内容替代） |
| 自编中文术语、复习要点、自测题 | 原创内容，不属原站作品 | 做 |
| 链接到原站切片 / 图库 / 测验 / 索引 | 正常超链接引用 | 做 |
| 个人浏览器中打开原站学习 | 条款允许个人非商业使用 | 提示用户自行在线学习 |

### 对产品定位的影响

原需求中“整理成中文学习界面并尽可能保留显微图像体验”的可实现部分是：

- ✅ 中文术语体系、章节结构、复习要点、自测、进度（本地）
- ✅ 每张标本的中文命名 + 原站编号 + 原站深链（在线查看高清切片）
- ✅ 明确区分“本地离线可用功能”与“需要联网的原站功能”
- ❌ 本地保存/展示原站图像、离线虚拟显微镜、原站测验副本

若后续取得作者书面许可，可通过 `scripts/import-local-images.mjs` 将**用户自备的、已获授权的图片**接入（默认关闭），无需改动主体架构。

---

## 7. 风险与限制

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 站点改版导致解析失效 | 采集器失败 | 校验器报告 item 数异常；解析规则集中在 `scripts/fetch.mjs` |
| 术语与教材版本差异 | 学习误导 | 术语表 `verified:false` + 差异说明；以人卫版为准 |
| 原站链接变更 | 在线入口失效 | 失效链接检测脚本（`scripts/check-links.mjs`）+ 来源页记录 |
| 用户误以为本站含完整图像 | 体验落差 | 首页/图谱页/章节页均明确标注“图像仅在线查看”；不生成假控件 |
| 中文内容质量参差 | 复习效果 | `check-content.mjs` 结构校验 + 人工抽样（见验收报告） |

---

## 8. 采集方式结论

- 采用 **Node.js 原生 fetch + 正则结构化解析**：页面为服务端直出 HTML，无需浏览器渲染；不加载 JS、不请求瓦片，请求量最小（41 页）。
- 采集器特性：限速（默认 1.6 s，本次 1.2 s）、3 次重试、按页缓存可断点续跑、robots 前缀检查、只提取元数据、记录 SHA-256 与抓取时间。
- 不使用 `puppeteer`/`playwright` 等重型工具；不模拟登录；不绕过任何访问限制。
- `robots.txt` 禁止的 `/slides`（切片瓦片）、`/figures`、`/EMs` 等目录完全未访问。

---

## 9. 审计后更新（2026-10-18）：取得书面许可，图像策略调整

审计结论（第 6 节）基于当时的默认条款。2026-10-18 项目所有者取得 Histology Guide 作者团队的**书面许可**（证据：`docs/permission/2026-10-18-histology-guide-permission.png`，要点见 `docs/05-permission.md`）：

- 允许为**个人离线学习**下载并本地保存**所选**组织学图像；
- 允许制作**私有的中文 HTML 学习资源**（含翻译标签与注释）；
- 条件：保留**署名与原页面链接**；**仅限个人非商业教育用途**；资源保持私有，**不得发布、分享、分发或商业使用**。

据此调整（仅影响图像层）：

| 项目 | 审计时结论 | 更新后 |
| --- | --- | --- |
| 原站图像 | 不保存 | 可保存**所选**图像的**中分辨率概览**（不镜像整站） |
| 图像显示 | 仅在线链接 | 本地概览图可离线放大；每张带 © 署名与原页面链接 |
| 英文正文 | 不保存 | 仍不保存（许可针对图像与翻译标签/注释） |
| 测验题、关键词索引 | 不复制 | 仍不复制 |
| 分辨率 | — | 本地只取一个中间层级（约 4000–5200 px 宽），**不宣称等同于完整切片** |

技术实现见 `scripts/fetch-images.mjs`（BigTIFF 金字塔按 Range 取层 + 限速 + 可增量）与 `scripts/stitch_tiles.py`。采集遵循“所选、限量、可追溯”原则：记录来源 URL、层级、尺寸、SHA-256 与请求数；服务器变慢时自动跳过目标，稍后可续跑。
