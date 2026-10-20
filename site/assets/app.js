/* ==========================================================================
   Histology Guide 中文复习站 —— 前端脚本（无依赖，可直接 file:// 打开）
   模块：主题、搜索、进度存储、章节页测验、图谱筛选、术语表、复习模式
   ========================================================================== */
(function () {
  'use strict';

  const HG = window.HG || { chapters: [], terms: [], sources: [], totals: {} };
  const STORE_KEY = 'hgcn.progress.v1';
  const THEME_KEY = 'hgcn.theme';
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) =>
    String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const pad2 = (n) => String(n).padStart(2, '0');
  const chapterHref = (n) => `${window.HG_BASE || ''}chapter/${pad2(n)}.html`;

  /* ------------------------------ 主题 ------------------------------ */
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeMeta) themeMeta.setAttribute('content', theme === 'dark' ? '#14181b' : '#f7f6f3');
    const btn = $('#theme-toggle');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀' : '☾';
      btn.setAttribute('aria-label', theme === 'dark' ? '切换到浅色主题' : '切换到深色主题');
      btn.title = btn.getAttribute('aria-label');
    }
  }
  function initTheme() {
    let theme = null;
    try { theme = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (!theme) theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(theme);
    const btn = $('#theme-toggle');
    if (btn)
      btn.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      });
  }

  /* ------------------------------ 进度存储 ------------------------------ */
  const defaultProgress = () => ({
    chapters: {},      // "2": {done:true, at:ts}
    slides: {},        // "MH 016 Simple Epithelia": ts （点开原站链接即记录）
    quizWrong: {},     // "2:3": true
    review: { seen: 0, again: 0, last: null },
    recent: []         // [{type:'chapter'|'atlas', n, at}]
  });
  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultProgress();
      const p = JSON.parse(raw);
      return Object.assign(defaultProgress(), p, {
        chapters: p.chapters || {},
        slides: p.slides || {},
        quizWrong: p.quizWrong || {},
        review: Object.assign({ seen: 0, again: 0, last: null }, p.review || {}),
        recent: Array.isArray(p.recent) ? p.recent : []
      });
    } catch (e) {
      return defaultProgress();
    }
  }
  function saveProgress(p) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch (e) {}
  }
  let progress = loadProgress();

  function markChapterDone(n, done) {
    progress.chapters[String(n)] = { done: !!done, at: Date.now() };
    rememberVisit('chapter', n);
    saveProgress(progress);
  }
  function rememberVisit(type, n) {
    progress.recent = progress.recent.filter((r) => !(r.type === type && r.n === n));
    progress.recent.unshift({ type, n, at: Date.now() });
    progress.recent = progress.recent.slice(0, 6);
    saveProgress(progress);
  }
  function chapterProgressPct() {
    let done = 0;
    for (const c of HG.chapters) if (progress.chapters[c.n] && progress.chapters[c.n].done) done++;
    return { done, total: HG.chapters.length, pct: HG.chapters.length ? Math.round((done / HG.chapters.length) * 100) : 0 };
  }

  /* ------------------------------ 提示条 ------------------------------ */
  let toastTimer = null;
  function toast(msg) {
    let el = $('#toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1900);
  }

  /* ------------------------------ 搜索 ------------------------------ */
  let searchIndex = null;
  function buildSearchIndex() {
    const idx = [];
    for (const c of HG.chapters) {
      idx.push({ type: '章节', title: `${pad2(c.n)} ${c.titleZh}`, sub: c.titleEn, href: chapterHref(c.n), hay: `${c.titleZh} ${c.titleEn} 第${c.n}章` });
      for (const s of c.sections || []) {
        idx.push({ type: '小节', title: s.zh, sub: `${c.titleZh} · ${s.en}`, href: `${chapterHref(c.n)}#${s.id || ''}`, hay: `${s.zh} ${s.en} ${c.titleZh}` });
      }
      for (const sp of c.specimens || []) {
        idx.push({
          type: '标本',
          title: sp.zh || sp.name,
          sub: `${sp.name} · ${sp.caption || ''} ${sp.stain || ''}`.trim(),
          href: `${window.HG_BASE || ''}atlas.html#s-${encodeURIComponent(sp.name)}`,
          hay: `${sp.zh || ''} ${sp.name} ${sp.caption || ''} ${sp.stain || ''} 第${c.n}章 ${c.titleZh}`
        });
      }
    }
    for (const t of HG.terms || []) {
      idx.push({
        type: '术语',
        title: t.zh,
        sub: `${t.en}${t.verified === false ? ' · 待核验' : ''}`,
        href: `${window.HG_BASE || ''}glossary.html?q=${encodeURIComponent(t.en)}`,
        hay: `${t.zh} ${t.en} ${(t.aliases || []).join(' ')} ${t.category}`
      });
    }
    return idx;
  }
  function score(item, q) {
    const hay = item.hay.toLowerCase();
    const hayLo = item.title.toLowerCase();
    const sub = (item.sub || '').toLowerCase();
    if (hayLo === q) return 100;
    if (hayLo.startsWith(q)) return 80;
    if (sub.startsWith(q)) return 70;
    if (hayLo.includes(q)) return 60;
    if (sub.includes(q)) return 45;
    if (hay.includes(q)) return 30;
    return 0;
  }
  function highlight(text, q) {
    if (!q) return esc(text);
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }
  function initSearch() {
    const overlay = $('#search-overlay');
    if (!overlay) return;
    const input = $('#search-input');
    const results = $('#search-results');
    let items = [];
    let active = -1;

    function render(q) {
      const query = q.trim().toLowerCase();
      if (!query) {
        results.innerHTML = '<div class="search-group-title">输入中英文术语、章节或标本编号</div>' +
          '<div class="search-result"><div class="r-title">试试：上皮组织、肝小叶、H&amp;E、MH 016、podocyte</div>' +
          '<div class="r-sub">快捷键：/ 打开搜索，↑↓ 选择，Enter 跳转，Esc 关闭</div></div>';
        items = [];
        active = -1;
        return;
      }
      const hits = searchIndex
        .map((it) => ({ it, s: score(it, query) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 40)
        .map((x) => x.it);
      items = hits;
      active = hits.length ? 0 : -1;
      if (!hits.length) {
        results.innerHTML = `<div class="empty">没有匹配“${esc(q)}”的内容<br><span class="small">可尝试英文原名或标本编号</span></div>`;
        return;
      }
      let html = '';
      let lastType = null;
      hits.forEach((it, i) => {
        if (it.type !== lastType) {
          html += `<div class="search-group-title">${esc(it.type)}</div>`;
          lastType = it.type;
        }
        html += `<a class="search-result${i === 0 ? ' active' : ''}" href="${esc(it.href)}" data-i="${i}">
          <div class="r-title">${highlight(it.title, q.trim())}</div>
          <div class="r-sub">${highlight(it.sub || '', q.trim())}</div></a>`;
      });
      results.innerHTML = html;
      $$('.search-result', results).forEach((el) => {
        el.addEventListener('mousemove', () => setActive(Number(el.dataset.i)));
      });
    }
    function setActive(i) {
      active = i;
      $$('.search-result', results).forEach((el, k) => el.classList.toggle('active', k === i));
      const el = $$('.search-result', results)[i];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
    function open() {
      if (!searchIndex) searchIndex = buildSearchIndex();
      overlay.classList.add('open');
      input.value = '';
      render('');
      setTimeout(() => input.focus(), 10);
    }
    function close() {
      overlay.classList.remove('open');
      input.blur();
    }
    $('#open-search') && $('#open-search').addEventListener('click', open);
    const closeBtn = $('#search-close');
    closeBtn && closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) setActive(Math.min(items.length - 1, active + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) setActive(Math.max(0, active - 1)); }
      else if (e.key === 'Enter' && active >= 0 && items[active]) { window.location.href = items[active].href; }
      else if (e.key === 'Escape') close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
        e.preventDefault();
        open();
      }
    });
  }

  /* ------------------------------ 首页 ------------------------------ */
  function initHome() {
    const grid = $('#chapter-grid');
    if (grid) {
      const groups = [
        { key: 'cells-tissues', title: '细胞与基本组织', en: 'Cells & Tissues', range: [1, 8] },
        { key: 'organ-systems', title: '器官系统', en: 'Organ Systems', range: [9, 20] },
        { key: 'quiz', title: '鉴别练习', en: 'Look-Alikes', range: [21, 21] }
      ];
      grid.innerHTML = groups
        .map((g) => {
          const items = HG.chapters.filter((c) => c.group === g.key);
          if (!items.length) return '';
          return `<section class="home-group">
            <div class="group-head"><h2>${esc(g.title)} <span class="faint small">${esc(g.en)}</span></h2></div>
            <div class="grid cols-4">${items.map(chapterCardHtml).join('')}</div>
          </section>`;
        })
        .join('');
    }
    const recentEl = $('#recent-list');
    if (recentEl) {
      const rec = progress.recent.slice(0, 4);
      if (!rec.length) {
        recentEl.innerHTML = '<div class="empty small">还没有学习记录。从下面任一章节开始，进度会自动保存在本机浏览器。</div>';
      } else {
        recentEl.innerHTML = rec
          .map((r) => {
            const c = HG.chapters.find((x) => x.n === r.n);
            if (!c) return '';
            return `<a class="recent-item" href="${chapterHref(c.n)}"><span class="mono faint">${pad2(c.n)}</span> ${esc(c.titleZh)} <span class="faint small">${esc(c.titleEn)}</span></a>`;
          })
          .join('');
      }
    }
    const statEl = $('#progress-summary');
    if (statEl) {
      const p = chapterProgressPct();
      statEl.innerHTML = `已标记完成 <b>${p.done}</b> / ${p.total} 章
        <div class="progress-track" style="margin-top:8px;max-width:320px"><div class="progress-fill" style="width:${p.pct}%"></div></div>`;
    }
    $$('[data-stat]').forEach((el) => {
      const k = el.dataset.stat;
      const v = HG.totals && HG.totals[k];
      if (v != null) el.textContent = v;
    });
  }
  function chapterCardHtml(c) {
    const done = progress.chapters[String(c.n)] && progress.chapters[String(c.n)].done;
    const total = (c.sections || []).length;
    const covered = (c.coverage && c.coverage.covered) || 0;
    const pct = total ? Math.round((covered / total) * 100) : c.contentStatus === 'authored' ? 100 : 0;
    const slides = (c.specimens || []).filter((s) => s.kind === 'slide').length;
    const counts = total
      ? `${total} 小节 · ${slides} 标本`
      : `${(c.quiz || []).length} 道鉴别题 · ${slides} 标本`;
    return `<a class="chapter-card" href="${chapterHref(c.n)}">
      <div class="badge-row">
        ${done ? '<span class="badge ok">已完成</span>' : ''}
        ${c.contentStatus !== 'authored' ? '<span class="badge draft">编写中</span>' : ''}
      </div>
      <div class="num">CHAPTER ${pad2(c.n)}</div>
      <h3>${esc(c.titleZh)}</h3>
      <div class="en">${esc(c.titleEn)}</div>
      <div class="bar"><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></div>
      <div class="counts">${counts}</div>
    </a>`;
  }

  /* ------------------------------ 章节目录 ------------------------------ */
  function initChapterIndex() {
    const root = $('#chapter-index');
    if (!root) return;
    const groups = [
      { key: 'cells-tissues', title: '细胞与基本组织', en: 'Cells & Tissues' },
      { key: 'organ-systems', title: '器官系统', en: 'Organ Systems' },
      { key: 'quiz', title: '鉴别练习', en: 'Look-Alikes' }
    ];
    root.innerHTML = groups
      .map((g) => {
        const items = HG.chapters.filter((c) => c.group === g.key);
        if (!items.length) return '';
        return `<h2 class="group-head">${esc(g.title)} <span class="faint small">${esc(g.en)}</span></h2>
        <div class="grid cols-3">${items.map(chapterCardHtml).join('')}</div>`;
      })
      .join('');
  }

  /* ------------------------------ 章节页 ------------------------------ */
  function initChapterPage() {
    const main = $('#chapter-content');
    if (!main) return;
    const n = Number(main.dataset.chapter);
    const c = HG.chapters.find((x) => x.n === n);
    if (!c) return;
    rememberVisit('chapter', n);

    // 完成按钮
    const doneBtn = $('#mark-done');
    if (doneBtn) {
      const setBtn = () => {
        const done = progress.chapters[String(n)] && progress.chapters[String(n)].done;
        doneBtn.textContent = done ? '✓ 已标记完成' : '标记本章完成';
        doneBtn.classList.toggle('primary', !done);
        doneBtn.setAttribute('aria-pressed', String(!!done));
      };
      setBtn();
      doneBtn.addEventListener('click', () => {
        const done = progress.chapters[String(n)] && progress.chapters[String(n)].done;
        markChapterDone(n, !done);
        setBtn();
        toast(!done ? '已标记完成，进度保存在本机' : '已取消完成标记');
      });
    }

    // 小节折叠目录高亮
    const tocLinks = $$('#chapter-toc a');
    if (tocLinks.length && 'IntersectionObserver' in window) {
      const map = new Map();
      tocLinks.forEach((a) => map.set(a.getAttribute('href').slice(1), a));
      const io = new IntersectionObserver(
        (entries) => {
          for (const en of entries) {
            if (en.isIntersecting) {
              tocLinks.forEach((a) => a.classList.remove('active'));
              const a = map.get(en.target.id);
              if (a) {
                a.classList.add('active');
                a.setAttribute('aria-current', 'true');
              }
              tocLinks.forEach((x) => { if (x !== a) x.removeAttribute('aria-current'); });
            }
          }
        },
        { rootMargin: '-80px 0px -70% 0px' }
      );
      $$('.section[id]').forEach((s) => io.observe(s));
    }

    // 测验
    $$('.quiz').forEach((q, i) => {
      const key = `${n}:${i}`;
      const reveal = $('.btn-reveal', q);
      const wrong = $('.btn-wrong', q);
      const setWrong = () => {
        const isWrong = !!progress.quizWrong[key];
        wrong.textContent = isWrong ? '★ 已加入易错' : '加入易错';
        wrong.classList.toggle('warn', false);
        wrong.setAttribute('aria-pressed', String(isWrong));
      };
      setWrong();
      reveal &&
        reveal.addEventListener('click', () => {
          q.classList.toggle('revealed');
          reveal.textContent = q.classList.contains('revealed') ? '隐藏答案' : '显示答案';
          reveal.setAttribute('aria-expanded', String(q.classList.contains('revealed')));
        });
      wrong &&
        wrong.addEventListener('click', () => {
          if (progress.quizWrong[key]) delete progress.quizWrong[key];
          else progress.quizWrong[key] = true;
          saveProgress(progress);
          setWrong();
          toast(progress.quizWrong[key] ? '已加入易错本' : '已从易错本移除');
        });
    });

    // 标本：记录“在线查看”点击
    $$('[data-open-slide]').forEach((a) => {
      a.addEventListener('click', () => {
        const name = a.dataset.openSlide;
        progress.slides[name] = Date.now();
        saveProgress(progress);
        toast('已在浏览器新标签打开原站切片（需网络）');
      });
    });
  }

  /* ------------------------------ 图谱 ------------------------------ */
  function initAtlas() {
    const root = $('#atlas-root');
    if (!root) return;
    const qEl = $('#atlas-q');
    const chEl = $('#atlas-chapter');
    const kindEl = $('#atlas-kind');
    const localEl = $('#atlas-local');
    const countEl = $('#atlas-count');

    const all = [];
    for (const c of HG.chapters) {
      for (const sp of c.specimens || []) {
        all.push({ ...sp, chapter: c.n, chapterZh: c.titleZh, chapterEn: c.titleEn });
      }
      for (const em of c.em || []) {
        all.push({ ...em, kind: 'em', chapter: c.n, chapterZh: c.titleZh, chapterEn: c.titleEn });
      }
    }

    chEl.innerHTML =
      '<option value="">全部章节</option>' +
      HG.chapters.map((c) => `<option value="${c.n}">${pad2(c.n)} ${esc(c.titleZh)}</option>`).join('');

    // 支持从章节页带参数进入：atlas.html?chapter=13&kind=em
    const presetParams = new URLSearchParams(location.search);
    const presetChapter = Number(presetParams.get('chapter'));
    if (presetChapter && HG.chapters.some((c) => c.n === presetChapter)) chEl.value = String(presetChapter);
    if (presetParams.get('kind')) kindEl.value = presetParams.get('kind');

    function render() {
      const q = (qEl.value || '').trim().toLowerCase();
      const ch = chEl.value ? Number(chEl.value) : null;
      const kind = kindEl.value;
      const list = all.filter((sp) => {
        if (ch && sp.chapter !== ch) return false;
        if (kind === 'slide' && sp.kind !== 'slide') return false;
        if (kind === 'em' && sp.kind !== 'em') return false;
        if (kind === 'figure' && sp.kind !== 'figure') return false;
        if (localEl && localEl.checked && !sp.img) return false;
        if (!q) return true;
        return `${sp.zh || ''} ${sp.name} ${sp.caption || ''} ${sp.stain || sp.technique || ''} ${sp.chapterZh}`.toLowerCase().includes(q);
      });
      countEl.textContent = `共 ${list.length} 项`;
      if (!list.length) {
        root.innerHTML = '<div class="empty">没有匹配的标本。试试清空关键词，或切换章节/类型。</div>';
        return;
      }
      root.innerHTML = `<div class="specimen-grid">${list.map(atlasCard).join('')}</div>`;
      fitThumbs(root);
      $$('[data-open-slide]', root).forEach((a) => {
        a.addEventListener('click', () => {
          progress.slides[a.dataset.openSlide] = Date.now();
          saveProgress(progress);
        });
      });
      // 定位到锚点
      if (location.hash && location.hash.startsWith('#s-')) {
        const id = decodeURIComponent(location.hash.slice(3));
        const el = root.querySelector(`[data-slide-name="${CSS.escape(id)}"]`);
        if (el) el.scrollIntoView({ block: 'center' });
      }
    }
    qEl.addEventListener('input', render);
    [chEl, kindEl].forEach((el) => el.addEventListener('change', render));
    if (localEl) localEl.addEventListener('change', render);
    render();
  }
  function atlasCard(sp) {
    const isEm = sp.kind === 'em';
    const code = (sp.name.match(/^(MH[S]?|EM|LA|Fig)\s*[\w-]*/i) || [sp.name])[0];
    const zh = sp.zh || '';
    const base = window.HG_BASE || '';
    const hasImg = !!sp.img;
    const src = hasImg ? base + sp.img : '';
    return `<article class="specimen" data-slide-name="${esc(sp.name)}">
      <div class="thumb">${hasImg
        ? `<img src="${esc(src)}" alt="${esc(zh || sp.name)}（本地概览，© Histology Guide，经许可）" loading="lazy" data-zoom="${esc(src)}">`
        : esc(code)}
        <div class="thumb-note">${hasImg ? '点击图片放大 · 本地概览' : `${isEm ? '电镜图像' : '显微图像'}仅在线查看`}</div>
      </div>
      <div class="body">
        <div class="code">${esc(sp.name)}</div>
        ${zh ? `<div class="name-zh">${esc(zh)}</div>` : ''}
        ${sp.caption ? `<div class="caption">${esc(sp.caption)}</div>` : ''}
        <div class="tags">
          ${sp.stain ? `<span class="badge">${esc(sp.stain)}</span>` : ''}
          ${sp.technique ? `<span class="badge">${esc(sp.technique)}</span>` : ''}
          ${isEm ? '<span class="badge">电镜</span>' : ''}
          <span class="badge">第 ${sp.chapter} 章</span>
          ${hasImg ? '<span class="badge ok">本地概览</span>' : ''}
          ${hasImg && sp.imgW ? `<span class="badge">${esc(sp.imgW)}×${esc(sp.imgH)}</span>` : ''}
        </div>
        ${hasImg ? '<div class="img-credit">图像 © T. Clark Brelje &amp; Robert L. Sorenson · Histology Guide，经许可仅个人学习使用</div>' : ''}
        <div class="actions">
          <a class="btn small" data-open-slide="${esc(sp.name)}" href="${esc(HG_SITE + sp.url)}" target="_blank" rel="noopener noreferrer">原站切片 ↗</a>
          <a class="btn small ghost" href="${chapterHref(sp.chapter)}">本章</a>
        </div>
      </div>
    </article>`;
  }

  /* ------------------------------ 图片放大（仅本地授权图片） ------------------------------ */
  function initLightbox() {
    let overlay = null;
    let imgEl = null;
    let captionEl = null;
    let scale = 1;
    let tx = 0;
    let ty = 0;
    let dragging = false;
    let sx = 0;
    let sy = 0;

    function apply() {
      if (!imgEl) return;
      imgEl.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      imgEl.style.cursor = scale > 1 ? 'grab' : 'zoom-in';
    }
    function ensure() {
      if (overlay) return;
      overlay = document.createElement('div');
      overlay.className = 'lightbox';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', '图片放大查看');
      overlay.innerHTML = `<div class="lb-bar">
        <span class="lb-caption"></span><span class="spacer"></span>
        <button class="btn small" type="button" data-lb="out" aria-label="缩小">−</button>
        <button class="btn small" type="button" data-lb="reset" aria-label="原始大小">1:1</button>
        <button class="btn small" type="button" data-lb="in" aria-label="放大">+</button>
        <button class="btn small ghost" type="button" data-lb="close" aria-label="关闭">关闭 Esc</button>
      </div><div class="lb-stage"><img alt=""></div>`;
      document.body.appendChild(overlay);
      imgEl = $('img', overlay);
      captionEl = $('.lb-caption', overlay);
      overlay.addEventListener('click', (e) => {
        const act = e.target.closest('[data-lb]');
        if (!act) { if (e.target === overlay || e.target.classList.contains('lb-stage')) close(); return; }
        const k = act.dataset.lb;
        if (k === 'close') close();
        if (k === 'in') { scale = Math.min(8, scale * 1.25); apply(); }
        if (k === 'out') { scale = Math.max(0.2, scale / 1.25); apply(); }
        if (k === 'reset') { scale = 1; tx = ty = 0; apply(); }
      });
      overlay.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          scale = Math.min(8, Math.max(0.2, scale * (e.deltaY < 0 ? 1.12 : 0.9)));
          apply();
        },
        { passive: false }
      );
      imgEl.addEventListener('mousedown', (e) => {
        dragging = true;
        sx = e.clientX - tx;
        sy = e.clientY - ty;
        imgEl.style.cursor = 'grabbing';
      });
      window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        tx = e.clientX - sx;
        ty = e.clientY - sy;
        apply();
      });
      window.addEventListener('mouseup', () => {
        dragging = false;
        if (imgEl) imgEl.style.cursor = scale > 1 ? 'grab' : 'zoom-in';
      });
      document.addEventListener('keydown', (e) => {
        if (!overlay || !overlay.classList.contains('open')) return;
        if (e.key === 'Escape') close();
        if (e.key === '+' || e.key === '=') { scale = Math.min(8, scale * 1.25); apply(); }
        if (e.key === '-') { scale = Math.max(0.2, scale / 1.25); apply(); }
        if (e.key === '0') { scale = 1; tx = ty = 0; apply(); }
      });
    }
    function close() {
      if (!overlay) return;
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }
    document.addEventListener('click', (e) => {
      const img = e.target.closest('img[data-zoom]');
      if (!img) return;
      e.preventDefault();
      ensure();
      imgEl.src = img.dataset.zoom || img.src;
      imgEl.alt = img.alt || '';
      captionEl.textContent = img.alt || '';
      scale = 1;
      tx = ty = 0;
      apply();
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  }

  /* ------------------------------ 术语表 ------------------------------ */
  function initGlossary() {
    const tbody = $('#term-tbody');
    if (!tbody) return;
    const qEl = $('#gloss-q');
    const catEl = $('#gloss-cat');
    const chEl = $('#gloss-chapter');
    const verEl = $('#gloss-verified');
    const countEl = $('#gloss-count');
    const params = new URLSearchParams(location.search);
    if (params.get('q')) qEl.value = params.get('q');

    const cats = [...new Set((HG.terms || []).map((t) => t.category))];
    catEl.innerHTML = '<option value="">全部分类</option>' + cats.map((c) => `<option>${esc(c)}</option>`).join('');
    chEl.innerHTML =
      '<option value="">全部章节</option>' +
      HG.chapters.map((c) => `<option value="${c.n}">${pad2(c.n)} ${esc(c.titleZh)}</option>`).join('');

    function render() {
      const q = (qEl.value || '').trim().toLowerCase();
      const cat = catEl.value;
      const ch = chEl.value ? Number(chEl.value) : null;
      const onlyUnverified = verEl.checked;
      const list = (HG.terms || []).filter((t) => {
        if (cat && t.category !== cat) return false;
        if (ch && !(t.chapters || []).includes(ch)) return false;
        if (onlyUnverified && t.verified !== false) return false;
        if (!q) return true;
        return `${t.zh} ${t.en} ${(t.aliases || []).join(' ')}`.toLowerCase().includes(q);
      });
      countEl.textContent = `共 ${list.length} 条术语`;
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="4"><div class="empty">没有匹配的术语</div></td></tr>';
        return;
      }
      tbody.innerHTML = list
        .map(
          (t) => `<tr>
          <td><div class="term-zh">${esc(t.zh)} ${t.verified === false ? '<span class="badge warn">待核验</span>' : ''}</div>
              <div class="term-en">${esc(t.en)}${t.aliases && t.aliases.length ? ' · ' + esc(t.aliases.join(' / ')) : ''}</div></td>
          <td><span class="badge">${esc(t.category)}</span></td>
          <td><div class="term-def">${esc(t.definition)}</div>${t.note ? `<div class="faint small" style="margin-top:4px">注：${esc(t.note)}</div>` : ''}</td>
          <td><div class="term-chapters">${(t.chapters || []).map((n) => `<a href="${chapterHref(n)}">${pad2(n)}</a>`).join('')}</div></td>
        </tr>`
        )
        .join('');
    }
    [qEl, catEl, chEl, verEl].forEach((el) => el.addEventListener('input', render));
    render();
  }

  /* ------------------------------ 复习模式 ------------------------------ */
  function initReview() {
    const card = $('#flashcard');
    if (!card) return;
    const scopeEl = $('#review-scope');
    const modeEl = $('#review-mode');
    const frontEl = $('#fc-front');
    const subEl = $('#fc-sub');
    const answerEl = $('#fc-answer');
    const statsEl = $('#review-stats');
    const progressEl = $('#review-progress');
    const wrongEl = $('#wrong-list');

    scopeEl.innerHTML =
      '<option value="all">全部章节</option>' +
      HG.chapters.map((c) => `<option value="${c.n}">${pad2(c.n)} ${esc(c.titleZh)}</option>`).join('');

    // 支持从章节页带参数进入：review.html?chapter=5
    const presetScope = new URLSearchParams(location.search).get('chapter');
    if (presetScope && HG.chapters.some((c) => c.n === Number(presetScope))) {
      scopeEl.value = String(Number(presetScope));
    }

    let deck = [];
    let idx = 0;
    let shown = false;
    let sessionRight = 0;
    let sessionWrong = 0;

    function buildDeck() {
      const scope = scopeEl.value;
      const mode = modeEl.value;
      const chapters = HG.chapters.filter((c) => scope === 'all' || c.n === Number(scope));
      deck = [];
      for (const c of chapters) {
        if (mode === 'term') {
          for (const t of c.terms || []) {
            const gt = (HG.terms || []).find((x) => x.en.toLowerCase() === String(t.en).toLowerCase());
            deck.push({ kind: 'term', front: t.en, zh: t.zh, def: gt ? gt.definition : '', chapter: c.n, verified: gt ? gt.verified : true });
          }
        } else if (mode === 'quiz') {
          for (const [i, q] of (c.quiz || []).entries()) {
            deck.push({ kind: 'quiz', front: q.q, answer: q.a, tag: q.tag, chapter: c.n, qi: i });
          }
        } else if (mode === 'specimen') {
          for (const sp of c.specimens || []) {
            if (sp.kind !== 'slide') continue;
            deck.push({ kind: 'specimen', front: sp.name, caption: sp.caption, zh: sp.zh, stain: sp.stain, chapter: c.n, name: sp.name, url: sp.url });
          }
        }
      }
      shuffle(deck);
      idx = 0;
      sessionRight = sessionWrong = 0;
      renderCard();
    }
    function shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
    }
    function renderCard() {
      const item = deck[idx];
      card.classList.remove('revealed');
      shown = false;
      if (!item) {
        frontEl.textContent = '本组卡片已复习完';
        subEl.textContent = `本轮：记住 ${sessionRight} 张，需再练 ${sessionWrong} 张`;
        answerEl.innerHTML = '';
        if (progressEl) progressEl.textContent = '';
        return;
      }
      if (item.kind === 'term') {
        frontEl.textContent = item.front;
        subEl.textContent = `术语 · 第 ${item.chapter} 章 · 说出中文名`;
        answerEl.innerHTML = `<div class="fc-answer-main" style="font-family:var(--serif);font-size:26px">${esc(item.zh)}</div>
          ${item.def ? `<p class="def">${esc(item.def)}</p>` : ''}
          ${item.verified === false ? '<div class="badge warn">待核验</div>' : ''}`;
      } else if (item.kind === 'quiz') {
        frontEl.textContent = item.front;
        subEl.textContent = `自测题 · 第 ${item.chapter} 章 · ${esc(item.tag || '')}`;
        answerEl.innerHTML = `<p class="def">${esc(item.answer)}</p>`;
      } else if (item.kind === 'specimen') {
        frontEl.textContent = item.front;
        subEl.textContent = `标本识别 · 第 ${item.chapter} 章 · 先在心里说出结构名，再对照原站图像`;
        answerEl.innerHTML = `<div class="fc-answer-main" style="font-family:var(--serif);font-size:24px">${esc(item.zh || '（未命名）')}</div>
          <p class="def">${esc(item.caption || '')} ${item.stain ? '· ' + esc(item.stain) : ''}</p>
          <p><a class="btn small" href="${esc(HG_SITE + item.url)}" target="_blank" rel="noopener noreferrer">打开原站切片 ↗</a></p>`;
      }
      if (progressEl) progressEl.textContent = `${Math.min(idx + 1, deck.length)} / ${deck.length}`;
    }
    function reveal() {
      if (!deck[idx]) return;
      card.classList.add('revealed');
      shown = true;
    }
    function next(known) {
      const item = deck[idx];
      if (!item) { buildDeck(); return; }
      if (!shown) { reveal(); return; }
      if (known) sessionRight++;
      else {
        sessionWrong++;
        // 易错记录
        if (item.kind === 'quiz') progress.quizWrong[`${item.chapter}:${item.qi}`] = true;
        else if (item.kind === 'term') progress.review.last = item.front;
      }
      progress.review.seen = (progress.review.seen || 0) + 1;
      if (!known) progress.review.again = (progress.review.again || 0) + 1;
      saveProgress(progress);
      idx++;
      renderCard();
      renderStats();
    }
    function renderStats() {
      if (!statsEl) return;
      const total = HG.chapters.reduce((a, c) => a + (c.quiz || []).length, 0);
      const wrong = Object.keys(progress.quizWrong).length;
      statsEl.innerHTML = `<span>本轮：<b>${sessionRight}</b> 记住 / <b>${sessionWrong}</b> 再练</span>
        <span>累计复习：<b>${progress.review.seen || 0}</b> 张</span>
        <span>易错题：<b>${wrong}</b> / ${total}</span>`;
      if (wrongEl) {
        renderWrongList(wrongEl);
      }
    }
    function renderWrongList(el) {
      const keys = Object.keys(progress.quizWrong);
      if (!keys.length) {
        el.innerHTML = '<div class="empty small">还没有标记的易错题。在章节页或复习模式中点击“加入易错”即可。</div>';
        return;
      }
      el.innerHTML = keys
        .map((k) => {
          const [cn, qi] = k.split(':').map(Number);
          const c = HG.chapters.find((x) => x.n === cn);
          const q = c && c.quiz && c.quiz[qi];
          if (!q) return '';
          return `<div class="wrong-item">
            <div class="small faint">第 ${cn} 章 · ${esc(c.titleZh)} · ${esc(q.tag || '')}</div>
            <div class="wrong-q">${esc(q.q)}</div>
            <div class="small">答案：${esc(q.a)}</div>
            <div class="btn-row" style="margin-top:6px">
              <a class="btn small ghost" href="${chapterHref(cn)}#quiz">回章节</a>
              <button class="btn small ghost" data-remove-wrong="${k}">移除</button>
            </div>
          </div>`;
        })
        .join('');
      $$('[data-remove-wrong]', el).forEach((b) => {
        b.addEventListener('click', () => {
          delete progress.quizWrong[b.dataset.removeWrong];
          saveProgress(progress);
          renderStats();
        });
      });
    }

    $('#fc-reveal').addEventListener('click', reveal);
    $('#fc-known').addEventListener('click', () => next(true));
    $('#fc-again').addEventListener('click', () => next(false));
    modeEl.addEventListener('change', buildDeck);
    scopeEl.addEventListener('change', buildDeck);
    $('#review-restart') && $('#review-restart').addEventListener('click', buildDeck);

    document.addEventListener('keydown', (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        shown ? next(true) : reveal();
      } else if (e.key === 'ArrowRight') { e.preventDefault(); next(true); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); next(false); }
    });

    buildDeck();
    renderStats();
  }

  /* ------------------------------ 本地图像缩略图比例自适应 ------------------------------ */
  function fitThumbs(root) {
    (root || document).querySelectorAll('.specimen .thumb img').forEach((img) => {
      const apply = () => {
        const r = img.naturalWidth / (img.naturalHeight || 1);
        const t = img.closest('.thumb');
        if (!t) return;
        t.classList.toggle('wide', r > 2.2);
        t.classList.toggle('tall', r < 0.85);
      };
      if (img.complete && img.naturalWidth) apply();
      else img.addEventListener('load', apply, { once: true });
    });
  }

  /* ------------------------------ 启动 ------------------------------ */
  window.HG_SITE = (window.HG && window.HG.sourceSite) || 'https://histologyguide.com';
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initSearch();
    initHome();
    initChapterIndex();
    initChapterPage();
    initAtlas();
    initGlossary();
    initReview();
    initLightbox();
    fitThumbs();
  });
})();
