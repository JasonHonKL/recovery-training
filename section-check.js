/* ═══════════ section-check.js ═══════════
   Engines for: MC checks (data-check="mc" / "mc1"), predict-reveal,
   order-the-tiles, match-pairs, short-answer cards.
   Everything is formative: unscored, retryable, autosaved. No timers. */

(function () {
  'use strict';

  /* ── shared progress store ─────────────────── */
  const KEY = 'hsRecoveryProgress';
  function loadState() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function saveState(state) {
    state.updated = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: keep going */ }
  }
  const Store = {
    load: loadState,
    save: saveState,
    markActivity(id) {
      const s = loadState();
      s.activities = s.activities || {};
      s.activities[id] = true;
      saveState(s);
    },
    saveShort(id, text) {
      const s = loadState();
      s.shorts = s.shorts || {};
      s.shorts[id] = text;
      saveState(s);
    },
    isActivityDone(id) {
      const s = loadState();
      return !!(s.activities && s.activities[id]);
    }
  };
  window.HSStore = Store;

  function complete(el) {
    if (!el.dataset.done) {
      el.dataset.done = '1';
      el.classList.add('completed');
      const done = el.querySelector('.micro-done');
      if (done) done.hidden = false;
      Store.markActivity(el.dataset.activity);
      el.dispatchEvent(new CustomEvent('hs-activity-complete', {
        bubbles: true,
        detail: { activity: el.dataset.activity, module: moduleOf(el) }
      }));
    }
  }
  function moduleOf(el) {
    const m = el.closest('.module');
    return m ? m.dataset.module : null;
  }

  /* ── MC engine (mc = multi-question card, mc1 = one-question recall) ── */
  function initMC(card) {
    const qs = card.querySelectorAll('.mc-q');
    const groups = qs.length ? Array.from(qs) : [card];
    let solved = 0;
    const total = groups.reduce((n, g) => n + g.querySelectorAll('.opt').length ? n + 1 : n, 0);

    card.querySelectorAll('.opt').forEach((opt) => {
      opt.addEventListener('click', () => {
        const q = opt.closest('.mc-q') || card;
        if (q.dataset.solved) return;
        const isOK = opt.dataset.ok === 'true';
        q.querySelectorAll('.opt.picked-no').forEach((o) => {
          o.classList.remove('picked-no');
          const fb = o.querySelector('.fb'); if (fb) fb.remove();
        });
        const old = opt.querySelector('.fb'); if (old) old.remove();
        const fb = document.createElement('span');
        fb.className = 'fb';
        fb.textContent = opt.dataset.fb || '';
        opt.appendChild(fb);
        if (isOK) {
          opt.classList.add('picked-ok');
          q.dataset.solved = '1';
          solved++;
          if (solved >= total) complete(card);
        } else {
          opt.classList.add('picked-no');
        }
      });
    });
  }

  /* ── predict / reveal engine ───────────────── */
  function initReveal(card) {
    const cards = Array.from(card.querySelectorAll('.reveal-card'));
    cards.forEach((c) => c.addEventListener('click', () => {
      c.classList.add('flipped');
      if (cards.every((x) => x.classList.contains('flipped'))) complete(card);
    }));
  }

  /* ── order-the-tiles engine ────────────────── */
  function initOrder(card) {
    const answer = card.dataset.answer.split(',');
    const tray = card.querySelector('[data-tiles]');
    const slots = card.querySelector('[data-slots]');
    if (!tray || !slots) return;
    Array.from(tray.children)
      .sort(() => Math.random() - 0.5)
      .forEach((t) => tray.appendChild(t));

    tray.addEventListener('click', (e) => {
      const tile = e.target.closest('.tile');
      if (!tile || tile.classList.contains('slot')) return;
      tile.classList.add('placed');
      slots.appendChild(tile);
      check();
    });
    slots.addEventListener('click', (e) => {
      const tile = e.target.closest('.tile');
      if (!tile || slots.classList.contains('ok')) return;
      tile.classList.remove('placed');
      tray.appendChild(tile);
    });

    function check() {
      const placed = Array.from(slots.querySelectorAll('.tile')).map((t) => t.dataset.tile);
      if (placed.length < answer.length) return;
      const ok = placed.every((v, i) => v === answer[i]);
      if (ok) {
        slots.classList.add('ok');
        complete(card);
      } else {
        slots.classList.add('no');
        setTimeout(() => {
          slots.classList.remove('no');
          Array.from(slots.querySelectorAll('.tile')).forEach((t) => {
            t.classList.remove('placed');
            tray.appendChild(t);
          });
        }, 650);
      }
    }
  }

  /* ── match-pairs engine ────────────────────── */
  function initMatch(card) {
    const cols = card.querySelectorAll('.match-col');
    if (cols.length < 2) return;
    const left = cols[0], right = cols[1];
    Array.from(right.children)
      .sort(() => Math.random() - 0.5)
      .forEach((c) => right.appendChild(c));

    let active = null;
    const total = left.children.length;
    let locked = 0;

    card.addEventListener('click', (e) => {
      const chip = e.target.closest('.mchip');
      if (!chip || chip.classList.contains('locked')) return;
      if (!active) { active = chip; chip.classList.add('active'); return; }
      if (active === chip) { chip.classList.remove('active'); active = null; return; }
      const sameCol = chip.parentElement === active.parentElement;
      if (sameCol) {
        active.classList.remove('active');
        active = chip; chip.classList.add('active');
        return;
      }
      if (chip.dataset.pair === active.dataset.pair) {
        chip.classList.add('locked');
        active.classList.add('locked');
        active.classList.remove('active');
        active = null;
        locked++;
        if (locked >= total) complete(card);
      } else {
        chip.classList.add('shake');
        setTimeout(() => chip.classList.remove('shake'), 400);
      }
    });
  }

  /* ── short-answer engine ───────────────────── */
  function initShort(card) {
    const id = card.dataset.activity;
    const model = card.dataset.model || '';
    const checks = (card.dataset.selfcheck || '').split('|').filter(Boolean);

    const ta = document.createElement('textarea');
    ta.placeholder = '寫下妳的想法…（自動保存，只有妳看得到）';
    const saved = (Store.load().shorts || {})[id];
    if (saved) ta.value = saved;

    const hint = document.createElement('p');
    hint.className = 'save-hint';
    hint.textContent = '✍️ 自動保存於妳的瀏覽器';

    const btn = document.createElement('button');
    btn.className = 'btn btn-ghost small';
    btn.textContent = '寫完了，看參考答案 →';

    const revealBox = document.createElement('div');
    revealBox.hidden = true;
    const modelBox = document.createElement('div');
    modelBox.className = 'model-answer';
    modelBox.textContent = model;
    const list = document.createElement('ul');
    list.className = 'selfcheck-list';
    checks.forEach((c) => {
      const li = document.createElement('li');
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      const span = document.createElement('span');
      span.textContent = c;
      label.append(cb, span);
      li.appendChild(label);
      list.appendChild(li);
    });
    const selfNote = document.createElement('p');
    selfNote.className = 'save-hint';
    selfNote.textContent = '三個都打勾，這一節就完成了。';

    revealBox.append(modelBox, list, selfNote);
    card.append(ta, hint, btn, revealBox);

    let timer = null;
    ta.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        Store.saveShort(id, ta.value);
        hint.textContent = '💾 已保存 ' + new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
      }, 400);
    });

    btn.addEventListener('click', () => {
      revealBox.hidden = !revealBox.hidden;
      btn.textContent = revealBox.hidden ? '寫完了，看參考答案 →' : '收起參考答案';
    });

    list.addEventListener('change', () => {
      const all = Array.from(list.querySelectorAll('input')).every((i) => i.checked);
      if (all) complete(card);
    });

    if (Store.isActivityDone(id)) {
      revealBox.hidden = false;
      btn.textContent = '收起參考答案';
      card.dataset.done = '1';
      card.classList.add('completed');
      list.querySelectorAll('input').forEach((i) => (i.checked = true));
    }
  }

  /* ── restore + boot ────────────────────────── */
  function init() {
    document.querySelectorAll('[data-check]').forEach((card) => {
      const id = card.dataset.activity;
      const kind = card.dataset.check;
      if (kind === 'mc' || kind === 'mc1') initMC(card);
      else if (kind === 'reveal') initReveal(card);
      else if (kind === 'order') initOrder(card);
      else if (kind === 'match') initMatch(card);
      else if (kind === 'short') { initShort(card); return; }

      if (kind !== 'short' && Store.isActivityDone(id)) {
        card.dataset.done = '1';
        card.classList.add('completed');
        const done = card.querySelector('.micro-done');
        if (done) done.hidden = false;
        if (kind === 'reveal') {
          card.querySelectorAll('.reveal-card').forEach((c) => c.classList.add('flipped'));
        }
        if (kind === 'mc' || kind === 'mc1') {
          card.querySelectorAll('.mc-q').forEach((q) => (q.dataset.solved = '1'));
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
