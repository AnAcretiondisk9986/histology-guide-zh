# 使用许可记录（图像本地化与 GitHub Pages 公开托管依据）

> **2026-10-20 许可更新（重要）**
>
> Histology Guide 作者团队（回信人 `tcbrelje`，即 T. Clark Brelje）于 **2026-10-20** 回信，授予本项目一项**新许可**：可在 **GitHub Pages 公开托管**「所选教育内容」的**非商业中文改编版**，并附 8 条条件（见第 9 节）。
>
> - 本文件第 1–8 节是 **2026-10-18 私有许可**的历史记录，保持原样、不作删改；
> - 当前有效许可、8 条条件与本项目落实方式以 **第 9 节**为准；与旧记录冲突时以第 9 节为准；
> - 两份许可均不构成与 Histology Guide 的隶属关系，也不代表其认可或背书本项目。

- 记录日期：2026-10-18（私有许可）；更新日期：2026-10-20（GitHub Pages 公开托管许可）
- 许可来源：Histology Guide 作者团队（回信人 `tcbrelje`，即 T. Clark Brelje；联系邮箱 tcbrelje@gmail.com）
- 请求方式：电子邮件（请求方为项目所有者，个人医学生）
- 证据存档：`docs/permission/2026-10-18-histology-guide-permission.png`（私有许可邮件截图，含请求与回复全文）；2026-10-20 新许可回信要点见第 9 节

## 1. 许可原文要点

请求内容：请求下载并在本地保存 Histology Guide 的**所选**组织学图像，用于个人离线学习；制作私有的中文 HTML 学习资源，含翻译标签与注释，同时保留署名与原页面链接；仅供本人学习，不发布、不分享、不商用。

回复要点（英文原文摘要，逐句对应）：

1. "We are happy to grant you permission to download and locally store selected histology images from our website for your personal offline study, including creating a private, Chinese-language HTML study resource with translated labels and notes, **provided that proper attribution and links to the original pages are preserved**."
2. "Please note that this permission is **limited to personal, non-commercial educational use only**. The resource **must remain private and must not be published, shared, distributed, or used commercially**. Any other use would require separate permission from us."

## 2. 许可范围（本项目据此执行）

| 可以做 | 不可以做 |
| --- | --- |
| 下载并本地保存**所选**图像（不要求全站） | 整站镜像、批量再分发 |
| 制作私有的中文 HTML 学习资源 | 发布到公网、上传网盘/代码托管公开仓库、分享给他人 |
| 添加中文翻译标签与注释 | 商业使用、课程售卖、嵌入付费产品 |
| 保留署名与原页面链接 | 去除版权声明或冒充原创 |
| 个人离线学习 | 用于训练/发布数据集、二次分发 |

## 3. 本项目的落实方式

1. **只取所选图像**：`scripts/fetch-images.mjs` 默认每章取 1 张代表切片（中分辨率概览）+ 全部示意图；不做整站镜像。数量与体积记录在 `data/reports/images-report.json`。
2. **按需取层**：原站图像为 BigTIFF/Zoomify 金字塔（单张切片源文件可达 600 MB+），脚本按 HTTP Range 只读取一个中分辨率层级的瓦片，避免无谓流量。
3. **署名**：
   - 每张本地图像卡片标注 `© T. Clark Brelje & Robert L. Sorenson · Histology Guide（经许可）`；
   - 卡片保留“原站切片/原页面”链接；
   - 页脚与 `sources.html` 载明许可范围；
   - `data/local-images.json` 为每张图记录 `attribution`、`permission`、`sourcePage`、`sourceZif`、`sha256`。
4. **私有性**：
   - 站点为本地静态文件，默认不提供任何上传/发布功能；
   - `sources.html`、`help.html` 与 README 均标注“仅限个人非商业学习，请勿发布或分享”；
   - 图像与数据均在本地目录，未提交到任何远程仓库（如使用 git，请勿将本站推送为公开仓库）。
5. **可追溯**：每张图记录来源 URL、层级、分辨率、字节数与 SHA-256；来源页列出全部采集页面与时间。

## 4. 分辨率与“不冒充完整切片”

- 本地图像是**中分辨率概览**（通常宽 4000–5200 px），不是原站完整分辨率（如 147440×32102）。
- 界面明确标注“本地概览（低倍）”，并保留“原站切片”链接用于高倍观察；不使用缩略图冒充完整切片。
- 若需更高分辨率，可用 `scripts/fetch-images.mjs --width=19000 --all-slides --chapter=N` 按章增量获取（体积与请求数会显著增加，请自行控制频率）。

## 5. 其他内容边界（未因本次许可而改变）

- 许可针对**图像**与**翻译标签/注释**；原站英文正文段落的系统性复制/翻译仍不在许可范围内，本项目继续不保存原站正文。
- 原站关键词索引、测验题不做复制；仍以链接方式访问。
- 若日后要公开发布本站，必须先取得作者的**另行书面许可**。

## 6. 复核清单

- [x] 许可证据已存档
- [x] 每张本地图有署名与原页面链接
- [x] 站点与文档标注“私有、非商业、不得发布/分享”
- [x] 采集有数量上限与限速，非整站镜像
- [x] 记录来源、分辨率、SHA-256

## 7. 关于站方限速（2026-10-18 补充）

站方说明：对连续/批量请求的限速属于技术部门的保护措施；作者已确认在许可范围内可以下载。因此本项目继续下载，但保持礼貌策略：

- **并发 4**、请求间隔约 120 ms（不是无限并发）；
- **单张图像默认 60 秒上限**：超过即跳过并记录（`--max-seconds=60`）；慢目标可用 `--max-seconds=300` 重试（不无限重试）；
- 只取**一个中分辨率层级**（默认 ≤5200 px 宽），不拉取完整金字塔；
- 已存在则跳过（可断点续跑）；`data/reports/images-report.json` 记录每张的成功/超时/失败、请求数与网络字节数；
- 实测：读取 1 MB 头部约 33 s、64 KB 约 1.6 s，故脚本只读 64 KB 头部；瓦片约 1–2 s/块。

若某张超过 60 秒被跳过，可稍后单独重试：

```powershell
node scripts/fetch-images.mjs --only-slug=<slug> --max-seconds=60
```

## 8. 2026-10-19 更新：全部光镜切片与示意图完成

- 采集范围：第 1–21 章全部光镜切片（266 个唯一图像，对应图库 347 个条目）+ 18 幅示意图，共 **284 张**，约 **566.6 MB**。
- 限速参数：`--all-slides --max-seconds=300 --concurrency=6 --delay=80`（并发 ≤6、间隔 ≥80 ms，仍属礼貌范围）；最终一轮新增 136 张，超时 0、失败 0。
- 许可边界不变：仅个人非商业学习；每张图保留 © 署名与原页面链接；未抓取英文正文、测验题、关键词索引；电镜 363 张未下载（约 11 GB）。
- 清单：`data/local-images.json`（284 条）；站点 `sources.html` 本地图像清单 284 行，与清单一致。

## 9. 2026-10-20 许可更新：GitHub Pages 公开托管（非商业中文改编版）

### 9.1 许可基本信息

| 项目 | 内容 |
| --- | --- |
| 新许可日期 | **2026-10-20** |
| 许可来源 | Histology Guide 作者团队回信（`tcbrelje`，T. Clark Brelje）；联系邮箱 tcbrelje@gmail.com |
| 请求内容 | 将已完成的非商业中文学习改编版（自编中文要点 / 术语 / 自测 + 经 2026-10-18 许可保存的 284 张中分辨率概览图）公开托管在 GitHub Pages，供免费学习访问 |
| 授予范围 | 在 GitHub Pages 上创建并公开托管「所选教育内容」的**非商业中文版** |
| 许可性质 | 附条件许可（8 条，见 9.3）；不转授、不得超出条件使用；原始内容版权仍归 Histology Guide 及/或原始贡献者 |
| 本次记录状态 | 许可已取得；站点合规改造已完成（2026-10-20 复验 20/20）；**已部署到 GitHub Pages 并完成线上验收**（`https://blog.acretiondisk.top/histology-guide-zh/`）；仅剩向作者发送 live URL（条件 8） |

### 9.2 许可邮件原文引用（逐字）

授予段落：

> “We are happy to grant you permission to create and publicly host a non-commercial Chinese-language version of selected educational content from Histology Guide on GitHub Pages, subject to the conditions below.”

版权归属段落：

> “the images, text, and other educational materials on Histology Guide come from our own histology teaching collections and from contributions by academic authors and institutions. Unless a specific credit line states otherwise, copyright in these materials remains with Histology Guide and/or the original contributors. They should not be treated as public-domain or freely reusable outside the permission granted here.”

结语：

> “We appreciate your respect for the original content and are glad the resource is useful for your studies.”

### 9.3 8 条条件（逐字）

1. “Provide clear attribution on each page or in a prominent global notice, for example: “Source: Histology Guide (histologyguide.com). Original content © Histology Guide and/or original contributors. This is an unofficial Chinese-language educational adaptation.””
2. “Link back to the corresponding original Histology Guide page wherever practicable.”
3. “Include a clear statement that your Chinese version is an unofficial translation/adaptation and is not endorsed by Histology Guide.”
4. “Do not remove or alter copyright notices, watermarks, or source credits.”
5. “If any image or material carries a separate credit to another author or institution, you must comply with that credit and, where necessary, obtain separate permission from that rights holder.”
6. “Keep the project non-commercial and freely accessible. Do not sell, license, or otherwise commercially exploit the materials.”
7. “Do not redistribute the materials beyond the GitHub Pages study resource without further permission.”
8. “Please send us the live URL once the resource is published so we can review the attribution.”

### 9.4 8 条条件 × 本项目落实方式对照

| # | 条件要点 | 本项目落实方式 | 落实证据 / 状态 |
| --- | --- | --- | --- |
| 1 | 每页或醒目全站通知中给出清楚署名 | 全站署名栏（英文示例句 + 中文非官方声明）+ 页脚署名；每张图像卡片逐图 © 署名 | `site/` 各页全站署名栏与页脚；`site/sources.html`；`NOTICE.md`；部署后线上复核（待验收） |
| 2 | 尽可能链接回对应原站页面 | 每张标本卡片保留「原站切片 / 原页面」链接；来源页记录采集页面 URL | `site/chapter/*.html`、`site/atlas.html`、`site/sources.html`；`data/local-images.json` 的 `sourcePage` |
| 3 | 明确声明中文版为非官方翻译/改编、未被背书 | 全站署名栏中文声明「非官方中文学习改编版，与 Histology Guide 无隶属关系，未经其认可或背书」 | `site/` 各页全站署名栏；`NOTICE.md` §3；`docs/06-publication.md` §6 邮件草稿 |
| 4 | 不得去除/篡改版权声明、水印、来源署名 | 本地图像按原站瓦片层级拼接，不做裁切、遮盖、加标或替换；不改动原站页面版权声明与来源署名 | `site/images/`（284 张概览，SHA-256 见 `data/local-images.json`）；`NOTICE.md` §4 |
| 5 | 图像/材料如有其他作者或机构的单独 credit，须遵守并必要时另行取得许可 | 逐图记录原站 credit 行；出现指向第三方的单独 credit 时，按该 credit 处理，必要时另行取得权利人许可 | `data/local-images.json` 的 `attribution` 字段；`site/sources.html` 图像清单 |
| 6 | 保持项目非商业、免费可访问；不得出售、许可或商业利用 | 无付费墙、无广告、无赞助与售卖入口；免费公开访问；文档与页脚声明仅限非商业教育 | `site/*.html` 页脚；`NOTICE.md` §4；本文件 9.6 |
| 7 | 不得超出 GitHub Pages 学习资源再分发 | 仅在 GitHub Pages 托管该学习资源；不在网盘、其他托管、应用包或镜像站分发 | `NOTICE.md` §4；`site/sources.html`；本文件 9.6 |
| 8 | 发布后把 live URL 发给作者供其复核署名 | 部署后向 tcbrelje@gmail.com 发送 live URL，并记录发送日期 | `docs/06-publication.md` §6 邮件草稿；状态：**待部署后发送** |

### 9.5 旧许可（2026-10-18）与新许可（2026-10-20）的关系

- **2026-10-18 许可**：允许为个人离线学习下载所选图像、制作**私有**中文资源；明确要求「不得发布、分享、分发」。
- **2026-10-20 许可**：在同一非商业中文改编版的基础上**扩展**授权——把该资源公开托管到 GitHub Pages。
- 因此，旧记录第 2 节「不可以做」中的「发布到公网 / 公开仓库」一项，**仅就「GitHub Pages 上的非商业中文学习资源」被新许可覆盖**；其余限制（署名与原页面链接、非商业、不作整站镜像、不转存英文正文 / 测验题 / 关键词索引）继续有效，并被 8 条条件进一步强化。
- 新许可不撤销 2026-10-18 许可：私有离线使用仍适用旧许可，公开托管以新许可为准；两者均不构成 Histology Guide 对本项目的认可或背书，也不授予商标或代理权。
- 许可仅覆盖「所选教育内容」；未采集的原站英文正文、测验题、关键词索引不因本次许可而进入许可范围（见第 5 节）。

### 9.6 仍然不允许的事项

| 不允许 | 说明 |
| --- | --- |
| 商业利用 | 不得售卖、许可、订阅收费、嵌入付费产品或任何形式的商业变现（条件 6） |
| 出售 / 许可材料 | 不得把图像、文字或本改编版授权给第三方使用（条件 6） |
| GitHub Pages 之外再分发 | 不得上传网盘、其他托管、打包分发、镜像站、应用内置等；再分发须另行书面许可（条件 7） |
| 去除 / 篡改版权声明 | 不得删除、裁切、遮盖或替换原站版权声明、水印与来源署名（条件 4） |
| 当作公有领域 | 原始内容不属公有领域、不是可自由复用的素材，仅在本许可范围内可用（9.2 版权段） |
| 超出「所选教育内容」 | 英文正文、测验题、关键词索引仍未采集，不因本次许可而可复制（第 5 节） |
| 无署名 / 无链接的再发布 | 任何页面都必须保留清楚署名与原页面链接（条件 1、2） |

### 9.7 复核清单（2026-10-20 记录）

- [x] 2026-10-20 新许可回信要点已逐字记录（9.2、9.3）
- [x] 8 条条件已建立与本项目落实方式的对照（9.4）
- [x] 公开托管边界已同步到 `NOTICE.md`、`docs/06-publication.md`、`RESTART-PROMPT.md`
- [x] 站点全站署名栏与页脚署名到位（本地 29/29 页检查通过；线上 29/29 页复核通过）
- [x] 来源页展示 8 条条件清单（线上 `site/sources.html` 已复核）
- [x] 已部署到 GitHub Pages（Actions #39433580696 成功）
- [ ] live URL 已发送至 tcbrelje@gmail.com 供作者复核署名（待发送；地址已确认）

