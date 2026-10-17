/**
 * The event bus: every event is stamped (at, runId), kept in memory, appended to
 * `.crew/runs/<runId>/events.jsonl` and handed to the listeners (the SSE server).
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CrewEvent, CrewEventInput } from './contracts.ts';

export class EventBus {
  readonly events: CrewEvent[] = [];
  private readonly listeners = new Set<(event: CrewEvent) => void>();
  readonly file: string | null;

  constructor(
    readonly runId: string,
    readonly runDir: string | null,
    readonly echo: ((event: CrewEvent) => void) | null = null,
  ) {
    if (runDir !== null) {
      mkdirSync(runDir, { recursive: true });
      this.file = join(runDir, 'events.jsonl');
    } else this.file = null;
  }

  emit(input: CrewEventInput): CrewEvent {
    const event = { at: new Date().toISOString(), runId: this.runId, ...input } as CrewEvent;
    this.events.push(event);
    if (this.file !== null) appendFileSync(this.file, `${JSON.stringify(event)}\n`);
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // A listener's fault is not the run's.
      }
    }
    this.echo?.(event);
    return event;
  }

  log(text: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    this.emit({ type: 'log', level, text });
  }

  subscribe(listener: (event: CrewEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/** The events of a past run. */
export function readEvents(runDir: string): CrewEvent[] {
  const file = join(runDir, 'events.jsonl');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as CrewEvent];
      } catch {
        return [];
      }
    });
}

/** A short line for the terminal. */
export function eventLine(e: CrewEvent): string | null {
  switch (e.type) {
    case 'phase':
      return `== [gen ${e.generation}] ${e.phase}: ${e.detail}`;
    case 'episode_started':
      return `>> ${e.episodeKey} ${e.taskTitle} (${e.genomeId}, ${e.purpose}) watch: ${e.watchUrl}`;
    case 'episode_finished':
      return `<< ${e.summary.episodeKey} share ${e.summary.share.toFixed(3)} (${e.summary.points}/${e.summary.pointsAvailable}), ${e.summary.itemsClean}/${e.summary.itemsLoaded} clean of ${e.summary.itemsOffered}, stopped ${e.summary.stopped}, ${e.summary.turns} turns, load ${e.summary.loadingS}s wash ${e.summary.washS}s`;
    case 'decision':
      return `!! decision ${e.decision.candidateId}: ${e.decision.accepted ? 'ACCEPTED' : 'rejected'} (${e.decision.reason})`;
    case 'message':
      return `   ${e.from} -> ${e.to} [${e.kind}] ${e.title}`;
    case 'wash':
      return `   wash ${e.status} ${e.episodeKey} ${e.detail}`;
    case 'log':
      return `   ${e.level}: ${e.text}`;
    case 'exam':
      return `## exam: baseline ${e.baseline.share.toFixed(3)} vs champion ${e.champion.share.toFixed(3)}`;
    default:
      return null;
  }
}
