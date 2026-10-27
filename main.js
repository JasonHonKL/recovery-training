/* ═══════════ main.js — orchestration ═══════════
   Mermaid (local build, white theme) + hand-drawn body diagrams,
   shared Enlarge dialogs (zoom/pan/reset/Esc), progress rail,
   resume, glossary tooltips, celebrations, reset. */

(function () {
  'use strict';
  const Store = window.HSStore;

  /* ── glossary ──────────────────────────────── */
  const GLOSSARY = {
    '膕旁肌': '大腿後側的肌肉群，又稱「腿後肌」「後大腿肌」。由三條肌肉組成，從臀部坐骨連到膝蓋後方，負責把大腿往後推和彎曲膝蓋。',
    '坐骨粗隆': '骨盆底部、坐下時接觸椅面的那塊骨頭。膕旁肌三條肌肉都從這裡出發——所以拉傷常痛在臀部下緣。',
    '部分撕裂': '第二級拉傷：一部分肌纖維斷裂，但肌肉沒有完全分開。力量明顯受影響，通常需要 6–12 週的漸進恢復。',
    '疤痕組織': '身體修復撕裂處填補的「新材料」。初期鬆散脆弱，之後靠溫和的活動訊號慢慢排列變強——完全不動反而讓它長得短而亂。',
    '臀大肌': '臀部最大塊的肌肉，負責把身體推直（起身、爬樓、走路推進）。它有力，腿後肌就不用一個人扛。',
    '坐骨神經': '從腰椎出發、經臀部沿大腿後側走到腳的神經。如果痛會「竄」過膝蓋到小腿或腳、伴隨麻木，可能是它在抗議，跟膕旁肌拉傷不同。',
    '離心收縮': '肌肉一邊被拉長、一邊出力的收縮方式（例如慢慢坐下）。膕旁肌受傷的經典動作模式，也是復健後期要練的重點。'
  };

  function initTooltips() {
    let popper = null;
    function show(term) {
      hide();
      const rect = term.getBoundingClientRect();
      popper = document.createElement('div');
      popper.className = 'tooltip-popper';
      popper.textContent = GLOSSARY[term.dataset.term] || '';
      document.body.appendChild(popper);
      const w = Math.min(300, window.innerWidth - 24);
      popper.style.maxWidth = w + 'px';
      let top = rect.bottom + 8 + window.scrollY;
      let left = Math.max(12, Math.min(rect.left + window.scrollX, window.scrollX + window.innerWidth - w - 12));
      popper.style.top = top + 'px';
      popper.style.left = left + 'px';
    }
    function hide() {
      if (popper) { popper.remove(); popper = null; }
    }
    document.querySelectorAll('.term').forEach((t) => {
      t.addEventListener('mouseenter', () => show(t));
      t.addEventListener('mouseleave', hide);
      t.addEventListener('click', (e) => {
        e.preventDefault();
        popper && popper._term === t ? hide() : (show(t), popper && (popper._term = t));
      });
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.term')) hide();
    });
    window.addEventListener('scroll', hide, { passive: true });
  }

  /* ── mermaid + body diagrams + enlarge dialogs ─ */
  async function initMermaid() {
    if (typeof mermaid === 'undefined') return;
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'loose',
      fontFamily: '"Noto Sans TC",system-ui,sans-serif',
      themeVariables: {
        background: '#FFFFFF',
        primaryColor: '#FFFFFF',
        primaryTextColor: '#1A1A1A',
        primaryBorderColor: '#1A1A1A',
        secondaryColor: '#FAFAFA',
        tertiaryColor: '#FAFAFA',
        lineColor: '#595959',
        textColor: '#1A1A1A',
        mainBkg: '#FFFFFF',
        nodeBorder: '#1A1A1A',
        clusterBkg: '#FAFAFA',
        clusterBorder: '#D6D6D6',
        edgeLabelBackground: '#FFFFFF',
        fontSize: '17px'
      }
    });
    const blocks = Array.from(document.querySelectorAll('.mermaid'));
    for (let i = 0; i < blocks.length; i++) {
      const code = blocks[i].textContent.trim();
      try {
        const { svg } = await mermaid.render('mmd-' + i, code);
        blocks[i].innerHTML = svg;
        blocks[i]._code = code;
      } catch (err) {
        const pre = document.createElement('pre');
        pre.style.cssText = 'font-size:14px;color:#767676;overflow-x:auto;';
        pre.textContent = code;
        blocks[i].innerHTML = '';
        blocks[i].appendChild(pre);
      }
    }
    document.querySelectorAll('[data-enlarge]').forEach((btn) => {
      btn.addEventListener('click', () => openEnlarge(btn));
    });
  }

  function openEnlarge(btn) {
    const fig = btn.closest('.diagram');
    const caption = fig.querySelector('figcaption').textContent;
    const svg = fig.querySelector('.mermaid svg') || fig.querySelector('.body-svg svg');
    if (!svg) return;

    const dlg = document.createElement('dialog');
    dlg.className = 'enlarge-dialog';

    const bar = document.createElement('div');
    bar.className = 'enlarge-toolbar';
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = caption;
    const mk = (label, fn) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', fn);
      return b;
    };
    const stage = document.createElement('div');
    stage.className = 'enlarge-stage';
    const wrap = document.createElement('div');
    wrap.className = 'zoom-wrap';
    const clone = svg.cloneNode(true);
    clone.style.maxWidth = 'none';
    clone.style.width = '';
    clone.style.height = '';
    if (!clone.getAttribute('width') && clone.getAttribute('viewBox')) {
      const vb = clone.getAttribute('viewBox').split(/[\s,]+/).map(Number);
      if (vb.length === 4 && vb[2]) clone.setAttribute('width', Math.min(1600, Math.max(vb[2], 900)));
    }
    wrap.appendChild(clone);
    stage.appendChild(wrap);

    let scale = 1, tx = 0, ty = 0;
    function apply() {
      wrap.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
      zlabel.textContent = Math.round(scale * 100) + '%';
    }
    const zoom = (f) => { scale = Math.min(6, Math.max(0.4, scale * f)); apply(); };
    const reset = () => { scale = 1; tx = 0; ty = 0; apply(); };

    const zlabel = document.createElement('span');
    zlabel.className = 'title';
    zlabel.style.cssText = 'margin:0 4px 0 auto;color:#767676;cursor:default;';
    bar.append(
      title,
      mk('−', () => zoom(1 / 1.25)),
      mk('+', () => zoom(1.25)),
      zlabel,
      mk('重置', reset),
      mk('關閉 ✕', () => dlg.close())
    );

    let dragging = null;
    const move = (x, y) => {
      if (!dragging) return;
      tx = dragging.tx + (x - dragging.x);
      ty = dragging.ty + (y - dragging.y);
      apply();
    };
    stage.addEventListener('pointerdown', (e) => { dragging = { x: e.clientX, y: e.clientY, tx, ty }; });
    window.addEventListener('pointermove', (e) => move(e.clientX, e.clientY));
    window.addEventListener('pointerup', () => { dragging = null; });
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });

    dlg.append(bar, stage);
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => { dlg.remove(); btn.focus(); });
    dlg.showModal();
    reset();

    requestAnimationFrame(() => {
      const r = wrap.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      tx = Math.max(0, (s.width - r.width) / 2);
      ty = Math.max(0, (s.height - r.height) / 2);
      apply();
    });
  }

  /* ── progress + rail ───────────────────────── */
  const MODULE_META = {
    m1: { n: 1, label: '這是什麼？', t: '≈7 分' },
    m2: { n: 2, label: '紅綠燈 + 實驗室', t: '≈17 分' },
    m3: { n: 3, label: '動作庫 + 實驗室', t: '≈18 分' },
    m4: { n: 4, label: '安全工具箱', t: '≈7 分' }
  };

  function moduleActivities(mid) {
    const m = document.querySelector('.module[data-module="' + mid + '"]');
    if (!m) return [];
    return Array.from(m.querySelectorAll('[data-activity]'));
  }
  function moduleDone(mid) {
    const acts = moduleActivities(mid);
    return acts.length > 0 && acts.every((a) => a.dataset.done === '1');
  }
  function overallProgress() {
    const all = Array.from(document.querySelectorAll('[data-activity]'));
    const done = all.filter((a) => a.dataset.done === '1').length;
    return { done, total: all.length, pct: all.length ? Math.round((done / all.length) * 100) : 0 };
  }

  function buildRail() {
    const rail = document.getElementById('railInner');
    if (!rail) return;
    rail.innerHTML = '';
    Object.entries(MODULE_META).forEach(([mid, meta]) => {
      const b = document.createElement('button');
      b.className = 'rail-item';
      b.dataset.for = mid;
      b.innerHTML = '<span class="dot"></span><span>' + meta.n + '. ' + meta.label + '</span><span class="t">' + meta.t + '</span>';
      b.addEventListener('click', () => {
        document.getElementById(mid).scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      rail.appendChild(b);
    });
  }

  function refreshProgressUI() {
    const { done, total, pct } = overallProgress();
    document.getElementById('progressFill').style.width = pct + '%';
    const label = document.getElementById('heroProgressLabel');
    const resume = document.getElementById('resumeBtn');
    if (done > 0) {
      label.hidden = false;
      label.textContent = '進度：' + done + ' / ' + total + ' 個任務（' + pct + '%）——全部保存在這台瀏覽器裡';
      resume.hidden = false;
    }
    Object.keys(MODULE_META).forEach((mid) => {
      const item = document.querySelector('.rail-item[data-for="' + mid + '"]');
      if (item) item.classList.toggle('done', moduleDone(mid));
    });
  }

  function firstIncompleteModule() {
    return Object.keys(MODULE_META).find((mid) => !moduleDone(mid)) || 'm4';
  }

  /* ── celebration ───────────────────────────── */
  let celebrated = {};
  try { celebrated = JSON.parse(localStorage.getItem('hsCelebrated') || '{}'); } catch (e) { celebrated = {}; }

  function confetti() {
    const host = document.createElement('div');
    host.className = 'celebrate';
    const glyphs = ['🌿', '⭐️', '💫', '🦵', '💖', '✨', '🌸'];
    for (let i = 0; i < 26; i++) {
      const c = document.createElement('span');
      c.className = 'confetti';
      c.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
      c.style.left = Math.random() * 100 + 'vw';
      c.style.animationDelay = (Math.random() * 0.7) + 's';
      c.style.fontSize = (16 + Math.random() * 14) + 'px';
      host.appendChild(c);
    }
    document.body.appendChild(host);
    setTimeout(() => host.remove(), 3600);
  }

  function banner(text) {
    const b = document.createElement('div');
    b.className = 'module-complete-banner';
    b.textContent = text;
    document.body.appendChild(b);
    requestAnimationFrame(() => b.classList.add('show'));
    setTimeout(() => {
      b.classList.remove('show');
      setTimeout(() => b.remove(), 500);
    }, 4200);
  }

  function onActivityComplete(e) {
    const mid = e.detail.module;
    refreshProgressUI();
    if (e.detail.isLab) {
      confetti();
      banner('🎉 實驗室通關！想休息的話，現在是完美的休息點。');
      return;
    }
    if (mid && moduleDone(mid) && !celebrated[mid]) {
      celebrated[mid] = true;
      localStorage.setItem('hsCelebrated', JSON.stringify(celebrated));
      confetti();
      const meta = MODULE_META[mid];
      const { pct } = overallProgress();
      banner('🎉 第 ' + meta.n + ' 章完成！整體進度 ' + pct + '%——休息一下也完全 OK。');
    }
  }

  /* ── current module highlight ──────────────── */
  function initObserver() {
    const modules = document.querySelectorAll('.module');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          document.querySelectorAll('.rail-item').forEach((i) => i.classList.remove('current'));
          const item = document.querySelector('.rail-item[data-for="' + en.target.dataset.module + '"]');
          if (item) item.classList.add('current');
        }
      });
    }, { rootMargin: '-30% 0px -55% 0px' });
    modules.forEach((m) => io.observe(m));
  }

  /* ── boot ──────────────────────────────────── */
  function init() {
    buildRail();
    initTooltips();
    initObserver();
    refreshProgressUI();

    document.addEventListener('hs-activity-complete', onActivityComplete);

    const start = document.getElementById('startBtn');
    const resume = document.getElementById('resumeBtn');
    if (start) start.addEventListener('click', () => {
      document.getElementById('m1').scrollIntoView({ behavior: 'smooth' });
    });
    if (resume) resume.addEventListener('click', () => {
      const mid = firstIncompleteModule();
      const m = document.getElementById(mid);
      if (m) m.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const reset = document.getElementById('resetBtn');
    if (reset) reset.addEventListener('click', () => {
      if (confirm('確定要清掉所有進度、答案和實驗室紀錄嗎？')) {
        localStorage.removeItem('hsRecoveryProgress');
        localStorage.removeItem('hsCelebrated');
        location.reload();
      }
    });

    initMermaid();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
