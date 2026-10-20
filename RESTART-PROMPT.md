# 重启提示词（新对话直接粘贴）

> 本文件用于在**任意新对话**中快速恢复本项目工作。第一段是可直接复制的提示词；后面是当前状态快照与速查命令。

---

## 一、直接粘贴给新对话的提示词

```text
继续「Histology Guide 中文组织学复习站」项目（非官方中文学习改编版，GitHub Pages 公开、非商业、免费访问）。

工作目录：E:\Histology Guide Version of CN Translate
开工前先读：RESTART-PROMPT.md、docs/05-permission.md（尤其第 9 节 2026-10-20 新许可）、docs/06-publication.md、README.md，并运行 node scripts/check-content.mjs 确认内容基线（应为 21/21 章、335 术语、0 error）。

当前状态（每次以项目文件为准）：
- 许可：2026-10-20 Histology Guide 作者团队（tcbrelje）授予「在 GitHub Pages 公开托管非商业中文改编版」的书面许可，附 8 条条件；见 docs/05-permission.md 第 9 节。
- 托管：GitHub Pages 公开、非商业、免费访问；仓库 AnAcretiondisk9986/histology-guide-zh；地址 https://blog.acretiondisk.top/histology-guide-zh/（已上线）。
- 本地概览图：284 张（266 张唯一切片 + 18 幅示意图），约 566.6 MB；每张卡片保留 © 署名与原页面链接。
- 未采集：原站英文正文、测验题、关键词索引（不在许可范围，继续不采集）。
- 站点：site/ 已完成全站署名栏与页脚署名改造（本地复验 20/20 通过）；已完成移动端头部/锚点/缩略图说明/窄屏表格/灯箱遮挡专项修复（10 页 × 4 视口遮挡审计 0 问题）；已部署并完成线上验收（29/29 页 200、28 个 sitemap URL 200、图片抽查 200、404 正常）；UI 修复后待重新部署，live URL 尚未发送作者。

可选后续任务（按需选择）：
1) 把 live URL 发送至 tcbrelje@gmail.com 供作者复核署名（草稿见 docs/06-publication.md §6），发送后记录日期。
2) 抽查个别图像质量/分辨率（已无超时与失败记录）。
3) 每次改动后运行：node scripts/build.mjs && node scripts/verify-site.mjs（必须 20/20），并同步 README、docs/03、docs/04 的计数。

约束（必须遵守）：
- 仅限非商业教育用途、免费公开访问；不得出售、许可或以其他方式商业利用；不得在 GitHub Pages 之外再分发。
- 必须保留 © 署名与原页面链接；不得去除/篡改版权声明、水印或来源署名。
- 所有页面须有清楚署名（英文示例句 + 中文「非官方中文学习改编版，与 Histology Guide 无隶属关系，未经其认可或背书」声明）。
- 单张图像默认 60 秒上限，慢目标允许 --max-seconds=300；限速（并发≤6、间隔≥80ms），不做整站镜像。
- 不下载/不转存原站英文正文、测验题、关键词索引。
- 不得用低分辨率图冒充完整切片：卡片必须标注“本地概览”与分辨率，并保留“原站切片”链接。
```

---

## 二、当前状态快照（2026-10-20，UTC+8）

| 项目 | 数值 |
| --- | --- |
| 许可 | 2026-10-18 私有许可 + **2026-10-20 GitHub Pages 公开托管许可**（8 条条件） |
| 托管状态 | 公开、非商业、免费访问；仓库 `AnAcretiondisk9986/histology-guide-zh` |
| 线上地址 | `https://blog.acretiondisk.top/histology-guide-zh/`（**已上线**） |
| 部署 / 线上验收 | **已完成（2026-10-20）**；Actions #39433580696 |
| 本地图像 | **284 张**（266 张唯一切片 + 18 幅示意图） |
| 占用 | **566.6 MB**（`site/images/`） |
| 全站覆盖率 | **39.0%**（284/728 张，按图片张数）；**50.1%**（365/728 个图谱条目） |
| 切片下载队列 | **284 / 284** 个唯一目标（100%，266 切片 + 18 示意图） |
| 剩余 | **0**；电镜 363 张未下载（约 11 GB，需另行确认磁盘与意愿） |
| 站点验收 | **20/20 通过**（本地，2026-10-20）；**线上 29/29 页 + 28 sitemap URL 通过** |
| 内容基线 | 21/21 章、152 小节、335 术语、186 自测题、0 error |

进度与明细：

- 队列进度：`data/reports/images-progress.log`
- 图像清单（来源、层级、尺寸、SHA-256、署名）：`data/local-images.json`（284 条）
- 最终采集报告：`data/reports/images-report.json`（目标 284，成功 136，已有跳过 148，超时 0，失败 0）
- 站点验收报告：`data/reports/site-verify.json`（20/20）
- 许可记录：`docs/05-permission.md`（第 9 节为 2026-10-20 新许可）
- 出版记录与合规清单：`docs/06-publication.md`
- 版权与许可声明：`NOTICE.md`

## 三、常用命令

```powershell
# 全量重跑/补抓（已完成；已存在的自动跳过）
node scripts/fetch-images.mjs --all-slides --max-seconds=300 --concurrency=6 --delay=80

# 只补某一章的全部切片
node scripts/fetch-images.mjs --chapter=2 --all-slides --max-seconds=300

# 单独重试某一张
node scripts/fetch-images.mjs --only-slug=MH-033-blood-smear --max-seconds=300

# 电镜（约 31 MB/张 × 363 张 ≈ 11 GB，需先确认磁盘与意愿）
node scripts/fetch-images.mjs --em --per-chapter=2 --max-seconds=300

# 重新生成站点 + 验收
node scripts/build.mjs
node scripts/verify-site.mjs            # 加 --shots 可输出截图到 .tmp/
node scripts/check-content.mjs          # 内容基线（0 error / 0 warning）
```

部署：GitHub Actions 把 `site/` 发布到 GitHub Pages（`.github/workflows/pages.yml`）；推送到 `main` 或手动 `gh workflow run pages.yml` 即可。2026-10-20 已部署成功（Actions #39433580696），线上验收见 `docs/06-publication.md` §5/§8。

## 四、重要提醒

1. **先读许可**：`docs/05-permission.md` 第 9 节是当前有效许可（2026-10-20，GitHub Pages 公开托管 + 8 条条件）；第 1–8 节是 2026-10-18 私有许可历史。超出「GitHub Pages 非商业中文学习资源」的任何发布、分享、商用，都需作者另行书面许可。
2. **断网安全**：下载可随时中断；`data/local-images.json` 每次成功一张就落盘，不会因中断丢失已完成的图。
3. **仓库与发布**：线上发布产物是 `site/`（含 `images/` 284 张概览图）；工作流见 `.github/workflows/pages.yml`，每次推送 `main` 会重新发布。不要上传原站完整切片或其他未获许可的材料，也不要在 GitHub Pages 之外的平台部署或镜像。
4. **图像是概览**：本地图 930×662 ～ 5176×11372，来自原站 BigTIFF 金字塔的一个中分辨率层级，不是完整分辨率；高倍与标注请点“原站切片”。每张图保留 © 署名与原页面链接，不得去除或篡改。
5. 电镜 363 张尚未本地化；若要做，先确认磁盘（当前 E: 剩余约 222 GB）与时间（约 11 GB + 数小时），并评估公开托管后的带宽与许可边界（条件 5、7）。


