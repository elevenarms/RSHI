/**
 * Shared pieces the variants draw with: small HTML/SVG builders (styled by each variant's CSS
 * through class names and CSS variables), a number tween and a FLIP helper for the spotlight.
 */

import type { EvoPoint, Heat, Lesson, Msg, Proposal, Role, Tool, Verdict, World } from './mock';
import { ROLE_INFO } from './mock';

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export const pct = (x: number, d = 1): string => `${x.toFixed(d)}%`;
export const signed = (x: number, d = 1): string => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}`;
export const kfmt = (n: number): string => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));

export function roleTag(r: Role | 'all', extra = ''): string {
  if (r === 'all') return `<span class="role-tag all ${extra}">everyone</span>`;
  return `<span class="role-tag ${extra}" style="--rc:var(--${r})">${ROLE_INFO[r].name}</span>`;
}

/** Remembers which revision of each part a view has drawn. */
export class Revs {
  private seen: Record<string, number> = {};
  changed(w: World, part: keyof World['rev']): boolean {
    if (this.seen[part] === w.rev[part]) return false;
    this.seen[part] = w.rev[part];
    return true;
  }
  reset(): void {
    this.seen = {};
  }
}

// ---------------------------------------------------------------------------------------------
// Number tween
// ---------------------------------------------------------------------------------------------

const tweens = new WeakMap<Element, { value: number; raf: number }>();

/** Animates the text of `el` from its last value to `to`. */
export function tween(el: Element | null, to: number, fmt: (x: number) => string, ms = 900): void {
  if (!el) return;
  const st = tweens.get(el) ?? { value: to, raf: 0 };
  cancelAnimationFrame(st.raf);
  const from = st.value;
  const t0 = performance.now();
  const step = (now: number): void => {
    const k = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    st.value = from + (to - from) * e;
    el.textContent = fmt(st.value);
    if (k < 1) st.raf = requestAnimationFrame(step);
    else st.value = to;
  };
  tweens.set(el, st);
  st.raf = requestAnimationFrame(step);
}

// ---------------------------------------------------------------------------------------------
// FLIP: animate elements from their old box to their new one after a layout change.
// ---------------------------------------------------------------------------------------------

export function flip(els: readonly HTMLElement[], mutate: () => void, ms = 700): void {
  const before = new Map(els.map((e) => [e, e.getBoundingClientRect()]));
  mutate();
  for (const e of els) {
    const a = before.get(e)!;
    const b = e.getBoundingClientRect();
    if (!b.width || !b.height) continue;
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    const sx = a.width / b.width;
    const sy = a.height / b.height;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) continue;
    e.animate(
      [{ transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transformOrigin: '0 0', transform: 'none' }],
      { duration: ms, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------------------------

/** The evolution chart: the champion as a step line, candidates as dots (kept: filled; binned: ×). */
export function evoChart(pts: readonly EvoPoint[], o: { w: number; h: number; pad?: number; labels?: boolean; min?: number; max?: number }): string {
  const pad = o.pad ?? 40;
  const min = o.min ?? 40;
  const max = o.max ?? 75;
  const n = Math.max(pts.length, 8);
  const x = (i: number): number => pad + (i * (o.w - pad * 2)) / (n - 1);
  const y = (v: number): number => o.h - pad - ((v - min) / (max - min)) * (o.h - pad * 2);
  const grid: string[] = [];
  for (let v = min; v <= max; v += 5) {
    grid.push(`<line class="grid" x1="${pad}" x2="${o.w - pad}" y1="${y(v)}" y2="${y(v)}"/>`);
    grid.push(`<text class="axis" x="${pad - 10}" y="${y(v) + 5}" text-anchor="end">${v}</text>`);
  }
  let d = '';
  pts.forEach((p, i) => {
    d += i === 0 ? `M${x(i)},${y(p.champion)}` : `H${x(i)}V${y(p.champion)}`;
  });
  const area = `${d}V${o.h - pad}H${x(0)}Z`;
  const dots = pts
    .map((p, i) => {
      if (p.candidate === null) return `<circle class="dot base" cx="${x(i)}" cy="${y(p.champion)}" r="8"/>`;
      const cx = x(i);
      const cy = y(p.candidate);
      const link = `<line class="link ${p.accepted ? 'kept' : 'binned'}" x1="${cx}" x2="${cx}" y1="${y(pts[i - 1]?.champion ?? p.champion)}" y2="${cy}"/>`;
      const mark = p.accepted
        ? `<circle class="dot kept" cx="${cx}" cy="${cy}" r="10"/>`
        : `<g class="dot binned"><circle cx="${cx}" cy="${cy}" r="10"/><path d="M${cx - 5},${cy - 5}L${cx + 5},${cy + 5}M${cx + 5},${cy - 5}L${cx - 5},${cy + 5}"/></g>`;
      const label = o.labels
        ? `<text class="dlabel ${p.accepted ? 'kept' : 'binned'}" x="${cx}" y="${cy + (p.accepted ? -22 : 34)}" text-anchor="middle">${signed(p.delta)}</text>`
        : '';
      return link + mark + label;
    })
    .join('');
  const last = pts[pts.length - 1];
  const head = last ? `<circle class="head" cx="${x(pts.length - 1)}" cy="${y(last.champion)}" r="14"/>` : '';
  return `<svg class="evo" viewBox="0 0 ${o.w} ${o.h}" preserveAspectRatio="xMidYMid meet">${grid.join('')}<path class="area" d="${area}"/><path class="champ" d="${d}"/>${dots}${head}</svg>`;
}

export function heatmap(hm: Heat, o: { compact?: boolean } = {}): string {
  const head = `<div class="hm-c hm-corner"></div>` + hm.cols.map((c) => `<div class="hm-c hm-col">${esc(c)}</div>`).join('');
  const rows = hm.rows
    .map((r, i) => {
      const cells = hm.cells[i]!.map((v, j) => {
        if (v === null) return `<div class="hm-c hm-cell empty"></div>`;
        return `<div class="hm-c hm-cell" style="--v:${v}" title="${esc(r)} · ${esc(hm.cols[j]!)} · n=${hm.n[i]![j]}">${o.compact ? '' : Math.round(v * 100)}</div>`;
      }).join('');
      return `<div class="hm-c hm-row">${esc(r)}</div>${cells}`;
    })
    .join('');
  return `<div class="heatmap" style="--cols:${hm.cols.length}">${head}${rows}</div>`;
}

export function lessonList(ls: readonly Lesson[], max: number): string {
  return `<ol class="lessons">${ls
    .slice(0, max)
    .map(
      (l) =>
        `<li class="lesson ${l.fresh ? 'fresh' : ''}" style="--c:${l.confidence}"><span class="lid">${l.id}</span><span class="ltext">${esc(l.text)}</span><span class="lconf"><i></i><b>${Math.round(l.confidence * 100)}</b></span></li>`,
    )
    .join('')}</ol>`;
}

export function toolRow(t: Tool): string {
  return `<div class="tool ${t.ok ? 'ok' : 'bad'}"><span class="tseq">#${t.seq}</span><span class="tname">${esc(t.name)}</span><span class="targs">${esc(t.args)}</span><span class="tsum">${esc(t.summary)}</span></div>`;
}

export function msgRow(m: Msg): string {
  return `<div class="msg k-${m.kind}" style="--rc:var(--${m.from})"><div class="mhead">${roleTag(m.from)}<span class="arrow">→</span>${roleTag(m.to)}<span class="mkind">${m.kind}</span></div><div class="mtitle">${esc(m.title)}</div><div class="mbody">${esc(m.body)}</div></div>`;
}

export function proposalCard(p: Proposal): string {
  return `<div class="proposal"><div class="p-kicker">Coach proposes</div><div class="p-title">${esc(p.title)}</div><div class="p-hyp">${esc(p.hypothesis)}</div><div class="p-edits">${p.edits
    .map((e) => `<div class="p-edit"><span class="p-op">${esc(e.op)}</span><code>${esc(e.text)}</code></div>`)
    .join('')}</div></div>`;
}

export function evalBars(ev: NonNullable<World['evalRun']>, max = 80): string {
  return `<div class="evalbars">${ev.drills
    .map(
      (d) =>
        `<div class="eb ${d.done ? 'done' : ''}"><div class="eb-task">${esc(d.task)}</div><div class="eb-pair"><div class="eb-bar old" style="--w:${d.done ? d.before / max : 0}"><span>${d.done ? Math.round(d.before) : ''}</span></div><div class="eb-bar new ${d.after >= d.before ? 'up' : 'down'}" style="--w:${d.done ? d.after / max : 0}"><span>${d.done ? Math.round(d.after) : ''}</span></div></div></div>`,
    )
    .join('')}</div>`;
}

export function verdictBlock(v: Verdict): string {
  return `<div class="verdict ${v.accepted ? 'kept' : 'binned'}"><div class="v-title">${esc(v.title)}</div><div class="v-nums"><div class="v-old"><small>current team</small><b>${pct(v.before)}</b></div><div class="v-arrow">→</div><div class="v-new"><small>with the change</small><b>${pct(v.after)}</b></div></div><div class="v-delta">${signed(v.delta)}<small> pts</small></div></div>`;
}

export function examBars(ex: NonNullable<World['exam']>): string {
  const rows = ex.tasks
    .map((t, i) => {
      const on = ex.revealed > i;
      return `<div class="xb ${on ? 'on' : ''}"><div class="xb-task">${esc(t.title)}</div><div class="xb-bars"><div class="xb-bar before" style="--w:${on ? t.before / 100 : 0}"><span>${t.before}%</span></div><div class="xb-bar after" style="--w:${on ? t.after / 100 : 0}"><span>${t.after}%</span></div></div></div>`;
    })
    .join('');
  return `<div class="exambars">${rows}</div>`;
}

export function sceneUrl(n: number): string {
  return new URL(`./assets/scene-${n}.jpg`, import.meta.url).href;
}

/** Preloads the scene pictures so swaps do not flash. */
export function preloadScenes(): void {
  for (let i = 1; i <= 6; i++) new Image().src = sceneUrl(i);
}
