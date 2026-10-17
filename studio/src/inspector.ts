/**
 * The OBJECT inspector: the item the loader is working on, as an entity card with a turntable
 * view of it (`<origin of watchUrl>/#<sessionId>&turntable&item=<itemId>`).
 *
 * Driven by events of the focused episode: `episode_started.items` (kind, soils, points), every
 * tool call or streamed tool arguments naming an `item_id`, the `place` arguments (rack, stance)
 * and the episode summary at the end (clean or not).
 */

import type { CrewEvent } from '@spotless/crew/contracts';

type Ev<T extends CrewEvent['type']> = Extract<CrewEvent, { type: T }>;

export interface ObjectInfo {
  itemId: string;
  kind: string | null;
  label: string | null;
  soils: readonly string[] | null;
  points: number | null;
  rack: string | null;
  stance: string | null;
  status: 'dirty' | 'loaded' | 'clean' | 'not-clean';
  lastTool: string | null;
}

interface EpisodeObjects {
  sessionId: string;
  watchUrl: string;
  items: Map<string, ObjectInfo>;
  current: string | null;
}

const ITEM_RE = /"item_?id"\s*:\s*"([^"]+)"/g;

export class Inspector {
  private eps = new Map<string, EpisodeObjects>();
  private streamText = new Map<string, string>();
  private shownKey = '';
  private shownSig = '';
  private frameBase = '';

  constructor(
    private frame: HTMLIFrameElement,
    private card: HTMLElement,
    private box: HTMLElement,
  ) {}

  private ep(key: string): EpisodeObjects {
    let e = this.eps.get(key);
    if (!e) {
      e = { sessionId: '', watchUrl: '', items: new Map(), current: null };
      this.eps.set(key, e);
    }
    return e;
  }

  private item(e: EpisodeObjects, id: string): ObjectInfo {
    let o = e.items.get(id);
    if (!o) {
      o = { itemId: id, kind: guessKind(id), label: null, soils: null, points: null, rack: null, stance: null, status: 'dirty', lastTool: null };
      e.items.set(id, o);
    }
    return o;
  }

  onEvent(ev: CrewEvent): void {
    switch (ev.type) {
      case 'episode_started': {
        const e = this.ep(ev.episodeKey);
        e.sessionId = ev.sessionId;
        e.watchUrl = ev.watchUrl;
        const items = (ev as Ev<'episode_started'> & { items?: readonly { itemId: string; kind: string; soils: readonly string[]; points: number; label?: string }[] }).items;
        for (const it of items ?? []) {
          const o = this.item(e, it.itemId);
          o.kind = it.kind;
          o.soils = it.soils;
          o.points = it.points;
          o.label = it.label ?? null;
        }
        break;
      }
      case 'tool_call': {
        const e = this.ep(ev.episodeKey);
        const a = (ev.args ?? {}) as Record<string, unknown>;
        const id = (a['item_id'] ?? a['itemId'] ?? a['item']) as string | undefined;
        if (typeof id === 'string' && id) {
          const o = this.item(e, id);
          e.current = id;
          o.lastTool = `${ev.name}${ev.ok ? '' : ' (refused)'}`;
          if (ev.name === 'place' && ev.ok) {
            o.status = 'loaded';
            if (typeof a['rack'] === 'string') o.rack = a['rack'] as string;
            if (typeof a['stance'] === 'string') o.stance = a['stance'] as string;
          }
          if (ev.name === 'remove' && ev.ok) o.status = 'dirty';
        }
        break;
      }
      case 'stream': {
        if (ev.channel !== 'tool_args' || !ev.episodeKey) break;
        const t = (this.streamText.get(ev.streamId) ?? '') + ev.delta;
        this.streamText.set(ev.streamId, t.slice(-600));
        if (ev.done) this.streamText.delete(ev.streamId);
        let m: RegExpExecArray | null;
        let last: string | null = null;
        ITEM_RE.lastIndex = 0;
        while ((m = ITEM_RE.exec(t))) last = m[1]!;
        if (last) {
          const e = this.ep(ev.episodeKey);
          this.item(e, last);
          e.current = last;
        }
        break;
      }
      case 'episode_finished': {
        const e = this.ep(ev.summary.episodeKey);
        for (const it of ev.summary.items) {
          const o = this.item(e, it.itemId);
          o.kind = it.kind || o.kind;
          o.soils = it.soils;
          o.points = it.points;
          o.rack = it.rack ?? o.rack;
          o.stance = it.stance ?? o.stance;
          o.status = it.loaded ? (it.clean ? 'clean' : 'not-clean') : 'dirty';
        }
        break;
      }
      default:
        break;
    }
  }

  /** Draws the object of the focused episode (cheap when nothing changed). */
  render(focusKey: string | null): void {
    const e = focusKey ? this.eps.get(focusKey) : undefined;
    const o = e?.current ? e.items.get(e.current) : undefined;
    const sig = o ? JSON.stringify(o) : '';
    if (focusKey === this.shownKey && sig === this.shownSig) return;
    this.shownKey = focusKey ?? '';
    this.shownSig = sig;
    this.box.classList.toggle('has', !!o);
    if (!e || !o) {
      this.card.innerHTML = `<div class="ent-empty">Waiting for the loader to pick up an object…</div>`;
      return;
    }
    this.setFrame(e, o.itemId);
    const cap = this.box.querySelector('.tt-cap');
    if (cap) cap.textContent = o.label ?? (o.kind ? o.kind.replace(/_/g, ' ') : o.itemId);
    const st = o.status;
    const pill = st === 'clean' ? 'CLEAN' : st === 'not-clean' ? 'NOT CLEAN' : st === 'loaded' ? 'LOADED' : 'DIRTY';
    const pending = '<span class="pend">pending</span>';
    const row = (k: string, v: string): string => `<div class="pr"><span class="pk">${k}</span><span class="pv">${v}</span></div>`;
    this.card.innerHTML = `<div class="ent-h"><span class="etype">OBJECT</span><span class="eid">${esc(o.itemId)}</span><span class="spill st-${st}">${pill}</span></div>
      ${o.label ? `<div class="ent-name">${esc(o.label)}</div>` : ''}
      <div class="props">
        ${row('KIND', o.kind ? esc(o.kind.replace(/_/g, ' ')) : pending)}
        ${row('SOILS', o.soils ? (o.soils.length ? o.soils.map((x) => `<span class="soil">${esc(x.replace(/_/g, ' '))}</span>`).join(' ') : 'none') : pending)}
        ${row('POINTS', o.points !== null ? `<b>${o.points}</b>` : pending)}
        ${row('RACK', o.rack ? esc(o.rack.replace(/_/g, ' ')) : '—')}
        ${row('STANCE', o.stance ? esc(o.stance.replace(/_/g, ' ')) : '—')}
        ${row('LAST ACT', o.lastTool ? esc(o.lastTool) : '—')}
        ${row('EPISODE', esc(focusKey ?? ''))}
      </div>`;
  }

  private setFrame(e: EpisodeObjects, itemId: string): void {
    if (!e.watchUrl || !e.sessionId) return;
    let base: string;
    try {
      base = new URL(e.watchUrl, location.href).href.split('#')[0]!;
    } catch {
      return;
    }
    const url = `${base}#${e.sessionId}&turntable&item=${encodeURIComponent(itemId)}`;
    if (base === this.frameBase && this.frame.contentWindow) {
      // Same page: only the fragment changes, so the turntable switches objects without a reload.
      try {
        this.frame.contentWindow.location.replace(url);
        return;
      } catch {
        /* fall through */
      }
    }
    this.frameBase = base;
    this.frame.src = url;
  }
}

function guessKind(id: string): string | null {
  const k = id.replace(/[_-]?\d+$/, '');
  return k && k !== id ? k : null;
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
