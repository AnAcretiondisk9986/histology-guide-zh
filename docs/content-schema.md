# 中文内容编写规范（content schema）

本文件是 `content/zh/` 下所有文件的唯一规范。内容作者必须严格遵守；`scripts/check-content.mjs` 会自动校验。

## 0. 总原则（合规）

1. **不得复制原站英文正文、不得逐段翻译原站段落、不得保存原站图片。** 本项目的定位是「中文学习层」：命名、术语、结构化要点、自测题由我们自己编写。
2. 每章 JSON 只允许出现：章节名、小节名（英文为原站小节标题，中文为我们的译名）、标本编号/名称、染色名、原站链接，以及**自编**中文说明。
3. 自编内容的知识依据是标准组织学教材（以人卫版《组织学与胚胎学》为准）；**不得编造原站没有的“原站说法”**。凡是写成“原站说……”的表述一律不允许；也不要写“据本站”之类。
4. 译名不确定时：在 `unverified` 中登记，并在术语里保留英文；不得硬造中文名。

## 1. 章节文件 `content/zh/chapters/NN.json`（NN 为两位章号，如 02）

```json
{
  "schema": 1,
  "n": 2,
  "titleZh": "上皮组织",
  "titleEn": "Epithelium",
  "group": "cells-tissues",
  "guide": "120–220 字自编导语：本章研究对象、学习路径、与前章的衔接。",
  "examFocus": ["3–6 条复习重点"],
  "sections": [
    {
      "en": "Simple Squamous Epithelium",
      "zh": "单层扁平上皮",
      "notes": ["2–5 条要点，每条 20–60 字"],
      "identify": { "low": "低倍镜下先找什么", "high": "高倍镜下确认什么" },
      "pitfall": "可选：最容易混淆之处"
    }
  ],
  "specimenZh": {
    "MH 016 Simple Epithelia": { "zh": "单层上皮（综合）", "note": "" }
  },
  "confusions": [{ "a": "单层扁平上皮", "b": "单层立方上皮", "how": "核断面形态与细胞高度" }],
  "quiz": [{ "q": "问题", "a": "答案", "tag": "识别" }],
  "terms": [{ "en": "simple squamous epithelium", "zh": "单层扁平上皮" }],
  "unverified": ["暂无法确定的中文译名，附英文"]
}
```

字段约束：

| 字段 | 要求 |
| --- | --- |
| `n` | 与文件名一致，1–21 |
| `titleZh` | 人卫版规范章名，如 上皮组织、结缔组织、肌组织、神经组织、循环系统 |
| `group` | `cells-tissues`（1–8）或 `organ-systems`（9–20）或 `quiz`（21） |
| `guide` | 120–220 字，不含 HTML |
| `examFocus` | 3–6 条 |
| `sections[].en` | **必须与 `data/inventory.json` 中该章 `sections[].en` 完全一致**（逐字符） |
| `sections[].zh` | 中文小节名，同一英文名全书统一 |
| `sections[].notes` | 2–5 条，每条 20–60 字 |
| `sections[].identify.low/high` | 各 10–40 字，写“先看什么→再确认什么” |
| `specimenZh` | 覆盖该章所有 `kind: "slide"` 的标本；`zh` 用规范器官/结构名 + 必要限定（如“胆总管”“淋巴结（H&E）”） |
| `quiz` | 6–10 题，`tag` ∈ `识别` / `概念` / `对比`；答案必须明确 |
| `terms` | 5–10 条本章核心术语，`en` 小写起首 |
| `unverified` | 可为空数组 |

**禁止**：HTML 标签、Markdown 语法、引用原站句子、出现 “http” 链接（链接由站点生成器统一拼接）。

## 2. 术语表 `content/zh/terms.json`

```json
{
  "schema": 1,
  "updatedAt": "2026-10-18",
  "terms": [
    {
      "id": "basement-membrane",
      "zh": "基膜",
      "en": "basement membrane",
      "aliases": ["basal lamina", "基板"],
      "category": "细胞外基质",
      "chapters": [2, 3],
      "definition": "自编 1–2 句释义（40–90 字）。",
      "note": "",
      "verified": true
    }
  ]
}
```

- `category` ∈ `组织` / `细胞` / `细胞器` / `细胞外基质` / `器官结构` / `染色与技术` / `其他`。
- `id`：小写英文短横线；与 `en` 对应。
- `definition`：自编释义，不抄原站句子。
- `verified`：`false` 表示**待核验**（译名或释义存疑），网站会显示“待核验”标签。
- 同一个英文术语只能有一条记录；同义写法放 `aliases`。

## 3. 完成标准

- `node scripts/check-content.mjs` 通过（error = 0）。
- 每一章的小节都覆盖到，且没有编造的小节名。
- 所有中文可读、术语统一、无乱码。
