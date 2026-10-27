/* ═══════════ lab.js — inline lab engine ═══════════
   Renders labs from window.LAB_DATA (generated from labs.json at build
   time — single source of truth). Lab kind "choice": real-life decision
   rounds — pick the right action; every option carries its own feedback.
   Deterministic checking, 3 progressive hints, unlock-by-round,
   reference summary / two-week plan after completion. No timers, no scores. */

(function () {
  'use strict';
  const DATA = window.LAB_DATA || {};
  const Store = window.HSStore;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function renderLab(mount) {
    const id = mount.dataset.lab;
    const lab = DATA[id];
    if (!lab || !Store) return;
    mount.setAttribute('data-activity', id);

    const card = el('div', 'lab-card');
    card.id = id;

    const head = el('div', 'lab-head');
    head.append(
      el('span', 'lab-icon', lab.icon || '🧪'),
      el('h3', null, '實驗室｜' + lab.title),
      el('span', 'lab-est', '⏱ ' + lab.estimate)
    );

    const body = el('div', 'lab-body');
    body.append(el('p', 'lab-mission', '🧪 任務：' + lab.mission));
    body.append(el('p', 'lab-rule', '過關條件：' + lab.passRule));

    const state = Store.load().labs || {};
    const labState = state[id] || { passed: [], done: false };

    const roundsHost = el('div');

    function makeRound(ridx) {
      const r = lab.rounds[ridx];
      const round = el('div', 'lab-round');
      round.dataset.ridx = ridx;
      round.append(el('p', 'lab-round-tag', 'ROUND ' + (ridx + 1) + ' / ' + lab.rounds.length));
      round.append(el('p', 'rp', r.prompt));
      if (r.score) round.append(el('p', 'scenario-score', '📉 ' + r.score));

      const choices = el('div', 'lab-choices');
      const letters = ['Ａ', 'Ｂ', 'Ｃ', 'Ｄ'];
      const btns = r.options.map((o, i) => {
        const b = el('button', 'choice');
        const cn = el('span', 'cn', letters[i] + ' ');
        b.appendChild(cn);
        b.appendChild(document.createTextNode(o.text));
        b.addEventListener('click', () => {
          if (round.classList.contains('passed')) return;
          // clear wrong marks from previous attempts
          btns.forEach((x) => { if (!x.classList.contains('right')) { x.classList.remove('wrong'); const w = x.querySelector('.why'); if (w) w.remove(); } });
          if (i === r.correct) {
            b.classList.add('right');
            const why = el('span', 'why', '✅ ' + o.why);
            b.appendChild(why);
            round.classList.add('passed');
            btns.forEach((x, j) => { if (j !== r.correct) x.disabled = true; });
            const rev = el('div', 'lab-reveal');
            rev.appendChild(el('span', 'rr', r.reveal));
            if (r.note) rev.appendChild(el('span', 'rn', r.note));
            round.appendChild(rev);
            onRoundPass(ridx);
          } else {
            b.classList.add('wrong');
            const why = el('span', 'why', '❌ ' + o.why);
            b.appendChild(why);
          }
        });
        choices.appendChild(b);
        return b;
      });
      round.append(choices);
      return round;
    }

    const roundEls = lab.rounds.map((_, i) => makeRound(i));
    roundEls.forEach((r) => roundsHost.appendChild(r));

    function refreshLocks() {
      roundEls.forEach((r, i) => {
        const unlocked = i === 0 || labState.passed.includes(i - 1);
        r.dataset.locked = unlocked ? '0' : '1';
        const passed = r.classList.contains('passed');
        r.querySelectorAll('button').forEach((b) => {
          b.disabled = !unlocked || passed;
        });
      });
    }

    function onRoundPass(ridx) {
      if (!labState.passed.includes(ridx)) labState.passed.push(ridx);
      const s = Store.load();
      s.labs = s.labs || {};
      s.labs[id] = { passed: labState.passed, done: labState.passed.length === lab.rounds.length };
      Store.save(s);
      refreshLocks();
      if (labState.passed.length === lab.rounds.length && !labState.done) {
        labState.done = true;
        finishLab();
      }
    }

    function finishLab() {
      card.classList.add('done');
      mount.dataset.done = '1';
      if (summaryBox) summaryBox.hidden = false;
      const doneNote = el('p', 'lab-done-note', '🎉 實驗室完成——全部通過！');
      body.insertBefore(doneNote, hintsHost);
      Store.markActivity(id);
      mount.dispatchEvent(new CustomEvent('hs-activity-complete', {
        bubbles: true,
        detail: { activity: id, module: mount.closest('.module')?.dataset.module, isLab: true }
      }));
    }

    // hints (3 progressive)
    const hintsHost = el('div', 'lab-hints');
    const hintBtn = el('button', 'btn btn-ghost small', '💡 給我提示（0/' + lab.hints.length + '）');
    const hintList = el('ul');
    let hintCount = 0;
    hintBtn.addEventListener('click', () => {
      if (hintCount < lab.hints.length) {
        hintList.appendChild(el('li', null, lab.hints[hintCount]));
        hintCount++;
        hintBtn.textContent = '💡 給我提示（' + hintCount + '/' + lab.hints.length + '）';
        if (hintCount >= lab.hints.length) hintBtn.disabled = true;
      }
    });
    hintsHost.append(hintBtn, hintList);

    // reference summary / plan (revealed after completion)
    const summaryBox = el('div', 'lab-summary');
    const h4 = el('h4', null, lab.summaryTitle || '📗 參考總結（過關後解鎖）');
    summaryBox.append(h4);
    const ol = el('ol');
    (lab.plan || lab.summary || []).forEach((row) => {
      const li = el('li');
      if (typeof row === 'string') {
        li.textContent = row;
      } else {
        li.innerHTML = '<b>' + row.slot + '：</b>' + row.choice;
      }
      ol.appendChild(li);
    });
    summaryBox.appendChild(ol);
    if (lab.planNote) summaryBox.appendChild(el('p', 'plan-note', lab.planNote));
    summaryBox.hidden = true;

    body.append(roundsHost, hintsHost);
    refreshLocks();

    // restore passed rounds
    labState.passed.forEach((ridx) => {
      const r = lab.rounds[ridx];
      const round = roundEls[ridx];
      round.classList.add('passed');
      const rightBtn = round.querySelectorAll('.choice')[r.correct];
      rightBtn.classList.add('right');
      rightBtn.appendChild(el('span', 'why', '✅ ' + r.options[r.correct].why));
      round.querySelectorAll('.choice').forEach((x, j) => { if (j !== r.correct) x.disabled = true; });
      const rev = el('div', 'lab-reveal');
      rev.appendChild(el('span', 'rr', r.reveal));
      if (r.note) rev.appendChild(el('span', 'rn', r.note));
      round.appendChild(rev);
    });

    if (labState.done) {
      card.classList.add('done');
      mount.dataset.done = '1';
      summaryBox.hidden = false;
      if (!mount.querySelector('.lab-done-note')) {
        const doneNote = el('p', 'lab-done-note', '🎉 實驗室完成——全部通過！');
        body.insertBefore(doneNote, hintsHost);
      }
    } else if (labState.passed.length === lab.rounds.length) {
      labState.done = true;
      card.classList.add('done');
      mount.dataset.done = '1';
      summaryBox.hidden = false;
    }
    body.appendChild(summaryBox);
    card.append(head, body);
    mount.appendChild(card);
  }

  function init() {
    document.querySelectorAll('[data-lab]').forEach(renderLab);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
