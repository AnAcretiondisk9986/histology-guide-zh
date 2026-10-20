# 出版记录与合规清单（GitHub Pages 非商业中文学习资源）

- 记录日期：2026-10-20
- 当前状态：**站点合规改造已完成（本地复验 20/20）；已部署到 GitHub Pages 并完成线上验收**（2026-10-20；条件 8 的 live URL 邮件尚未发送）
- 许可依据：`docs/05-permission.md` 第 9 节（2026-10-20 Histology Guide 作者团队回信，8 条条件）
- 版权与许可声明：[`NOTICE.md`](../NOTICE.md)

## 1. 许可依据摘要

Histology Guide 作者团队（回信人 `tcbrelje`，即 T. Clark Brelje；联系邮箱 tcbrelje@gmail.com）于 **2026-10-20** 回信，授予本项目在 **GitHub Pages 公开托管**「所选教育内容」**非商业中文改编版**的许可。原文要点（逐字，完整引用见 `docs/05-permission.md` 9.2、9.3）：

> “We are happy to grant you permission to create and publicly host a non-commercial Chinese-language version of selected educational content from Histology Guide on GitHub Pages, subject to the conditions below.”

> “the images, text, and other educational materials on Histology Guide come from our own histology teaching collections and from contributions by academic authors and institutions. Unless a specific credit line states otherwise, copyright in these materials remains with Histology Guide and/or the original contributors. They should not be treated as public-domain or freely reusable outside the permission granted here.”

许可附 **8 条条件**（署名、回链原页面、非官方声明、不得改动版权声明、第三方 credit、非商业免费、不得超出 GitHub Pages 再分发、发布后发送 live URL）。本项目为**非官方中文学习改编版**，与 Histology Guide **无隶属关系**，**未经其认可或背书**。

## 2. 仓库与访问地址

| 项目 | 值 | 状态 |
| --- | --- | --- |
| GitHub 仓库 | `AnAcretiondisk9986/histology-guide-zh` | 已创建并推送（含 `site/images/` 284 张图） |
| GitHub Pages 地址 | `https://blog.acretiondisk.top/histology-guide-zh/` | **已上线（2026-10-20）** |
| 域名说明 | 账户级 Pages 自定义域名 `blog.acretiondisk.top`（用户站点已启用）；项目站点按 GitHub Pages 规则挂在该域名的 `/histology-guide-zh/` 路径，`*.github.io` 项目地址不直接提供内容（与账户内其他项目一致） | 已确认域名可用 |
| 站点可见性 | 公开 | 已获许可（条件授予「publicly host」） |
| 商业性 | 无广告、无付费墙、无赞助、无售卖或许可入口 | 满足条件 6 |
| 访问方式 | 免费、无需登录 | 满足条件 6 |
| 部署记录 | 首次手动：Actions [#39433580696](https://github.com/AnAcretiondisk9986/histology-guide-zh/actions/runs/39433580696)；启用 push 自动部署后：[#39436654570](https://github.com/AnAcretiondisk9986/histology-guide-zh/actions/runs/39436654570)、UI 修复部署 [#39440763679](https://github.com/AnAcretiondisk9986/histology-guide-zh/actions/runs/39440763679) | **均成功（2026-10-20）** |

## 3. 部署方式

- **发布产物**：`site/` 目录——29 个 HTML 页面（首页、章节目录、21 个章节页、图谱、术语、复习、来源、帮助）+ `assets/`（样式、脚本、内嵌数据）+ `images/`（284 张经许可保存的中分辨率概览图）。
- **发布方式**：GitHub Actions 构建并发布 `site/` 到 GitHub Pages；工作流 `.github/workflows/pages.yml` 使用 `actions/upload-pages-artifact` + `actions/deploy-pages`，推送到 `main` 或手动触发即可发布。
- **访问地址**：`https://blog.acretiondisk.top/histology-guide-zh/`（已上线；页面内容仅在 `site/` 变更后由工作流重新发布）。
- **不做的部署**：不在 GitHub Pages 之外的平台部署、镜像或打包分发（条件 7）；不把原站完整分辨率切片或其他未获许可材料上传。
- **源材料与发布产物的区分**：`content/`、`data/`、`scripts/` 为源材料与采集记录，不进入线上页面；线上只读 `site/`。

## 4. 8 条条件逐条落实（证据指向 `site/` 页面与文档）

| # | 条件原文（逐字） | 本项目落实方式 | 落实证据 / 复核状态 |
| --- | --- | --- | --- |
| 1 | “Provide clear attribution on each page or in a prominent global notice, for example: “Source: Histology Guide (histologyguide.com). Original content © Histology Guide and/or original contributors. This is an unofficial Chinese-language educational adaptation.”” | 全站署名栏使用该英文示例句（+ 中文说明）；页脚重复署名；每张图像卡片逐图 © 署名 | `site/index.html`、`site/chapters.html`、`site/chapter/*.html`（21 页）、`site/atlas.html`、`site/glossary.html`、`site/review.html`、`site/sources.html`、`site/help.html` 的署名栏与页脚；`NOTICE.md` §1。线上复核 **通过（2026-10-20）** |
| 2 | “Link back to the corresponding original Histology Guide page wherever practicable.” | 每张标本卡片保留「原站切片 / 原页面」链接；来源页记录采集页面 URL | `site/chapter/*.html`、`site/atlas.html` 卡片链接；`site/sources.html`；`data/local-images.json` 的 `sourcePage` 字段。线上抽查 **通过（2026-10-20）** |
| 3 | “Include a clear statement that your Chinese version is an unofficial translation/adaptation and is not endorsed by Histology Guide.” | 全站署名栏与页脚均含中文声明：非官方中文学习改编版、与 Histology Guide 无隶属关系、未经其认可或背书 | `site/` 各页署名栏；`NOTICE.md` §3；`docs/05-permission.md` 9.4。线上复核 **通过（2026-10-20）** |
| 4 | “Do not remove or alter copyright notices, watermarks, or source credits.” | 概览图按原站瓦片层级拼接，不做裁切、遮盖、加标或替换；不改动原站页面版权声明与来源署名 | `site/images/`（284 张，SHA-256 见 `data/local-images.json`）；`NOTICE.md` §4。线上复核 **通过（2026-10-20）** |
| 5 | “If any image or material carries a separate credit to another author or institution, you must comply with that credit and, where necessary, obtain separate permission from that rights holder.” | 逐图记录原站 credit 行；若出现指向第三方作者/机构的单独 credit，按该 credit 处理，必要时另行取得该权利人许可 | `data/local-images.json` 的 `attribution` 字段；`site/sources.html` 图像清单。已抽查原站页脚未见单独 credit；持续核对 |
| 6 | “Keep the project non-commercial and freely accessible. Do not sell, license, or otherwise commercially exploit the materials.” | 站点免费、无需登录、无广告、无付费/赞助/售卖入口；文档与页脚声明仅限非商业教育 | `site/` 各页页脚；`NOTICE.md` §4；`docs/05-permission.md` 9.6。线上复核 **通过（2026-10-20）** |
| 7 | “Do not redistribute the materials beyond the GitHub Pages study resource without further permission.” | 仅在 GitHub Pages 托管该学习资源；不在网盘、其他托管、应用包或镜像站分发 | `NOTICE.md` §4；`site/sources.html`；`docs/05-permission.md` 9.6。持续遵守 |
| 8 | “Please send us the live URL once the resource is published so we can review the attribution.” | 向 tcbrelje@gmail.com 发送 live URL，请作者复核署名，并记录发送日期 | live URL 已确认：`https://blog.acretiondisk.top/histology-guide-zh/`；**待发送**（草稿见 §6） |

## 5. 线上验收清单（2026-10-20 已执行）

> 验收方式：`node scripts/verify-live.mjs`（结果写入 `data/reports/live-verify.json`）+ 手工抽查。`*.github.io` 项目地址返回 404，站点的实际线上地址为账户自定义域名下的 `https://blog.acretiondisk.top/histology-guide-zh/`（与账户内其他 Pages 项目一致）。

- [x] Pages 地址可访问：`https://blog.acretiondisk.top/histology-guide-zh/`（HTTP 200）
- [x] 首页、章节目录、21 个章节页、图谱、术语、复习、来源、帮助页均正常渲染（29/29 返回 200）
- [x] 所有页面可见全站署名栏（英文示例句 + 中文非官方声明）与页脚署名（29/29 逐页检查通过）
- [x] 来源页（`site/sources.html`）列出 8 条条件清单与许可摘要（线上页面含 8 条条件表）
- [x] 每张标本卡片可见 © 署名与「原站切片 / 原页面」链接（21 章本地结构检查 354/354 卡片；线上抽查 5 张图片与章节页链接）
- [x] 无广告、无付费墙、无赞助或售卖入口；无需登录即可访问（线上页面与静态审计）
- [x] 移动端 390 px 宽度无横向溢出（本地 Chrome 截图验收）
- [x] 未出现原站英文正文、测验题、关键词索引副本（独立审计：`data.js` 无英文长句/英文 quiz）
- [x] 仓库根目录 `NOTICE.md` 可见，声明与站点一致
- [x] 线上页面未改动原站图像中的版权声明/水印/来源署名（284 张图 SHA-256 与记录逐张一致，未做裁剪/遮盖）
- [x] 线上验收记录（日期、URL、结论）补入本文档 §8

## 6. 给作者的邮件草稿（发送前替换占位符）

> 线上地址已确认：`https://blog.acretiondisk.top/histology-guide-zh/`。发送前替换姓名/邮箱占位符；发送对象：tcbrelje@gmail.com。发送后把日期记入 §8。

```text
Subject: Live URL — unofficial Chinese-language adaptation of Histology Guide (non-commercial, GitHub Pages)

Dear T. Clark Brelje,

Thank you for your reply of October 20, 2026, and for granting permission to create and
publicly host a non-commercial Chinese-language version of selected educational content
from Histology Guide on GitHub Pages.

The resource is now live at:
https://blog.acretiondisk.top/histology-guide-zh/

What it is
This is an unofficial Chinese-language educational adaptation for histology review,
prepared by a medical student. It contains Chinese study notes, terminology, and
self-test questions written independently by the project author, together with 284
middle-resolution overview images of selected microscope slides and diagrams that were
saved under the earlier permission of October 18, 2026.

Attribution
Every page carries a clear global attribution notice and a footer credit, using the
form you suggested:
"Source: Histology Guide (histologyguide.com). Original content © Histology Guide
and/or original contributors. This is an unofficial Chinese-language educational
adaptation."
Each image card keeps its © credit and a link back to the corresponding original
Histology Guide page. The sources page also lists the eight conditions of your
permission. Copyright notices, watermarks, and source credits on the original
materials have not been removed or altered.

Non-commercial, no redistribution
The site is free to access, with no advertising, payments, or commercial use of any
kind. The materials are not redistributed outside this GitHub Pages study resource.
The English body text, quizzes, and keyword index of the original site are not copied
or translated; the site links back to the original pages for those.

If the attribution or anything else is insufficient, I will gladly adjust it. Please
reply to this email and let me know.

Thank you again for your generosity and for supporting students' learning.

Sincerely,
[项目所有者姓名]
GitHub: AnAcretiondisk9986
[联系邮箱]
```

## 7. 待办与风险

| 项 | 状态 | 说明 |
| --- | --- | --- |
| 站点合规改造 | 已完成（本地 20/20 复验） | 全站署名栏、页脚署名、来源页 8 条条件清单；`site/` 已重建并复验 |
| 仓库与 Pages 配置 | 已完成 | `AnAcretiondisk9986/histology-guide-zh`；284 张图已全部推送；GitHub Actions 发布 `site/` |
| 部署 | **已完成（2026-10-20）** | 运行 #39433580696 成功；线上地址 `https://blog.acretiondisk.top/histology-guide-zh/` |
| 线上验收 | **已完成（2026-10-20）** | 29/29 页面 200 且署名齐全；28 个 sitemap URL 200；图片抽查 200；404 页面正常；详见 §8 |
| 通知作者（条件 8） | **待发送** | live URL 已确认；按 §6 草稿发送后记录日期 |
| 电镜 / 更高分辨率 | 未纳入 | 未采集；若纳入需另行评估存储、带宽与条件 5、7 的边界 |
| 第三方单独 credit | 持续核对 | 已抽查原站页脚未见单独第三方 credit；如发现须遵守并必要时另行取得许可（条件 5） |

## 8. 验收与变更记录

| 日期 | 事项 | 记录人 | 结果 |
| --- | --- | --- | --- |
| 2026-10-20 | 建立本文档：记录新许可依据、仓库与 URL、部署方式、8 条条件落实与线上验收清单、邮件草稿 | 文档维护（docs-license） | 完成记录；部署与线上验收未执行 |
| 2026-10-20 | 站点合规改造、图片分批推送、GitHub Pages 部署 | Lead | 本地 `verify-site` 20/20、`check-content` 0 error；仓库推送完成；Actions 部署成功 |
| 2026-10-20 | 线上验收（`https://blog.acretiondisk.top/histology-guide-zh/`） | Lead | 29/29 页面 200 且含署名栏/逐字英文句/非官方声明/canonical；28 个 sitemap URL 200；5 张图片 200 且类型/体积正常；404 返回自定义页面；`*.github.io` 项目地址 404（使用账户自定义域名） |
| 2026-10-20 | 启用 push 自动部署并复核 | Lead | Actions #39436654570 成功；线上首页、章节页、来源页、图片仍 200 且署名与 canonical 正常；仓库 About 主页指向 live URL |
| 2026-10-20 | 前端遮挡与布局专项修复（移动端头部、锚点、缩略图说明、窄屏表格、灯箱、搜索滚动锁） | Lead | 10 页 × 4 视口遮挡审计 0 问题；`verify-site` 20/20；已部署（Actions #39440763679）并通过线上移动端 UI 抽查 |

> 后续记录：部署日期、实际 URL、线上验收结论、live URL 发送日期与作者回复，均追加到本表。






