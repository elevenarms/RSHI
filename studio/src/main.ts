/** The studio page: folds the crew's events into state and draws it, panel by panel. */

import type { CrewEvent, Role } from '@spotless/crew/contracts';
import { diffGenomes, wordDiff } from './diff.ts';
import { championId, evolution, initialState, lineage, liveEpisodes, reduce, ROLE_LIST, type EpisodeView, type MessageView, type StudioState } from './state.ts';
import { startSource } from './source.ts';
import { tokenPanel } from './tokens.ts';
import { modelName } from './models.ts';
import { Inspector } from './inspector.ts';

const $ = <T extends Element = HTMLElement>(sel: string): T => document.querySelector(sel) as T;
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
const fmtN = (n: number): string => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
const SVG = 'http://www.w3.org/2000/svg';
const COLOR: Record<Role, string> = {
  planner: 'var(--planner)', loader: 'var(--loader)', critic: 'var(--critic)', coach: 'var(--coach)', gatekeeper: 'var(--gatekeeper)', librarian: 'var(--librarian)',
};
const HEX: Record<Role, string> = { planner: '#2f5bea', loader: '#0a8fb0', critic: '#d4386c', coach: '#7a3fd1', gatekeeper: '#111111', librarian: '#1f8a5a' };

let state: StudioState = initialState();
let dirty = true;
const pendingPackets: MessageView[] = [];
let lastExamSeq = 0;

const tokens = tokenPanel($('#waterfall'), $('#meter'), (key) => state.episodes[key]?.taskTitle);
const inspector = new Inspector($<HTMLIFrameElement>('#tt'), $('#objcard'), $('.turntable'));

const source = startSource(
  (e) => apply(e, true),
  (es) => {
    for (const e of es) apply(e, false);
    // A replay that starts mid-run: pour the most recent tokens so the waterfall is not empty.
    for (const e of es.filter((x) => x.type === 'stream').slice(-300)) if (e.type === 'stream') tokens.push(e);
  },
);

function apply(e: CrewEvent, animate: boolean): void {
  inspector.onEvent(e);
  // Token streams go straight to the waterfall (many small events; the state fold ignores them).
  if (e.type === 'stream') {
    if (animate) tokens.push(e);
    return;
  }
  state = reduce(state, e);
  dirty = true;
  if (animate && e.type === 'message') {
    const m = state.messages[state.messages.length - 1];
    if (m) pendingPackets.push(m);
  }
  if (e.type === 'exam' && state.exam) {
    if (animate) showExam(state);
    lastExamSeq = state.exam.seq;
  }
}

// ---------------------------------------------------------------------------------------------
// header + phases
// ---------------------------------------------------------------------------------------------

function renderHeader(s: StudioState): void {
  const run = s.run;
  $('#run').innerHTML = `<div><span class="dot ${source.connected() ? 'on' : ''}"></span><b>${esc(s.runId ?? 'waiting for a run…')}</b></div>
    <div>${run ? `${run.mode.toUpperCase()} · ${run.generations} gens · ${run.trainTasks.length} train / ${run.testTasks.length} held-out` : source.mode === 'replay' ? `replay ×${source.speed}` : 'live · /api/events'}</div>`;
  const byModel = new Map<string, Role[]>();
  for (const r of ROLE_LIST) {
    const m = run?.models[r];
    if (!m) continue;
    byModel.set(m, [...(byModel.get(m) ?? []), r]);
  }
  $('#inference').innerHTML = `<div class="crusoe">CRUSOE<small>MANAGED INFERENCE</small></div><div class="models">${[...byModel]
    .map(([m, rs]) => `<span>${rs.map((r) => `<i style="color:${COLOR[r]}">${r}</i>`).join('<i>·</i>')} <i>→</i> ${esc(modelName(m))}</span>`)
    .join('')}</div>`;
  $('#casefile').textContent = s.runId ? `CASE FILE · RUN ${s.runId.toUpperCase()}` : 'CASE FILE · awaiting run';
  const t = s.tokens;
  const champ = championId(s);
  $('#counters').innerHTML = [
    ['tokens in', fmtN(t.in)],
    ['out', fmtN(t.out)],
    ['cached', fmtN(t.cached)],
    ['tool calls', fmtN(t.toolCalls)],
    ['champion', champ ? champ.split('-')[0]! : '—'],
  ]
    .map(([k, v]) => `<div class="counter"><div class="v">${v}</div><div class="k">${k}</div></div>`)
    .join('');
}

const STEPS = ['practice', 'review', 'propose', 'evaluate'] as const;
function renderPhases(s: StudioState): void {
  const gens = Math.max(s.run?.generations ?? 2, s.phase?.generation ?? 0);
  const seen = new Set(s.phaseHistory.map((p) => `${p.phase}:${p.phase === 'baseline' || p.phase === 'exam' || p.phase === 'done' ? 0 : p.generation}`));
  const curKey = s.phase ? `${s.phase.phase}:${s.phase.phase === 'baseline' || s.phase.phase === 'exam' || s.phase.phase === 'done' ? 0 : s.phase.generation}` : '';
  const step = (phase: string, gen: number, label: string): string => {
    const k = `${phase}:${gen}`;
    const cls = k === curKey && phase !== 'done' ? 'cur' : seen.has(k) ? 'done' : '';
    return `<div class="step ${cls}">${label}</div>`;
  };
  let h = `<div class="pgroup">${step('baseline', 0, 'baseline')}</div>`;
  // Many generations: only the current one (or the next to come) is spelled out, the others are one chip each.
  const curGen = s.phase && STEPS.includes(s.phase.phase as (typeof STEPS)[number]) ? s.phase.generation : null;
  const open = gens <= 2 ? null : curGen ?? Math.min(gens, Math.max(1, ...s.phaseHistory.map((p) => p.generation)) + (s.phase?.phase === 'baseline' ? 0 : 1));
  for (let g = 1; g <= gens; g++) {
    if (open === null || g === open) h += `<div class="pgroup"><div class="gl">GEN ${g}</div>${STEPS.map((p) => step(p, g, p)).join('')}</div>`;
    else h += `<div class="pgroup"><div class="step ${seen.has(`evaluate:${g}`) ? 'done' : ''}">G${g}</div></div>`;
  }
  h += `<div class="pgroup">${step('exam', 0, 'exam')}${step('done', 0, 'done')}</div>`;
  h += `<div class="pdetail">${esc(s.phase?.detail ?? 'Waiting for the crew…')}</div>`;
  $('#phases').innerHTML = h;
}

// ---------------------------------------------------------------------------------------------
// team graph
// ---------------------------------------------------------------------------------------------

// Link-analysis layout (viewBox 360×300): the work flows down the left, across, and up the right.
const CX = 180;
const CY = 150;
const NW = 150;
const NH = 56;
const POS = new Map<Role, { x: number; y: number }>([
  ['librarian', { x: 85, y: 38 }],
  ['planner', { x: 85, y: 150 }],
  ['loader', { x: 85, y: 262 }],
  ['critic', { x: 275, y: 262 }],
  ['coach', { x: 275, y: 150 }],
  ['gatekeeper', { x: 275, y: 38 }],
]);
const RING: Role[] = ['librarian', 'planner', 'loader', 'critic', 'coach', 'gatekeeper'];
/** The typed links of the flow (always drawn); other pairs light up only while a message travels. */
const FLOW: [Role, Role, string][] = [
  ['librarian', 'planner', 'BRIEF'],
  ['planner', 'loader', 'PLAN'],
  ['loader', 'critic', 'EPISODE'],
  ['critic', 'coach', 'CRITIQUE'],
  ['coach', 'gatekeeper', 'PROPOSAL'],
  ['gatekeeper', 'planner', 'GENOME'],
  ['critic', 'librarian', 'LESSON'],
];
const graph = $<SVGSVGElement>('#graph');
const nodeEls = new Map<Role, SVGGElement>();
const edgeEls = new Map<string, SVGPathElement>();
const edgeKey = (a: Role, b: Role): string => [a, b].sort().join('-');
function curve(a: { x: number; y: number }, b: { x: number; y: number }): { c: { x: number; y: number }; d: string } {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const c = { x: mx + (CX - mx) * 0.25, y: my + (CY - my) * 0.25 };
  return { c, d: `M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}` };
}

function buildGraph(): void {
  graph.innerHTML = `<g id="edges"></g><g id="elabels"></g><g id="packets"></g><g id="nodes"></g>`;
  const eg = graph.querySelector('#edges')!;
  const lg = graph.querySelector('#elabels')!;
  const flowKeys = new Map(FLOW.map(([a, b, l]) => [edgeKey(a, b), l]));
  for (let i = 0; i < RING.length; i++)
    for (let j = i + 1; j < RING.length; j++) {
      const a = RING[i]!;
      const b = RING[j]!;
      const p = document.createElementNS(SVG, 'path');
      const k = edgeKey(a, b);
      p.setAttribute('class', `edge ${flowKeys.has(k) ? 'flow' : ''}`);
      const cv = curve(POS.get(a)!, POS.get(b)!);
      p.setAttribute('d', cv.d);
      eg.appendChild(p);
      edgeEls.set(k, p);
      const l = flowKeys.get(k);
      if (l) {
        const A = POS.get(a)!;
        const B = POS.get(b)!;
        const lx = 0.25 * A.x + 0.5 * cv.c.x + 0.25 * B.x;
        // A horizontal link would hide its label between the boxes: put it under them.
        const ly = A.y === B.y ? A.y + NH / 2 + 12 : 0.25 * A.y + 0.5 * cv.c.y + 0.25 * B.y;
        lg.insertAdjacentHTML('beforeend', `<g class="elabel" data-k="${k}" transform="translate(${lx},${ly})"><rect x="${-l.length * 3.3 - 4}" y="-7" width="${l.length * 6.6 + 8}" height="14"/><text y="3.5" text-anchor="middle">${l}</text></g>`);
      }
    }
  const ng = graph.querySelector('#nodes')!;
  for (const r of RING) {
    const { x, y } = POS.get(r)!;
    const g = document.createElementNS(SVG, 'g');
    g.setAttribute('class', 'node idle');
    g.style.setProperty('--rc', HEX[r]);
    g.innerHTML = `<rect class="node-box" x="${x - NW / 2}" y="${y - NH / 2}" width="${NW}" height="${NH}"/>
      <rect class="node-bar" x="${x - NW / 2}" y="${y - NH / 2}" width="5" height="${NH}" fill="${HEX[r]}"/>
      <text class="node-name" x="${x - NW / 2 + 12}" y="${y - 10}">${r.toUpperCase()}</text>
      <text class="node-status" x="${x + NW / 2 - 7}" y="${y - 10}" text-anchor="end">IDLE</text>
      <text class="node-model" x="${x - NW / 2 + 12}" y="${y + 6}"></text>
      <text class="node-label" x="${x - NW / 2 + 12}" y="${y + 20}"></text>`;
    ng.appendChild(g);
    nodeEls.set(r, g);
  }
}

function renderGraph(s: StudioState): void {
  for (const r of ROLE_LIST) {
    const a = s.agents[r];
    const g = nodeEls.get(r);
    if (!g) continue;
    g.setAttribute('class', `node ${a.status}`);
    const t = g.querySelectorAll('text');
    t[1]!.textContent = a.status.toUpperCase();
    const mn = modelName(s.run?.models[r]);
    t[2]!.textContent = mn.length > 19 ? `${mn.slice(0, 18)}…` : mn;
    t[3]!.textContent = a.label.length > 21 ? `${a.label.slice(0, 20)}…` : a.label;
  }
}

interface Packet { from: Role; to: Role; t0: number; dur: number; el: SVGGElement; path: { a: { x: number; y: number }; c: { x: number; y: number }; b: { x: number; y: number } } }
const packets: Packet[] = [];
function launchPackets(): void {
  const layer = graph.querySelector('#packets')!;
  while (pendingPackets.length) {
    const m = pendingPackets.shift()!;
    const targets: Role[] = m.to === 'all' ? RING.filter((r) => r !== m.from) : [m.to];
    for (const to of targets) {
      if (to === m.from) continue;
      const a = POS.get(m.from)!;
      const b = POS.get(to)!;
      const { c } = curve(a, b);
      const el = document.createElementNS(SVG, 'g');
      const col = HEX[m.from];
      el.innerHTML = `<circle r="8" fill="#fff" stroke="#000" stroke-width="2"/><circle r="4.5" fill="${col}"/>`;
      layer.appendChild(el);
      packets.push({ from: m.from, to, t0: performance.now(), dur: 1100, el, path: { a, c, b } });
      edgeEls.get(edgeKey(m.from, to))?.classList.add('hot');
      edgeEls.get(edgeKey(m.from, to))?.setAttribute('style', `stroke:${col}`);
      graph.querySelector(`.elabel[data-k="${edgeKey(m.from, to)}"]`)?.classList.add('hot');
    }
  }
}
function animatePackets(now: number): void {
  for (let i = packets.length - 1; i >= 0; i--) {
    const p = packets[i]!;
    const u = Math.min(1, (now - p.t0) / p.dur);
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    const { a, c, b } = p.path;
    const x = (1 - e) * (1 - e) * a.x + 2 * (1 - e) * e * c.x + e * e * b.x;
    const y = (1 - e) * (1 - e) * a.y + 2 * (1 - e) * e * c.y + e * e * b.y;
    p.el.setAttribute('transform', `translate(${x},${y}) scale(${1 + Math.sin(u * Math.PI) * 0.4})`);
    if (u >= 1) {
      p.el.remove();
      packets.splice(i, 1);
      if (!packets.some((q) => edgeKey(q.from, q.to) === edgeKey(p.from, p.to))) {
        const ed = edgeEls.get(edgeKey(p.from, p.to));
        ed?.classList.remove('hot');
        ed?.removeAttribute('style');
        graph.querySelector(`.elabel[data-k="${edgeKey(p.from, p.to)}"]`)?.classList.remove('hot');
      }
      const node = nodeEls.get(p.to)?.querySelector('.node-box');
      node?.animate([{ strokeWidth: 5 }, { strokeWidth: 1.5 }], { duration: 500 });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// chatter
// ---------------------------------------------------------------------------------------------

let lastMsgId = '';
function renderFeed(s: StudioState): void {
  const last = s.messages[s.messages.length - 1];
  // Who is busy right now (so the panel is never empty, e.g. during baseline practice).
  const busy = ROLE_LIST.filter((r) => s.agents[r].status === 'thinking' || s.agents[r].status === 'acting');
  const sig = `${last?.id}|${busy.map((r) => `${r}:${s.agents[r].status}:${s.agents[r].label}`).join()}`;
  if (sig === lastMsgId) return;
  lastMsgId = sig;
  const list = s.messages.slice(-14).reverse();
  const st = busy.map((r) => `<div class="agst" style="--c:${COLOR[r]}"><b>${r}</b><span>${s.agents[r].status}</span><i>${esc(s.agents[r].label)}</i></div>`).join('');
  $('#feed').innerHTML = st + list
    .map((m) => {
      const v = m.kind === 'verdict' ? (/^REJECT/.test(m.title) ? 'verdict-no' : /^ACCEPT|^Exam/.test(m.title) ? 'verdict-ok' : '') : '';
      return `<div class="msg ${v}" style="--c:${COLOR[m.from]}"><div class="h"><span class="ts">${m.at.slice(11, 19)}</span><span class="kind">${m.kind}</span><b>${m.from}</b><i>→</i>${m.to}</div>
        <details><summary>${esc(m.title)}</summary><pre>${esc(m.body)}</pre></details></div>`;
    })
    .join('');
}

// ---------------------------------------------------------------------------------------------
// live 3D panel
// ---------------------------------------------------------------------------------------------

const stage = $('#stage');
const cards = new Map<string, { el: HTMLDivElement; frame: HTMLIFrameElement; ov: HTMLDivElement; sig: string }>();
let focusKey: string | null = null;
let userFocus: string | null = null;
const LINGER_MS = 9000;

function renderLive(s: StudioState): void {
  const live = liveEpisodes(s, source.now(), LINGER_MS * Math.max(1, source.speed));
  const keys = new Set(live.map((e) => e.key));
  for (const [k, c] of cards) if (!keys.has(k)) { c.el.remove(); cards.delete(k); }
  if (userFocus && !keys.has(userFocus)) userFocus = null;
  // The newest running episode is big unless the viewer picked one.
  focusKey = userFocus ?? live.find((e) => !e.finishedAt)?.key ?? live[0]?.key ?? null;
  const W = stage.clientWidth;
  const H = stage.clientHeight;
  const others = live.filter((e) => e.key !== focusKey);
  // The other episodes stack in a column on the right, so the hero view keeps a less extreme aspect.
  const gap = 6;
  const thumbW = others.length ? Math.round(Math.min(W * 0.24, 260)) : 0;
  const bigW = W - (thumbW ? thumbW + gap : 0);
  const bigH = H;
  const thumbH = others.length ? Math.min((H - gap * (others.length - 1)) / others.length, thumbW * 0.75) : 0;
  for (const e of live) {
    let c = cards.get(e.key);
    if (!c) {
      const el = document.createElement('div');
      el.className = 'card';
      const frame = document.createElement('iframe');
      // `&nohud`: the game page hides its own heading (the card's strip shows the title).
      frame.src = /[#&]nohud\b/.test(e.watchUrl) ? e.watchUrl : `${e.watchUrl}&nohud`;
      frame.setAttribute('allow', 'autoplay');
      const ov = document.createElement('div');
      ov.className = 'ov';
      el.classList.add('loading');
      frame.addEventListener('load', () => setTimeout(() => el.classList.remove('loading'), 2500));
      el.append(frame, ov);
      el.onclick = () => { userFocus = e.key; dirty = true; };
      stage.appendChild(el);
      c = { el, frame, ov, sig: '' };
      cards.set(e.key, c);
    }
    const big = e.key === focusKey;
    const idx = others.indexOf(e);
    const rect = big ? { x: 0, y: 0, w: bigW, h: bigH } : { x: bigW + gap, y: idx * (thumbH + gap), w: thumbW, h: thumbH };
    Object.assign(c.el.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
    const loading = c.el.classList.contains('loading');
    c.el.className = `card ${big ? 'big' : 'small'} ${!big && e.finishedAt ? 'leaving' : ''} ${loading ? 'loading' : ''}`;
    // The page renders at the big size (below the card's header strip); thumbnails are scaled down copies.
    const scale = big ? 1 : Math.min(rect.w / bigW, rect.h / bigH);
    const HDR = innerHeight <= 900 ? 34 : 40;
    // The page's own heading is hidden with `&nohud`, so nothing needs cropping any more.
    const CROP = 0;
    Object.assign(c.frame.style, { width: `${bigW}px`, height: `${bigH - HDR + CROP}px`, top: big ? `${HDR - CROP}px` : `${-CROP * scale}px`, transform: `scale(${scale})` });
    const sig = `${big}|${e.stream.length}|${e.finishedAt}|${e.wash}`;
    if (sig !== c.sig) {
      c.sig = sig;
      c.ov.innerHTML = overlay(e);
    }
  }
  let idle = stage.querySelector('.idle, .exam-mini');
  if (idle && s.exam && idle.classList.contains('idle')) { idle.remove(); idle = null; }
  if (live.length === 0) {
    if (!idle) {
      stage.insertAdjacentHTML('beforeend', s.exam ? examMini(s) : `<div class="idle"><div class="ring"></div>awaiting the next episode</div>`);
      stage.querySelector('.exam-mini')?.addEventListener('click', () => showExam(state));
    }
  } else idle?.remove();
}

function overlay(e: EpisodeView): string {
  const tools = e.stream.filter((x) => x.type === 'tool').slice(-4);
  const sum = e.summary;
  const sc = sum ? (sum.share >= 0.75 ? 'var(--good)' : sum.share >= 0.55 ? 'var(--ink)' : 'var(--bad)') : '';
  return `<div class="ov-top"><span class="badge b-${e.purpose}">${e.purpose}</span><span class="task">${esc(e.taskTitle)}</span>
      <span class="ov-meta">genome <b>${esc(e.genomeId)}</b> · ${e.itemCount} items · ${e.pointsAvailable} pts</span></div>
    <div class="ticker">${tools
      .map((t) => (t.type === 'tool' ? `<div class="tick ${t.ok ? '' : 'bad'}"><b>${esc(t.name)}</b> ${esc(t.summary)}</div>` : ''))
      .join('')}</div>
    ${e.wash === 'started' && !sum ? '<div class="washing">◌ WASHING</div>' : ''}
    ${sum ? `<div class="stamp" style="--sc:${sc}"><div class="p">${sum.points}<small>/${sum.pointsAvailable}</small></div><div class="c">${sum.itemsClean}/${sum.itemsOffered} clean · ${pct(sum.share)}</div></div>` : ''}`;
}

// ---------------------------------------------------------------------------------------------
// thought stream
// ---------------------------------------------------------------------------------------------

let streamSig = '';
function renderStream(s: StudioState): void {
  const e = focusKey ? s.episodes[focusKey] : s.episodes[s.episodeOrder[s.episodeOrder.length - 1] ?? ''];
  const sig = `${e?.key}|${e?.stream.length}`;
  if (sig === streamSig) return;
  streamSig = sig;
  $('#thought-ep').textContent = e ? `${e.key} · ${fmtN(e.tokensIn)} in / ${fmtN(e.tokensOut)} out` : '';
  if (!e) return;
  $('#stream').innerHTML = e.stream
    .slice(-22)
    .map((x) => {
      if (x.type === 'turn')
        return `<div class="si turn" style="--c:${COLOR[x.role]}"><div class="who">${x.role}</div><div class="txt">${esc(x.text || '…')}<span class="meta">${x.tokensIn}→${x.tokensOut} tok · ${x.ms}ms</span></div></div>`;
      if (x.type === 'tool')
        return `<div class="si tool ${x.ok ? '' : 'bad'}" style="--c:var(--dim)"><div class="who">#${x.seq}</div><div class="txt"><b>${esc(x.name)}</b>(${esc(short(x.args))}) → ${esc(x.summary)}</div></div>`;
      return `<div class="si wash" style="--c:var(--loader)"><div class="who">wash</div><div class="txt">${esc(x.status.toUpperCase())} · ${esc(x.detail)}</div></div>`;
    })
    .join('');
}
const short = (a: unknown): string => {
  if (a === undefined || a === null) return '';
  const t = JSON.stringify(a);
  return (t === '{}' ? '' : t.replace(/^\{|\}$/g, '').replace(/"/g, '')).slice(0, 70);
};

// ---------------------------------------------------------------------------------------------
// evolution chart + lineage
// ---------------------------------------------------------------------------------------------

let evoSig = '';
function renderEvolution(s: StudioState): void {
  const pts = evolution(s);
  const cb = $('#chart').getBoundingClientRect();
  const sig = `${Math.round(cb.width)}x${Math.round(cb.height)}` + JSON.stringify(pts) + Object.keys(s.genomes).length + Object.values(s.genomes).map((g) => g.status).join();
  if (sig === evoSig) return;
  evoSig = sig;
  // Drawn at the element's own pixel size, so the type stays readable however small the panel is.
  const box = $('#chart').getBoundingClientRect();
  const W = Math.max(320, Math.round(box.width)), H = Math.max(140, Math.round(box.height)), L = 44, Rr = 16, T = 22, B = 30;
  $('#chart').setAttribute('viewBox', `0 0 ${W} ${H}`);
  const vals = pts.flatMap((p) => [p.champion, p.candidate ?? p.champion]);
  const lo = Math.max(0, Math.floor((Math.min(...vals, 0.5) - 0.1) * 10) / 10);
  const hi = Math.min(1, Math.ceil((Math.max(...vals, 0.6) + 0.08) * 10) / 10);
  const n = Math.max(pts.length, (s.run?.generations ?? 2) + 1);
  const X = (i: number): number => L + ((W - L - Rr) * (i + 0.5)) / n;
  const Y = (v: number): number => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
  let h = `<defs><linearGradient id="champGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(0,0,0,.10)"/><stop offset="1" stop-color="rgba(0,0,0,0)"/></linearGradient></defs>`;
  for (let v = lo; v <= hi + 1e-9; v += 0.1) h += `<line class="axis" x1="${L}" x2="${W - Rr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis-t" x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${Math.round(v * 100)}%</text>`;
  for (let i = 0; i < n; i++) h += `<text class="axis-t" x="${X(i)}" y="${H - 12}" text-anchor="middle">${i === 0 ? 'BASE' : `G${pts[i]?.generation ?? i}`}</text>`;
  if (pts.length) {
    let d = `M${X(0)},${Y(pts[0]!.champion)}`;
    for (let i = 1; i < pts.length; i++) d += ` H${X(i)} V${Y(pts[i]!.champion)}`;
    const last = pts[pts.length - 1]!;
    d += ` H${X(pts.length - 1) + 30}`;
    h += `<path class="champ-area" d="${d} V${H - B} H${X(0)} Z"/><path class="champ-line" d="${d}"/>`;
    h += `<circle cx="${X(0)}" cy="${Y(pts[0]!.champion)}" r="6" fill="var(--ink)"/>
      <text class="delta-t" x="${X(0)}" y="${Y(pts[0]!.champion) + 24}" text-anchor="middle" fill="var(--dim)">${pct(pts[0]!.champion)}</text>`;
    for (const p of pts.slice(1)) {
      const col = p.accepted ? 'var(--good)' : 'var(--bad)';
      const x = X(p.index);
      const y = Y(p.candidate ?? 0);
      const up = (p.candidate ?? 0) >= p.champion - 0.001;
      h += `<g><title>${esc(p.title)}\n${esc(p.reason)}</title>
        <line x1="${x}" x2="${x}" y1="${Y(pts[p.index - 1]!.champion)}" y2="${y}" stroke="${col}" stroke-dasharray="3 3" opacity=".6"/>
        <circle class="cand" cx="${x}" cy="${y}" r="11" fill="#fff" stroke="${col}"/>
        <text x="${x}" y="${y + 4.5}" text-anchor="middle" font-size="13" font-weight="800" fill="${col}">${p.accepted ? '✓' : '✕'}</text>
        <text class="delta-t" x="${x}" y="${up ? y - 18 : y + 28}" text-anchor="middle" fill="${col}">${p.delta >= 0 ? '+' : '−'}${Math.abs(p.delta * 100).toFixed(1)}</text>
        <text class="cand-t" x="${Math.min(x, W - 140)}" y="${up ? y - 36 : y + 46}" text-anchor="middle">${esc(p.title.length > 30 ? `${p.title.slice(0, 29)}…` : p.title)}</text></g>`;
    }
    h += `<text class="delta-t" x="${W - Rr}" y="${Y(last.champion) - 10}" text-anchor="end" fill="var(--ink)">${pct(last.champion)}</text>`;
  } else h += `<text class="axis-t" x="${W / 2}" y="${H / 2}" text-anchor="middle">waiting for the baseline score…</text>`;
  $('#chart').innerHTML = h;
  // The payoff in big type: where the team started, where it is now.
  const base = pts[0];
  const now = pts[pts.length - 1];
  const kept = pts.filter((p) => p.accepted === true).length;
  const binned = pts.filter((p) => p.accepted === false).length;
  $('#evohead').innerHTML = base && now
    ? `<div class="kv"><span class="pk">BASELINE</span><b>${pct(base.champion)}</b></div><div class="arrow">→</div><div class="kv"><span class="pk">CHAMPION</span><b>${pct(now.champion)}</b></div><div class="kv delta ${now.champion >= base.champion ? 'up' : 'down'}"><span class="pk">DELTA</span><b>${now.champion >= base.champion ? '+' : '−'}${Math.abs((now.champion - base.champion) * 100).toFixed(1)}</b></div><div class="kv small"><span class="pk">CHANGES</span><b><span class="g">${kept} kept</span> · <span class="r">${binned} binned</span></b></div>`
    : `<div class="kv"><span class="pk">BASELINE</span><b class="pend">measuring…</b></div>`;
  renderLineage(s);
}

function renderLineage(s: StudioState): void {
  const nodes = lineage(s);
  const box = $('#lineage');
  if (!nodes.length) { box.innerHTML = ''; return; }
  const W = 520, NW = 132, NH = 30;
  const maxD = Math.max(...nodes.map((n) => n.depth));
  const rows = Math.max(...nodes.map((n) => n.row)) + 1;
  const colW = maxD > 0 ? (W - NW - 10) / maxD : 0;
  const rowH = Math.min(44, (130 - NH) / Math.max(1, rows - 1));
  const P = new Map(nodes.map((n) => [n.id, { x: 4 + n.depth * colW, y: 10 + n.row * rowH }]));
  const col = (st: string): string => (st === 'champion' ? 'var(--ink)' : st === 'accepted' ? 'var(--good)' : st === 'rejected' ? 'var(--bad)' : st === 'candidate' ? 'var(--warn)' : 'var(--ink)');
  let h = '';
  for (const n of nodes) {
    const p = P.get(n.id)!;
    const q = n.parentId ? P.get(n.parentId) : undefined;
    if (q) h += `<path d="M${q.x + NW},${q.y + NH / 2} C${q.x + NW + 30},${q.y + NH / 2} ${p.x - 30},${p.y + NH / 2} ${p.x},${p.y + NH / 2}" stroke="${col(n.status)}" stroke-width="2" fill="none" opacity=".6"/>`;
  }
  for (const n of nodes) {
    const p = P.get(n.id)!;
    h += `<g class="gnode" data-id="${esc(n.id)}"><rect class="${n.status}" x="${p.x}" y="${p.y}" width="${NW}" height="${NH}" rx="2" stroke="${col(n.status)}"/>
      <text x="${p.x + 10}" y="${p.y + 19}">${n.status === 'champion' ? '★ ' : n.status === 'rejected' ? '✕ ' : ''}${esc(n.id.length > 15 ? n.id.slice(0, 15) : n.id)}</text></g>`;
  }
  box.innerHTML = `<div class="lin-hint">LINEAGE · click a genome for its diff</div><svg viewBox="0 0 ${W} 138"><defs><filter id="glowL"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${h}</svg>`;
  box.querySelectorAll<SVGGElement>('.gnode').forEach((g) => g.addEventListener('click', () => showDiff(g.dataset['id'] ?? '')));
}

function showDiff(id: string): void {
  const g = state.genomes[id];
  const el = $('#diff');
  if (!g) return;
  const parent = g.genome.parentId ? state.genomes[g.genome.parentId]?.genome ?? null : null;
  const entries = diffGenomes(parent, g.genome);
  const wd = (a: string, b: string): string => wordDiff(a, b).map((o) => (o.op === 'same' ? esc(o.text) : o.op === 'add' ? `<ins>${esc(o.text)}</ins>` : `<del>${esc(o.text)}</del>`)).join('');
  const rows = entries.map((e) => {
    switch (e.kind) {
      case 'rule_added': return `<div class="dl add">+ rule ${esc(e.rule.id)}: ${esc(e.rule.text)}</div>`;
      case 'rule_removed': return `<div class="dl del">− rule ${esc(e.rule.id)}: ${esc(e.rule.text)}</div>`;
      case 'rule_edited': return `<div class="dl mod">~ rule ${esc(e.id)}: ${wd(e.before, e.after)}</div>`;
      case 'prompt': return `<div class="dl mod">~ prompt ${esc(e.prompt)}: ${wd(e.before, e.after)}</div>`;
      default: return `<div class="dl mod">~ ${e.kind}.${esc(e.key)}: ${esc(JSON.stringify(e.before))} → <b>${esc(JSON.stringify(e.after))}</b></div>`;
    }
  });
  el.innerHTML = `<span class="x">ESC ✕</span><h3>${esc(id)} <span class="badge b-${g.status === 'champion' ? 'exam-champion' : g.status === 'rejected' ? 'smoke' : 'eval'}">${g.status}</span></h3>
    <div class="why">gen ${g.genome.generation} · parent ${esc(g.genome.parentId ?? '—')}<br>${esc(g.genome.rationale)}</div>
    ${rows.join('') || (parent ? '<div class="dl">no changes</div>' : g.genome.playbook.map((r) => `<div class="dl">${esc(r.id)}: ${esc(r.text)}</div>`).join(''))}`;
  el.classList.remove('hidden');
  el.querySelector('.x')?.addEventListener('click', () => el.classList.add('hidden'));
}

// ---------------------------------------------------------------------------------------------
// memory
// ---------------------------------------------------------------------------------------------

let memAt = '';
function renderMemory(s: StudioState): void {
  const m = s.memory;
  if (!m || m.at === memAt) return;
  if (memAt && document.visibilityState === 'visible') setTab('mem', true);
  memAt = m.at;
  $('#memtag').textContent = `${m.stats.lessons} lessons`;
  const counts = Object.entries(m.stats).map(([k, v]) => `<div><b>${v}</b><span>${k.replace(/([A-Z])/g, " $1")}</span></div>`).join('');
  const lessons = m.topLessons
    .slice(0, 6)
    .map((l) => `<div class="lesson"><div><span class="lid">${esc(l.id)}</span><span class="lsrc">${l.source}</span>${esc(l.text)}</div><div><div class="bar"><i style="width:${Math.round(l.confidence * 100)}%"></i></div><div class="ev">${l.confidence.toFixed(2)} · +${l.support}/−${l.contradict}</div></div></div>`)
    .join('');
  // Heatmap: kinds (most observed) × rack·stance.
  const ps = m.placementStats;
  const kindN = new Map<string, number>();
  const colN = new Map<string, number>();
  for (const p of ps) {
    kindN.set(p.kind, (kindN.get(p.kind) ?? 0) + p.n);
    const c = `${p.rack.replace('_rack', '').replace('cutlery_basket', 'basket')}·${p.stance.replace('mouth_', 'm.').replace('tilted_', '∠')}`;
    colN.set(c, (colN.get(c) ?? 0) + p.n);
  }
  const kinds = [...kindN].sort((a, b) => b[1] - a[1]).slice(0, 7).map((x) => x[0]);
  const cols = [...colN].sort((a, b) => b[1] - a[1]).slice(0, 7).map((x) => x[0]);
  const cell = (k: string, c: string): string => {
    const hit = ps.filter((p) => p.kind === k && `${p.rack.replace('_rack', '').replace('cutlery_basket', 'basket')}·${p.stance.replace('mouth_', 'm.').replace('tilted_', '∠')}` === c);
    const n = hit.reduce((a, p) => a + p.n, 0);
    if (!n) return '<td class="none"></td>';
    const rate = hit.reduce((a, p) => a + p.clean, 0) / n;
    return `<td style="background:${rate >= 0.67 ? 'var(--good)' : rate > 0.33 ? 'var(--warn)' : 'var(--bad)'}" title="${k} ${c}: ${Math.round(rate * 100)}% of ${n}">${Math.round(rate * 100)}</td>`;
  };
  const heat = kinds.length
    ? `<div class="heat"><table><thead><tr><th></th>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${kinds
        .map((k) => `<tr><th>${esc(k.replace(/_/g, ' '))}</th>${cols.map((c) => cell(k, c)).join('')}</tr>`)
        .join('')}</tbody></table></div>`
    : '';
  $('#mem').innerHTML = `<div class="mcount">${counts}</div><div class="lessons">${lessons || '<div class="lesson" style="color:var(--dim)">no lessons yet</div>'}</div>${heat}`;
}

// ---------------------------------------------------------------------------------------------
// console + exam
// ---------------------------------------------------------------------------------------------

let logSig = -1;
function renderConsole(s: StudioState): void {
  const l = s.logs[s.logs.length - 1];
  if (!l || l.id === logSig) return;
  logSig = l.id;
  $('#console').innerHTML = s.logs
    .slice(-4)
    .reverse()
    .map((x) => `<span class="${x.level}"><span class="lv">${x.at.slice(11, 19)}</span>${esc(x.text)}</span>`)
    .join('');
}

function examTitle(s: StudioState, taskId: string): string {
  return s.run?.testTasks.find((t) => t.id === taskId)?.title ?? taskId;
}
function examMini(s: StudioState): string {
  const x = s.exam!;
  const d = (x.champion.share - x.baseline.share) * 100;
  return `<div class="exam-mini"><div class="k">exam · held-out levels</div><div class="big">${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} pts</div>
    <div style="font-size:22px">${pct(x.baseline.share)} baseline → <b style="color:var(--good)">${pct(x.champion.share)}</b> ${esc(x.champion.genomeId)}</div></div>`;
}

let examTimer = 0;
function showExam(s: StudioState): void {
  const x = s.exam;
  if (!x) return;
  const el = $('#exam');
  const d = (x.champion.share - x.baseline.share) * 100;
  el.innerHTML = `<canvas></canvas><div class="inner"><div class="kicker">The exam · ${x.champion.perTask.length} levels the team has never seen</div>
    <div class="big ${d < 0 ? 'neg' : ''}"><span id="exam-num">+0.0</span> pts</div>
    <div class="line">baseline <b>${esc(x.baseline.genomeId)}</b> ${pct(x.baseline.share)} &nbsp;→&nbsp; champion <b style="color:var(--good)">${esc(x.champion.genomeId)}</b> ${pct(x.champion.share)}</div>
    <div class="bars" style="--n:${x.champion.perTask.length}">${x.champion.perTask
      .map((c) => {
        const b = x.baseline.perTask.find((p) => p.taskId === c.taskId);
        return `<div class="task"><div class="tn">${esc(examTitle(s, c.taskId))}</div>
          <div class="brow b"><span>baseline</span><div class="track"><div class="fill" data-w="${(b?.share ?? 0) * 100}"></div></div><span>${b ? `${b.points}/${b.pointsAvailable}` : '—'}</span></div>
          <div class="brow c"><span>champion</span><div class="track"><div class="fill" data-w="${c.share * 100}"></div></div><span>${c.points}/${c.pointsAvailable}</span></div></div>`;
      })
      .join('')}</div><div class="hint">CLICK OR ESC TO RETURN</div></div>`;
  el.classList.remove('hidden');
  requestAnimationFrame(() => el.querySelectorAll<HTMLElement>('.fill').forEach((f) => (f.style.width = `${f.dataset['w']}%`)));
  const t0 = performance.now();
  const num = el.querySelector('#exam-num')!;
  const count = (): void => {
    const u = Math.min(1, (performance.now() - t0) / 1800);
    const v = d * (1 - Math.pow(1 - u, 3));
    num.textContent = `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`;
    if (u < 1) requestAnimationFrame(count);
  };
  count();
  if (d > 0) sparks(el.querySelector('canvas')!);
  el.onclick = () => el.classList.add('hidden');
  clearTimeout(examTimer);
  examTimer = window.setTimeout(() => el.classList.add('hidden'), 16000);
}

function sparks(cv: HTMLCanvasElement): void {
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  cv.width = innerWidth;
  cv.height = innerHeight;
  const cols = ['#0f9d58', '#111111', '#0f9d58', '#d93025'];
  const ps = Array.from({ length: 220 }, () => {
    const a = Math.random() * Math.PI * 2;
    const v = 3 + Math.random() * 9;
    return { x: cv.width / 2, y: cv.height * 0.38, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: 1, c: cols[Math.floor(Math.random() * cols.length)]! };
  });
  const step = (): void => {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.globalCompositeOperation = 'source-over';
    let alive = 0;
    for (const p of ps) {
      if (p.life <= 0) continue;
      alive++;
      p.x += p.vx; p.y += p.vy; p.vy += 0.09; p.vx *= 0.985; p.life -= 0.009;
      ctx.strokeStyle = p.c;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (alive) requestAnimationFrame(step);
  };
  step();
}

addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { $('#exam').classList.add('hidden'); $('#diff').classList.add('hidden'); }
  if (e.key === 'e' && state.exam) showExam(state);
});
addEventListener('resize', () => (dirty = true));

// ---------------------------------------------------------------------------------------------

// Timeline tabs: the event log and the lessons share the left column. A memory update shows the lessons for a while.
let tabTimer = 0;
function setTab(t: string, auto = false): void {
  $('#chatter').dataset['tab'] = t;
  clearTimeout(tabTimer);
  if (auto) tabTimer = window.setTimeout(() => ($('#chatter').dataset['tab'] = 'log'), 9000);
}
document.querySelectorAll<HTMLButtonElement>('#chatter .tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset['t'] ?? 'log')));

buildGraph();
let lastSlow = 0;
function frame(now: number): void {
  launchPackets();
  animatePackets(now);
  inspector.render(focusKey);
  // Lingering episodes depend on the clock, so the live panel is refreshed twice a second anyway.
  if (dirty || now - lastSlow > 500) {
    dirty = false;
    lastSlow = now;
    renderHeader(state);
    renderPhases(state);
    renderGraph(state);
    renderFeed(state);
    renderLive(state);
    renderEvolution(state);
    renderMemory(state);
    renderConsole(state);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
void lastExamSeq;
void renderStream;
