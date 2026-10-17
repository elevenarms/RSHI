/**
 * Where the events come from: the crew server's SSE stream (`/api/events`), or a replay of a
 * recorded run (`?replay=<url of events.jsonl or events.json>&speed=<x>&t=<seconds to skip>`).
 * Both expose a virtual clock (ms), used to let finished episodes linger a little.
 */

import type { CrewEvent } from '@spotless/crew/contracts';

export interface Source {
  readonly mode: 'live' | 'replay';
  readonly speed: number;
  /** Virtual time now, in ms since the epoch (event time). */
  now(): number;
  connected(): boolean;
}

export function parseEvents(text: string): CrewEvent[] {
  const t = text.trim();
  if (t.startsWith('[')) return JSON.parse(t) as CrewEvent[];
  return t
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as CrewEvent);
}

export function startSource(onEvent: (e: CrewEvent) => void, onBatch: (es: CrewEvent[]) => void): Source {
  const q = new URLSearchParams(location.search);
  const replay = q.get('replay');
  if (replay) return startReplay(replay, Number(q.get('speed') ?? '1') || 1, Number(q.get('t') ?? '0') || 0, onEvent, onBatch);
  let ok = false;
  const es = new EventSource(q.get('events') ?? 'api/events');
  es.onopen = () => (ok = true);
  es.onerror = () => (ok = false);
  es.onmessage = (m: MessageEvent<string>) => {
    try {
      onEvent(JSON.parse(m.data) as CrewEvent);
    } catch {
      /* ignore malformed */
    }
  };
  return { mode: 'live', speed: 1, now: () => Date.now(), connected: () => ok };
}

function startReplay(url: string, speed: number, skip: number, onEvent: (e: CrewEvent) => void, onBatch: (es: CrewEvent[]) => void): Source {
  let base = 0; // event time at wall start
  let wallStart = 0;
  let ready = false;
  const src: Source = {
    mode: 'replay',
    speed,
    now: () => (ready ? base + (performance.now() - wallStart) * speed : Date.now()),
    connected: () => ready,
  };
  void fetch(url)
    .then((r) => r.text())
    .then((text) => {
      const events = parseEvents(text).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
      if (events.length === 0) return;
      base = Date.parse(events[0]!.at) + skip * 1000;
      wallStart = performance.now();
      ready = true;
      let i = 0;
      const head: CrewEvent[] = [];
      while (i < events.length && Date.parse(events[i]!.at) <= base) head.push(events[i++]!);
      if (head.length) onBatch(head);
      const tick = (): void => {
        const now = src.now();
        while (i < events.length && Date.parse(events[i]!.at) <= now) onEvent(events[i++]!);
        if (i < events.length) setTimeout(tick, 30);
      };
      tick();
    });
  return src;
}
