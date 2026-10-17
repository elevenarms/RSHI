/**
 * Variant 3, "Editorial": warm paper, a serif headline that IS the caption, the team as a flow
 * diagram with messages traveling along its arrows, a framed "Fig. 1" of the game, a feature
 * box the director fills with the moment, and the numbers column on the right. The exam turns
 * the page into a full-width infographic spread.
 */

import { ROLE_INFO, PHASES, type Role, type World } from './mock';
import { esc, evalBars, evoChart, examBars, h, heatmap, lessonList, pct, proposalCard, Revs, sceneUrl, signed, toolRow, tween } from './ui';
import type { Ctx, Spot, View } from './view';

// Flow diagram layout (viewBox 1100×300). The loop: brief → plan → play → review → propose → judge.
const NODE: Record<Role, [number, number]> = {
  librarian: [90, 110],
  planner: [270, 110],
  loader: [450, 110],
  critic: [630, 110],
  coach: [810, 110],
  gatekeeper: [990, 110],
};
const EDGES: [Role, Role, string][] = [
  ['librarian', 'planner', 'brief'],
  ['planner', 'loader', 'plan'],
  ['loader', 'critic', 'episode'],
  ['critic', 'coach', 'lessons'],
  ['coach', 'gatekeeper', 'proposal'],
];

function edgePath(a: Role, b: Role): string {
  const [x1, y1] = NODE[a];
  const [x2, y2] = NODE[b];
  return `M${x1 + 52},${y1} L${x2 - 52},${y2}`;
}
// The return arcs: critic → librarian (memory), gatekeeper → planner (new genome).
const RETURN_MEM = `M630,160 C630,220 90,220 90,160`;
const RETURN_GENOME = `M990,160 C990,300 270,300 270,160`;

function pathFor(from: Role, to: Role | 'all'): string | null {
  if (to === 'all') return null;
  const direct = EDGES.find(([a, b]) => a === from && b === to);
  if (direct) return edgePath(from, to);
  if (from === 'critic' && to === 'librarian') return RETURN_MEM;
  if (from === 'gatekeeper') return RETURN_GENOME;
  if (from === 'librarian' && to === 'loader') return `M90,60 C90,0 450,0 450,60`;
  const [x1, y1] = NODE[from];
  const [x2, y2] = NODE[to];
  return `M${x1},${y1 - 50} C${x1},${y1 - 110} ${x2},${y2 - 110} ${x2},${y2 - 50}`;
}

export function editorial(): View {
  const revs = new Revs();
  let root: HTMLElement;
  let headline: HTMLElement;
  let flowEl: HTMLElement;
  let feature: HTMLElement;
  let figure: HTMLElement;
  let numbers: HTMLElement;
  let memory: HTMLElement;
  let spread: HTMLElement;
  let sceneN = -1;

  function mount(stage: HTMLElement): void {
    root = stage;
    const mast = h('header', 'mast');
    mast.innerHTML = `<div class="m-name">CREW</div><div class="m-tag">Field notes from a team that teaches itself<br/>to load the dishwasher</div><div class="m-meta"><span data-k="issue">Generation 3</span><span data-k="phase">Practice</span><span>Crusoe Managed Inference</span></div>`;
    headline = h('section', 'headline');
    const left = h('section', 'col-left');
    flowEl = h('div', 'flow');
    flowEl.innerHTML = flowSvg();
    const row = h('div', 'row');
    figure = h('figure', 'fig', `<div class="frame"><img class="a"/><img class="b"/><div class="sheen"></div></div><figcaption></figcaption>`);
    feature = h('div', 'feature');
    row.append(figure, feature);
    left.append(flowEl, row);
    const right = h('section', 'col-right');
    numbers = h('div', 'numbers');
    memory = h('div', 'memory');
    right.append(numbers, memory);
    spread = h('section', 'spread');
    root.append(mast, headline, left, right, spread);
  }

  function flowSvg(): string {
    const edges = EDGES.map(([a, b, l]) => {
      const [x1] = NODE[a];
      const [x2] = NODE[b];
      return `<path class="edge" d="${edgePath(a, b)}" marker-end="url(#ah)"/><text class="elabel" x="${(x1 + x2) / 2}" y="92">${l}</text>`;
    }).join('');
    const nodes = (Object.keys(NODE) as Role[])
      .map((r) => {
        const [x, y] = NODE[r];
        return `<g class="fnode" data-r="${r}" style="--rc:var(--${r})" transform="translate(${x},${y})"><circle class="ring" r="50"/><circle class="disc" r="42"/><text class="fglyph" y="12">${ROLE_INFO[r].glyph}</text><text class="fname" y="-62">${ROLE_INFO[r].name}</text></g>`;
      })
      .join('');
    return `<svg viewBox="0 -20 1100 330"><defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" class="ahead"/></marker></defs>
      ${edges}<path class="edge ret" d="${RETURN_MEM}" marker-end="url(#ah)"/><text class="elabel" x="150" y="236">remembers</text>
      <path class="edge ret" d="${RETURN_GENOME}" marker-end="url(#ah)"/><text class="elabel" x="630" y="296">a better team, if it wins</text>
      <g class="flights"></g>${nodes}</svg>`;
  }

  function fly(from: Role, to: Role | 'all'): void {
    const g = flowEl.querySelector('.flights');
    const d = pathFor(from, to);
    if (!g || !d) return;
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    p.setAttribute('r', '11');
    p.setAttribute('class', 'flight');
    p.style.setProperty('--rc', `var(--${from})`);
    p.style.offsetPath = `path('${d}')`;
    g.append(p);
    p.animate([{ offsetDistance: '0%' }, { offsetDistance: '100%' }], { duration: 1400, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => p.remove();
  }

  function update(w: World, ctx: Ctx): void {
    const spot = ctx.present ? ctx.spot : null;
    root.dataset['spot'] = spot ?? '';
    if (revs.changed(w, 'phase') || revs.changed(w, 'evo')) {
      root.querySelector('[data-k=issue]')!.textContent = `Generation ${w.generation}`;
      root.querySelector('[data-k=phase]')!.textContent = w.phase[0]!.toUpperCase() + w.phase.slice(1);
      renderNumbers(w);
    }
    if (revs.changed(w, 'caption')) {
      const c = w.caption;
      headline.innerHTML = `<div class="kicker" style="--rc:var(--${c.role ?? 'critic'})">${esc(c.kicker)}</div><h1>${esc(c.text)}</h1>`;
      headline.classList.remove('in');
      void headline.offsetWidth;
      headline.classList.add('in');
    }
    if (revs.changed(w, 'agents')) {
      for (const r of Object.keys(NODE) as Role[]) {
        flowEl.querySelector(`.fnode[data-r=${r}]`)?.setAttribute('class', `fnode ${w.agents[r].status}`);
      }
    }
    if (revs.changed(w, 'msgs') && w.lastMsg) fly(w.lastMsg.from, w.lastMsg.to);
    if (revs.changed(w, 'episode')) {
      const e = w.episode;
      if (e.scene !== sceneN) {
        sceneN = e.scene;
        const a = figure.querySelector<HTMLImageElement>('img.a')!;
        const b = figure.querySelector<HTMLImageElement>('img.b')!;
        const front = a.classList.contains('front') ? a : b;
        const back = front === a ? b : a;
        back.src = sceneUrl(e.scene);
        back.classList.add('front');
        front.classList.remove('front');
      }
      figure.querySelector('figcaption')!.innerHTML = `<b>Fig. 1</b> The Loader on “${esc(e.task)}”. ${e.wash === 'running' ? 'Washing (simulated, Eco 50).' : e.wash === 'done' ? `${e.points} of ${e.available} points.` : `${e.placed} of ${e.items} items placed.`}`;
    }
    const fchanged = revs.changed(w, 'moment') || revs.changed(w, 'eval') || revs.changed(w, 'tools');
    if (fchanged || ctx.spotChanged) renderFeature(w);
    if (revs.changed(w, 'mem')) {
      memory.innerHTML = `<h3>What it has learned <small>${w.lessons.length} lessons · ${w.stats.episodes} episodes</small></h3>${lessonList(w.lessons, 4)}<div class="hm-wrap"><h4>Clean rate by placement</h4>${heatmap(w.heat)}</div>`;
    }
    if (revs.changed(w, 'exam') || ctx.spotChanged) renderSpread(w, spot);
  }

  function renderNumbers(w: World): void {
    const last = w.evo[w.evo.length - 1]!;
    const kept = w.evo.filter((p) => p.accepted === true).length;
    const binned = w.evo.filter((p) => p.accepted === false).length;
    numbers.innerHTML = `<div class="big"><b data-k="champ">${pct(last.champion)}</b><div><span class="up">${signed(last.champion - w.evo[0]!.champion)} pts</span> since day one<br/><small>${kept} changes kept · ${binned} binned</small></div></div>${evoChart(w.evo, { w: 760, h: 330, labels: true, pad: 44 })}<div class="legend"><span class="l-kept">kept</span><span class="l-binned">binned</span><span class="l-line">the team in charge</span></div>`;
  }

  function renderFeature(w: World): void {
    const m = w.moment;
    let html = '';
    if (m.kind === 'critique') {
      html = `<div class="f-k" style="--rc:var(--critic)">The post-mortem</div><blockquote>“${esc(m.lesson)}”</blockquote><div class="wf"><div><b>Worked</b>${m.worked.map((x) => `<p>${esc(x)}</p>`).join('')}</div><div><b>Failed</b>${m.failed.map((x) => `<p>${esc(x)}</p>`).join('')}</div></div>`;
    } else if (m.kind === 'proposal') {
      html = `<div class="f-k" style="--rc:var(--coach)">The proposal</div>${proposalCard(m.proposal)}`;
    } else if (m.kind === 'evaluate' && w.evalRun) {
      html = `<div class="f-k" style="--rc:var(--gatekeeper)">The test · same drills, both teams</div><div class="f-title">${esc(w.evalRun.title)}</div>${evalBars(w.evalRun)}`;
    } else if (m.kind === 'verdict') {
      const v = m.verdict;
      html = `<div class="f-k" style="--rc:var(--gatekeeper)">The verdict</div><div class="f-title">${esc(v.title)}</div><div class="vd ${v.accepted ? 'kept' : 'binned'}"><b>${signed(v.delta)}</b><span>${v.accepted ? 'kept' : 'binned'}</span></div><p class="vd-sub">${pct(v.before)} → ${pct(v.after)} on the same ${v.perTask.length} drills</p>`;
    } else if (m.kind === 'memory') {
      const l = w.lessons[0]!;
      html = `<div class="f-k" style="--rc:var(--librarian)">Filed in memory</div><blockquote class="sm">“${esc(l.text)}”</blockquote><p class="vd-sub">${l.id} · confidence ${Math.round(l.confidence * 100)}% · ${l.support} episodes so far</p>`;
    } else {
      html = `<div class="f-k" style="--rc:var(--loader)">The Loader's notebook</div><div class="notes">${w.tools
        .slice(0, 6)
        .map((t) => (t.thought ? `<p class="th">${esc(t.thought)}</p>` : '') + toolRow(t))
        .join('')}</div>`;
    }
    feature.innerHTML = html;
    feature.classList.remove('in');
    void feature.offsetWidth;
    feature.classList.add('in');
  }

  function renderSpread(w: World, spot: Spot | null): void {
    const on = spot === 'exam' && !!w.exam;
    root.classList.toggle('exam-on', on);
    if (!on || !w.exam) return;
    const ex = w.exam;
    const done = ex.revealed > ex.tasks.length;
    spread.innerHTML = `<div class="sp-left"><div class="f-k" style="--rc:var(--good)">The final exam · ${ex.tasks.length} levels it never saw</div><div class="sp-big ${done ? 'on' : ''}">+${ex.after - ex.before}</div><div class="sp-unit">points on unseen levels</div><p>Day-one team: <b>${ex.before}%</b>. Today's team: <b class="g">${ex.after}%</b>. Same model, same game. Only the team's own notes changed.</p></div><div class="sp-right">${examBars(ex)}<div class="legend"><span class="l-base">day-one team</span><span class="l-kept">today's team</span></div></div>`;
  }

  return { id: '3', name: 'editorial', mount, update, destroy: () => revs.reset() };
}

void PHASES;
void tween;
