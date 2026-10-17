/**
 * The token waterfall: `stream` events pour into a terminal-style panel, one lane per model call
 * (up to 8 at once, recycled), reasoning in grey, the visible answer in white, tool arguments in
 * the role's colour, with tokens/second per model and in total.
 *
 * Kept out of the pure state fold on purpose: streams are many small events, and the panel draws
 * them with its own requestAnimationFrame batching and a capped DOM.
 */

import type { CrewEvent, Role } from '@spotless/crew/contracts';
import { modelName } from './models.ts';

type StreamEv = Extract<CrewEvent, { type: 'stream' }>;
type Channel = StreamEv['channel'];

const MAX_LANES = 8;
/** Characters kept per lane (older text scrolls away). */
const KEEP = 1400;
/** Rough characters per token, to turn text into a token rate. */
const CPT = 4;

interface Seg { ch: Channel; text: string }
interface Lane {
  id: string;
  role: Role;
  model: string;
  episodeKey: string;
  segs: Seg[];
  /** Characters received but not yet revealed (smooths the ~100 ms batches into a pour). */
  pending: Seg[];
  done: boolean;
  last: number;
  el: HTMLDivElement;
  body: HTMLDivElement;
  head: HTMLDivElement;
  dirty: boolean;
  chars: number;
}

export interface TokenPanel {
  push(e: StreamEv): void;
  /** Tokens/second over the last 3 s (`now`), whether anything streamed in that window, and the last non-zero rate. */
  rate(): { now: number; live: boolean; last: number };
}

export function tokenPanel(root: HTMLElement, meter: HTMLElement, taskOf: (episodeKey: string) => string | undefined = () => undefined): TokenPanel {
  const lanes = new Map<string, Lane>();
  const order: Lane[] = [];
  const grid = document.createElement('div');
  grid.className = 'lanes';
  root.append(grid);
  const empty = document.createElement('div');
  empty.className = 'tw-empty';
  empty.textContent = 'waiting for tokens…';
  root.append(empty);

  // Rate window: [time, model, tokens].
  const window: [number, string, number][] = [];
  let totalTok = 0;
  let curRate = 0;
  let lastRate = 0;
  let layoutN = -1;

  function lane(e: StreamEv): Lane {
    let l = lanes.get(e.streamId);
    if (l) return l;
    // Recycle the oldest finished lane, else the oldest one.
    if (order.length >= MAX_LANES) {
      const victim = order.filter((x) => x.done).sort((a, b) => a.last - b.last)[0] ?? order.slice().sort((a, b) => a.last - b.last)[0]!;
      lanes.delete(victim.id);
      order.splice(order.indexOf(victim), 1);
      victim.el.remove();
    }
    const el = document.createElement('div');
    el.className = 'lane';
    el.style.setProperty('--rc', `var(--${e.role})`);
    const head = document.createElement('div');
    head.className = 'lh';
    const body = document.createElement('div');
    body.className = 'lb';
    el.append(head, body);
    grid.append(el);
    l = { id: e.streamId, role: e.role, model: e.model, episodeKey: e.episodeKey ?? '', segs: [], pending: [], done: false, last: performance.now(), el, body, head, dirty: true, chars: 0 };
    lanes.set(e.streamId, l);
    order.push(l);
    return l;
  }

  function push(e: StreamEv): void {
    const l = lane(e);
    l.last = performance.now();
    if (e.delta) {
      const p = l.pending[l.pending.length - 1];
      if (p && p.ch === e.channel) p.text += e.delta;
      else l.pending.push({ ch: e.channel, text: e.delta });
      const tok = e.delta.length / CPT;
      window.push([l.last, e.model, tok]);
      totalTok += tok;
    }
    if (e.done) l.done = true;
    l.dirty = true;
  }

  function reveal(l: Lane, dt: number): void {
    let backlog = l.pending.reduce((a, p) => a + p.text.length, 0);
    if (!backlog) return;
    // Drain the backlog in about 150 ms, at least a few characters a frame.
    let n = Math.max(2, Math.ceil((backlog * dt) / 150));
    while (n > 0 && l.pending.length) {
      const p = l.pending[0]!;
      const take = p.text.slice(0, n);
      p.text = p.text.slice(n);
      n -= take.length;
      backlog -= take.length;
      const s = l.segs[l.segs.length - 1];
      if (s && s.ch === p.ch) s.text += take;
      else l.segs.push({ ch: p.ch, text: s ? `\n${take.replace(/^\n/, '')}` : take });
      l.chars += take.length;
      if (!p.text) l.pending.shift();
    }
    // Cap what is kept.
    let len = l.segs.reduce((a, s) => a + s.text.length, 0);
    while (len > KEEP && l.segs.length) {
      const s = l.segs[0]!;
      const cut = Math.min(s.text.length, len - KEEP);
      s.text = s.text.slice(cut);
      len -= cut;
      if (!s.text) l.segs.shift();
    }
    l.dirty = true;
  }

  const esc = (s: string): string => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
  const short = (m: string): string => modelName(m);

  let lastMeter = 0;
  let prev = performance.now();
  function frame(now: number): void {
    const dt = now - prev;
    prev = now;
    if (order.length !== layoutN) {
      layoutN = order.length;
      const n = order.length;
      grid.style.gridTemplateColumns = `repeat(${Math.max(1, n)}, minmax(0, 1fr))`;
      empty.style.display = n ? 'none' : '';
    }
    for (const l of order) {
      reveal(l, dt);
      if (!l.dirty) continue;
      l.dirty = false;
      const live = !l.done || l.pending.length > 0;
      l.el.classList.toggle('done', !live);
      l.head.innerHTML = `<div><b>${l.role}</b><span class="task">${esc(taskOf(l.episodeKey) ?? (l.episodeKey ? l.episodeKey : 'team'))}</span><em>${Math.round(l.chars / CPT)} tok</em></div><div><i>${esc(short(l.model))}</i></div>`;
      l.body.innerHTML = `<div>${l.segs.map((s) => `<span class="c-${s.ch}">${esc(s.text)}</span>`).join('')}${live ? '<span class="caret"></span>' : ''}</div>`;
    }
    if (now - lastMeter > 250) {
      lastMeter = now;
      while (window.length && now - window[0]![0] > 3000) window.shift();
      const by = new Map<string, number>();
      let sum = 0;
      for (const [, m, t] of window) {
        by.set(m, (by.get(m) ?? 0) + t);
        sum += t;
      }
      curRate = sum / 3;
      if (curRate > 0) lastRate = curRate;
      meter.innerHTML =
        [...by]
          .sort((a, b) => b[1] - a[1])
          .map(([m, t]) => `<span>${esc(short(m))} <b>${Math.round(t / 3)}</b> tok/s</span>`)
          .join('') + `<span class="tot">Σ <b>${Math.round(sum / 3)}</b> tok/s · ${Math.round(totalTok).toLocaleString('en')} streamed</span>`;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { push, rate: () => ({ now: curRate, live: curRate > 0, last: lastRate }) };
}
