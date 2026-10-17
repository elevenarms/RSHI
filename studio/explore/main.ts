/**
 * The design sandbox: a fixed 1920×1080 stage scaled to the window, a looping pretend run, a
 * director that picks the spotlight, shared overlays (title, outro, verdict stamp), and three
 * switchable variants.
 *
 * Keys: 1 / 2 / 3 variant · P present mode · Space pause the director · T title · O outro
 *       . pause the run · ← / → previous / next moment · H help
 * URL:  ?v=1|2|3  &present=0  &at=<beat name or seconds>  &paused  &card=title|outro
 */

import './base.css';
import './v1.css';
import './v2.css';
import './v3.css';
import { CARDS, fill } from './captions';
import { BEAT_NAMES, Timeline, type World } from './mock';
import { esc, h, preloadScenes } from './ui';
import { spotFor, type Spot, type View } from './view';
import { mission } from './v1';
import { broadcast } from './v2';
import { editorial } from './v3';

const VIEWS: Record<string, () => View> = { '1': mission, '2': broadcast, '3': editorial };

const q = new URLSearchParams(location.search);
const stage = document.getElementById('stage')!;
const viewport = document.getElementById('viewport')!;

const tl = new Timeline();
let view: View | null = null;
let variant = VIEWS[q.get('v') ?? ''] ? q.get('v')! : '1';
let present = q.get('present') !== '0';
let directorPaused = false;
let spot: Spot | null = null;
let lastMomentRev = -1;
let spotChanged = true;

// --- stage scaling ---------------------------------------------------------------------------
function fit(): void {
  const s = Math.min(innerWidth / 1920, innerHeight / 1080);
  stage.style.transform = `scale(${s})`;
  stage.style.left = `${(innerWidth - 1920 * s) / 2}px`;
  stage.style.top = `${(innerHeight - 1080 * s) / 2}px`;
}
addEventListener('resize', fit);

// --- shared overlays -------------------------------------------------------------------------
const overlay = h('div', 'overlays');
const stampEl = h('div', 'stamp');
const cardEl = h('div', 'card');
const helpEl = h('div', 'help');
const badge = h('div', 'badge');
overlay.append(stampEl, cardEl, helpEl, badge);

let stampRev = -1;
function showStamp(w: World): void {
  if (w.moment.kind !== 'verdict' || w.rev.moment === stampRev) return;
  stampRev = w.rev.moment;
  const v = w.moment.verdict;
  stampEl.className = `stamp ${v.accepted ? 'kept' : 'binned'}`;
  stampEl.innerHTML = `<div class="stamp-word">${v.accepted ? CARDS.stamp.accepted : CARDS.stamp.rejected}</div><div class="stamp-delta">${v.delta > 0 ? '+' : '−'}${Math.abs(v.delta).toFixed(1)}<small>pts</small></div>`;
  void stampEl.offsetWidth;
  stampEl.classList.add('show');
}

function showCard(kind: 'title' | 'outro' | null): void {
  if (!kind) {
    cardEl.className = 'card';
    return;
  }
  if (kind === 'title') {
    const c = CARDS.title;
    cardEl.innerHTML = `<div class="card-inner"><div class="card-mark"><span></span></div><h1>${esc(c.name)}</h1><p class="card-sub">${esc(c.subtitle)}</p><p class="card-credit">${esc(c.credit)}</p></div>`;
  } else {
    const c = CARDS.outro;
    const f = { delta: '+20', before: '46%', after: '66%', tasks: 3 };
    cardEl.innerHTML = `<div class="card-inner"><div class="card-kicker">final exam · levels it never saw</div><h1 class="outro-h">${esc(fill(c.headline, f))}</h1><div class="outro-bars"><div><span style="--w:.46"></span><b>day one · 46%</b></div><div class="after"><span style="--w:.66"></span><b>after 4 generations · 66%</b></div></div><p class="card-sub">${esc(fill(c.sub, f))}</p><p class="card-credit">${esc(c.credit)}</p></div>`;
  }
  cardEl.className = `card ${kind} show`;
}
let card: 'title' | 'outro' | null = (q.get('card') as 'title' | 'outro' | null) ?? null;

helpEl.innerHTML = `<b>Keys</b> 1 2 3 variant · P present · Space hold spotlight · T title · O outro · . pause · ← → moments · H hide`;

function renderBadge(): void {
  badge.innerHTML = `<span>v${variant} · ${esc(view?.name ?? '')}</span><span class="${present ? 'on' : ''}">present ${present ? 'on' : 'off'}</span>${directorPaused ? '<span class="on warn">spotlight held</span>' : ''}${tl.paused ? '<span class="on warn">paused</span>' : ''}`;
}

// --- variants --------------------------------------------------------------------------------
function setVariant(v: string): void {
  if (!VIEWS[v]) return;
  view?.destroy();
  stage.innerHTML = '';
  variant = v;
  document.body.dataset['v'] = v;
  view = VIEWS[v]!();
  const root = h('div', `variant v${v}`);
  stage.append(root, overlay);
  view.mount(root);
  spotChanged = true;
  lastMomentRev = -1;
  const u = new URL(location.href);
  u.searchParams.set('v', v);
  history.replaceState(null, '', u);
  renderBadge();
}

// --- director --------------------------------------------------------------------------------
function direct(w: World): void {
  if (!present) {
    if (spot !== null) {
      spot = null;
      spotChanged = true;
    }
    return;
  }
  if (w.rev.moment === lastMomentRev) return;
  lastMomentRev = w.rev.moment;
  if (directorPaused) return;
  const next = spotFor(w.moment) ?? spot ?? 'live';
  if (next !== spot) {
    spot = next;
    spotChanged = true;
  }
}

// --- loop ------------------------------------------------------------------------------------
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  tl.advance(dt);
  const w = tl.world;
  direct(w);
  document.body.dataset['spot'] = spot ?? '';
  document.body.classList.toggle('present', present);
  view?.update(w, { present, spot, spotChanged });
  spotChanged = false;
  showStamp(w);
  requestAnimationFrame(frame);
}

// --- keys ------------------------------------------------------------------------------------
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (VIEWS[k]) setVariant(k);
  else if (k === 'p') {
    present = !present;
    lastMomentRev = -1;
  } else if (k === ' ') {
    directorPaused = !directorPaused;
    e.preventDefault();
  } else if (k === 't') {
    card = card === 'title' ? null : 'title';
    showCard(card);
  } else if (k === 'o') {
    card = card === 'outro' ? null : 'outro';
    showCard(card);
  } else if (k === 'escape') {
    card = null;
    showCard(null);
  } else if (k === '.') tl.paused = !tl.paused;
  else if (k === 'arrowright') tl.step(1);
  else if (k === 'arrowleft') tl.step(-1);
  else if (k === 'h') helpEl.classList.toggle('hide');
  else return;
  renderBadge();
});

// --- boot ------------------------------------------------------------------------------------
preloadScenes();
fit();
setVariant(variant);
const at = q.get('at');
if (at) {
  if (/^[\d.]+$/.test(at)) tl.seek(Number(at));
  else tl.seekBeat(at, Number(q.get('dt') ?? '0.3'));
}
if (q.has('paused')) tl.paused = true;
if (q.has('nohelp')) helpEl.classList.add('hide');
showCard(card);
renderBadge();
requestAnimationFrame(frame);

/** For the screenshot script and the console. */
(window as unknown as { explore: unknown }).explore = {
  tl,
  beats: BEAT_NAMES,
  setVariant,
  card: (c: 'title' | 'outro' | null) => showCard((card = c)),
};
