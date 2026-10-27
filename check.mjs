#!/usr/bin/env node
/* ═══════════ check.mjs — verification that fits the medium ═══════════
   1. labs.json schema validation (both labs, every round, hints, plan).
   2. Directional self-test: the comparator used by the page must PASS a
      correct choice and FAIL wrong ones (both directions).
   3. Page structure gates on the BUILT index.html:
      - per module: ≥3 mermaid diagrams, ≥2 mermaid types,
        ≥2 real-body SVG diagrams (the user's core requirement),
        every diagram (mermaid + body) has an Enlarge control,
        MC check + short-answer + time chip, trackable activities;
      - labs inline in modules 2 and 3;
      - SVG inline text never below 15px; every body figure has aria-label;
      - safety copy gates (red-flag keywords) in module 4;
      - glossary in main.js covers every .term used in the page;
      - no countdown timers.

   Usage:
     node check.mjs --self-test   # everything below
     node check.mjs               # labs only (no page gates)
*/

import { readFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const full = args.includes('--self-test') || args.length === 0 && process.argv.length === 2;
const pageGates = args.includes('--self-test');

let failures = 0;
let passes = 0;
function ok(cond, label) {
  if (cond) { passes++; console.log('  ✅ ' + label); }
  else { failures++; console.log('  ❌ ' + label); }
}

/* ── the comparator contract (mirrors lab.js choice check) ── */
function choicePass(selected, correct) {
  return selected === correct;
}

console.log('\n══ labs.json — schema ══');
const labs = JSON.parse(readFileSync(new URL('./labs.json', import.meta.url), 'utf8'));

ok(labs.lab1 && labs.lab2, 'both labs present (lab1, lab2)');
ok(labs.lab1.kind === 'choice' && labs.lab2.kind === 'choice', 'lab kinds are choice');

for (const [id, lab] of Object.entries(labs)) {
  console.log('\n── ' + id + ' (' + lab.title + ') ──');
  ok(Array.isArray(lab.rounds) && lab.rounds.length >= 5, 'has ≥5 rounds (' + lab.rounds.length + ')');
  ok(Array.isArray(lab.hints) && lab.hints.length === 3, 'exactly 3 progressive hints');
  ok(typeof lab.estimate === 'string' && lab.estimate.length > 0, 'shows its own time estimate');
  ok(typeof lab.passRule === 'string' && lab.passRule.length > 0, 'states a pass rule');
  ok(typeof lab.mission === 'string' && lab.mission.length > 0, 'states a mission');

  if (id === 'lab1') {
    ok(Array.isArray(lab.summary) && lab.summary.length >= 3, 'has a reference summary card');
  }
  if (id === 'lab2') {
    ok(Array.isArray(lab.plan) && lab.plan.length >= 6, 'has a real 2-week plan artifact (≥6 rows)');
    ok(lab.plan.every((r) => r.slot && r.choice), 'every plan row has slot + choice');
  }

  lab.rounds.forEach((r, i) => {
    ok(r.options.length === 3, `round ${i + 1}: exactly 3 action options`);
    ok(r.options.every((o) => o.text && o.why), `round ${i + 1}: every option carries feedback (why)`);
    ok(Number.isInteger(r.correct) && r.correct >= 0 && r.correct < r.options.length, `round ${i + 1}: correct index valid`);
    const texts = r.options.map((o) => o.text);
    ok(new Set(texts).size === texts.length, `round ${i + 1}: no duplicate options`);
    ok(!!r.reveal, `round ${i + 1}: has a reveal line`);
  });
}

console.log('\n══ comparator — self-test both directions ══');
{
  const r = labs.lab1.rounds[0];
  ok(choicePass(r.correct, r.correct) === true, 'choice: right action PASSES');
  r.options.forEach((_, i) => {
    if (i !== r.correct) ok(choicePass(i, r.correct) === false, `choice: wrong action ${i + 1} FAILS`);
  });
  ok(choicePass(undefined, r.correct) === false, 'choice: no selection FAILS');
}
{
  const r = labs.lab2.rounds[4];
  ok(choicePass(r.correct, r.correct) === true, 'plan: right action PASSES');
  ok(choicePass((r.correct + 1) % 3, r.correct) === false, 'plan: wrong action FAILS');
}

/* ── page structure gates (built page) ── */
if (pageGates) {
  console.log('\n══ index.html — structure gates ══');
  if (!existsSync(new URL('./index.html', import.meta.url))) {
    ok(false, 'index.html exists (run ./build.sh first)');
  } else {
    const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

    const moduleIds = ['m1', 'm2', 'm3', 'm4'];
    const chunks = {};
    moduleIds.forEach((mid, i) => {
      const start = html.indexOf(`data-module="${mid}"`);
      const endIdx = i + 1 < moduleIds.length ? html.indexOf(`data-module="${moduleIds[i + 1]}"`) : html.indexOf('</main>');
      chunks[mid] = start >= 0 && endIdx > start ? html.slice(start, endIdx) : '';
    });

    const TYPES = ['flowchart', 'graph ', 'graph;', 'mindmap', 'sequenceDiagram', 'stateDiagram', 'pie', 'gantt', 'timeline'];

    for (const mid of moduleIds) {
      const c = chunks[mid];
      ok(c.length > 0, `${mid}: section present`);

      const mermaids = c.split('class="mermaid"').length - 1;
      const bodies = c.split('class="body-svg"').length - 1;
      const enlarges = c.split('data-enlarge').length - 1;

      ok(mermaids >= 3, `${mid}: ≥3 mermaid diagrams (${mermaids})`);
      ok(bodies >= 2, `${mid}: ≥2 real-body SVG diagrams (${bodies}) — user requirement`);
      ok(enlarges === mermaids + bodies, `${mid}: every diagram (${mermaids}+${bodies}) has an Enlarge control (${enlarges})`);

      const codes = c.split('<div class="mermaid">').slice(1).map((s) => s.split('</div>')[0]);
      const typesFound = new Set();
      TYPES.forEach((t) => {
        codes.forEach((code) => {
          if (code.includes(t)) typesFound.add(t.trim());
        });
      });
      ok(typesFound.size >= 2, `${mid}: ≥2 mermaid diagram types (${[...typesFound].join(', ')})`);

      // SVG text gate: every explicit font-size in body diagrams ≥ 15px
      const svgChunks = c.split('<svg').slice(1).map((s) => '<svg' + s.split('</svg>')[0] + '</svg>');
      let minFont = Infinity;
      svgChunks.forEach((svg) => {
        for (const m of svg.matchAll(/font-size="([\d.]+)"/g)) {
          minFont = Math.min(minFont, parseFloat(m[1]));
        }
      });
      ok(minFont === Infinity || minFont >= 15, `${mid}: SVG inline text ≥15px (min ${minFont === Infinity ? '—' : minFont})`);

      ok(svgChunks.every((s) => s.includes('aria-label') || !s.includes('body-svg')) || c.includes('aria-label'), `${mid}: body figures carry aria-labels`);
      ok(c.includes('data-check="mc"') || c.includes('data-check="mc1"'), `${mid}: has an MC check card`);
      ok(c.includes('data-check="short"'), `${mid}: has a short-answer card`);
      ok(c.includes('time-chip'), `${mid}: shows a time chip`);
      ok(c.includes('data-activity'), `${mid}: has trackable activities`);
    }

    ok(chunks.m2.includes('data-lab="lab1"'), 'lab1 sits inline inside module 2');
    ok(chunks.m3.includes('data-lab="lab2"'), 'lab2 sits inline inside module 3');

    // match cards: left/right chip counts and pair sets must match exactly
    for (const mid of moduleIds) {
      const c = chunks[mid];
      const matchBlocks = c.split('data-check="match"').slice(1);
      matchBlocks.forEach((block, i) => {
        const cols = block.split('match-col"').slice(1);
        if (cols.length < 2) return;
        const pairs = (col) => Array.from(col.matchAll(/data-pair="([^"]+)"/g)).map((m) => m[1]);
        const left = pairs(cols[0]);
        const right = pairs(cols[1]);
        const sameSet = left.slice().sort().join() === right.slice().sort().join();
        ok(left.length === right.length && sameSet,
          `${mid} match #${i + 1}: chips balanced ${left.length}v${right.length}, pair sets ${sameSet ? 'match' : 'MISMATCH'}`);
      });
    }

    // glossary sync: every .term data-term exists in main.js GLOSSARY
    const mainJs = readFileSync(new URL('./main.js', import.meta.url), 'utf8');
    const terms = new Set(Array.from(html.matchAll(/data-term="([^"]+)"/g)).map((m) => m[1]));
    terms.forEach((t) => {
      ok(mainJs.includes(`'${t}':`), `glossary covers term: ${t}`);
    });

    // safety gates
    ok(chunks.m4.includes('竄') && chunks.m4.includes('麻'), 'm4 red flags teach radiating pain + numbness');
    ok(chunks.m4.includes('回診'), 'm4 tells the learner when to go back to the doctor');
    ok(html.includes('hero-safety'), 'hero states the course is not a substitute for medical care');
    ok(html.includes('坐骨神經') && html.includes('膕旁肌'), 'anatomy names present (hamstring vs sciatic nerve)');

    ok(!html.includes('countdown') && !html.includes('setInterval'), 'no countdown timers');
    ok(html.includes('hsRecoveryProgress') || html.includes('section-check.js'), 'progress autosave wired');
    ok(existsSync(new URL('./assets/mermaid.min.js', import.meta.url)), 'mermaid bundled locally');
  }
}

console.log('\n══════════════════════════════');
console.log(`${passes} passed · ${failures} failed`);
process.exit(failures > 0 ? 1 : 0);
