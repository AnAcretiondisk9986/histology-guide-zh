# 第二阶段技术方案：本地静态中文组织学复习站

## 1. 总体架构

```
原站 histologyguide.com
        │  (仅元数据，41 页，限速，遵守 robots)
        ▼
data/raw-meta/*.json ──► data/inventory.json ──┐
                                               ├──► scripts/build.mjs ──► site/ (静态站点)
content/zh/chapters/*.json（自编中文内容）─────┤                              │
content/zh/terms.json（自编术语表）────────────┘                              ▼
                                                                      浏览器（file:// 直接打开）
scripts/check-content.mjs   结构/一致性校验
scripts/verify-site.mjs     Chrome CDP 真实浏览器验收
```

设计原则：

1. **零运行时依赖**：站点是纯静态 HTML/CSS/JS，不需要 Node、数据库或后端服务；双击 `site/index.html` 即可用。
2. **数据内嵌**：所有数据写入 `site/assets/data.js`（`window.HG = {...}`），避免 `file://` 下 `fetch()` 被 CORS 拦截。
3. **内容与数据分离**：英文元数据（采集）与中文内容（自编）分目录存放，便于审计「哪些是原站的、哪些是我们写的」。
4. **合规优先**：默认不存原站图像与正文；离线功能与在线入口在 UI 上明确区分。
5. **可重建**：采集器增量、脚手架可重复生成、构建幂等、内容校验可回归。

## 2. 技术选型

| 层 | 选择 | 理由 |
| --- | --- | --- |
| 页面 | 原生 HTML + CSS + JS（无框架） | 体积小、离线可靠、无构建链、易审阅 |
| 数据 | JSON 文件 → 构建时内嵌为 JS | 避免本地 `fetch` 限制；单文件数据便于备份 |
| 采集 | Node.js 24 原生 `fetch` + 正则解析 | 页面为服务端直出，无需浏览器；请求量最小 |
| 校验 | Node 脚本 | 结构约束可自动检查，便于并行写作 |
| 验收 | Chrome Headless + CDP（Node 原生 WebSocket） | 真实渲染、可断言、可截图，无第三方依赖 |
| 存储 | 浏览器 `localStorage` | 学习进度本地化，不上传 |

## 3. 目录结构

```
├─ README.md                  启动、结构、完成度、已知限制
├─ docs/
│  ├─ 01-audit.md             站点审计与版权结论
│  ├─ 02-tech-plan.md         本文件
│  ├─ 03-implementation-plan.md 里程碑与状态
│  ├─ content-schema.md       中文内容规范（作者必读）
│  └─ 04-qa-report.md         验收与抽样检查报告
├─ scripts/
│  ├─ fetch.mjs               元数据采集（限速/重试/缓存/robots）
│  ├─ scaffold.mjs            inventory 汇总 + 内容脚手架
│  ├─ check-content.mjs       中文内容与术语一致性校验
│  ├─ build.mjs               静态站点生成
│  ├─ verify-site.mjs         浏览器验收（CDP）
│  └─ import-local-images.mjs （可选）接入用户自备的授权图片
├─ data/
│  ├─ sources.json            采集页面清单
│  ├─ raw-meta/*.json         41 个页面元数据（含来源指纹）
│  ├─ inventory.json          章节/小节/标本总清单
│  └─ reports/                采集、内容校验、站点验收报告
├─ content/zh/
│  ├─ chapters/NN.json        21 章自编中文内容
│  ├─ terms.json              术语表
│  └─ _scaffold/              生成的小节与标本脚手架
└─ site/                      生成的静态站点（交付物）
   ├─ index.html / chapters.html / atlas.html / glossary.html
   ├─ review.html / sources.html / help.html
   ├─ chapter/NN.html
   └─ assets/{app.css, app.js, data.js}
```

## 4. 数据模型

### 4.1 元数据 `data/raw-meta/<type>-<slug>.json`

```json
{
  "schema": 1,
  "source": { "url": "...", "fetchedAt": "...", "httpStatus": 200, "bytes": 41129,
              "sha256": "...", "userAgent": "..." },
  "chapter": 2,
  "pageType": "slidebox",
  "pageTitle": "Chapter 2 - Epithelium",
  "headings": [{ "level": 3, "id": "simple-squamous", "text": "Simple Squamous Epithelium" }],
  "items": [{ "kind": "slide", "name": "MH 016 Simple Epithelia",
              "caption": "Simple Squamous Epithelium", "stain": "H&E",
              "href": "/slideview/MH-016-simple-epithelia/02-slide-1.html",
              "thumbPath": "/slideview/MH-016-simple-epithelia/imgs/slide.png",
              "section": "Simple Squamous Epithelium" }]
}
```

只保留定位与命名信息；正文段落、图像、测验题均不落盘。

### 4.2 章节内容 `content/zh/chapters/NN.json`

见 `docs/content-schema.md`。核心字段：`titleZh`、`guide`、`examFocus`、`sections[]`（`en` 必须与 inventory 逐字一致）、`specimenZh`、`quiz[]`、`terms[]`、`unverified[]`。

### 4.3 术语 `content/zh/terms.json`

`id / zh / en / aliases / category（7 类）/ chapters / definition / note / verified`。

## 5. 站点页面与功能映射

| 页面 | 功能 | 数据来源 |
| --- | --- | --- |
| `index.html` | 章节入口、统计、最近学习、进度总览 | inventory + content + localStorage |
| `chapters.html` | 章节目录、进度条、完成度 | 同上 |
| `chapter/NN.html` | 导语、复习重点、易混对比、小节要点、低倍/高倍提示、标本卡片、电镜列表、自测、完成标记 | content + inventory（标本链接） |
| `atlas.html` | 全部 347 切片 + 363 电镜 + 18 示意图索引，按章/类型/关键词筛选 | inventory |
| `glossary.html` | 中英双向搜索、分类/章节筛选、待核验标记 | terms |
| `review.html` | 术语 / 自测 / 标本识别三种抽认卡，易错本，键盘操作 | content + terms + localStorage |
| `sources.html` | 来源清单、抓取时间、SHA-256、许可结论 | inventory 来源字段 |
| `help.html` | 启动方式、离线/在线对照、快捷键、已知限制、目录结构 | 构建时常量 |

交互细节：

- 搜索：`/` 唤起，支持章节、小节、标本编号与样例名称、术语，`↑↓/Enter/Esc`。
- 主题：`localStorage` 记忆 + `prefers-color-scheme` 初始值。
- 进度：`hgcn.progress.v1` 保存章节完成、切片打开、易错题、复习统计、最近访问。
- 键盘：搜索、抽认卡（空格/←/→）、Esc。
- 响应式：≤900px 两列，≤620px 单列；移动端导航横向滚动。
- 图片：默认卡片为占位（说明“图像仅在线查看”），点击跳原站；若用户通过 `import-local-images.mjs` 接入已授权图片，则显示缩略图并提供放大查看。

## 6. 合规设计

1. 采集器仅保存元数据；代码中显式写明边界，正文与图片不落盘。
2. 不抓取 robots 禁止目录；请求间隔 ≥1.2 s；单一 User-Agent 标明用途。
3. 站点所有涉及图像的位置标注“仅在线查看”，不生成无效的缩放控件。
4. `sources.html` 完整公开来源、时间与摘要；`help.html` 公开限制。
5. 如取得书面许可，使用独立的可选脚本接入图片，主站默认不含图像。

## 7. 增量与可恢复

- 采集：按页面缓存，`--force` 才重抓；失败重试 3 次；报告 `data/reports/fetch-report.json` 记录每页状态。
- 内容编写：每章独立 JSON，可并行、可单独重跑校验。
- 构建：读取现有文件重新生成，幂等；缺失内容自动降级为“编写中”占位，不伪造完成度。
- 验收：`verify-site.mjs` 每次重建后可重复执行，输出通过/失败明细。

## 8. 测试策略

| 层次 | 手段 | 覆盖 |
| --- | --- | --- |
| 采集 | `fetch-report.json` + inventory 计数 | 页面可达、条目数、失败页 |
| 内容 | `check-content.mjs` | 字段完整性、小节名逐字匹配、标本命名覆盖、术语一致、禁止项（HTML/URL） |
| 站点 | `verify-site.mjs`（Chrome CDP） | 页面渲染、搜索、筛选、测验、进度、主题、移动端、内部链接完整性 |
| 人工 | 抽样阅读 | 术语准确性、中文可读性、原站对应关系 |

## 9. 未采用方案及原因

| 方案 | 未采用原因 |
| --- | --- |
| 直接镜像/整站翻译 | 违反原站条款（复制、衍生、系统性汇集） |
| iframe 嵌入原站切片 | 属“展示”原站内容，且交互受限、易失效 |
| 热链原站缩略图 | 属展示原站图像，且不符合“不得用低分辨率冒充切片”的要求 |
| 自建切片瓦片 + 本地虚拟显微镜 | 需下载 `/slides`（robots 禁止）且无授权 |
| React/Vue 单页应用 | 增加构建链与离线复杂度，收益有限 |
| 后端 + 数据库 | 需求明确要求无后端、可本地打开 |
