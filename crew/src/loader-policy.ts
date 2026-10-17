/**
 * The Loader: bench's standard `llmPolicy`, with the genome's text appended to the harness's
 * system prompt (stable for the whole episode, so the prefix caches), the denied tools taken
 * out, the tools wrapped (tool_call events, the preflight rule, a record of where each item is),
 * and every model turn told to the studio.
 */

import type { EpisodeTools, ModelProvider, Policy, ToolOutcome, TurnRequest } from '@spotless/bench';
import { llmPolicy } from '@spotless/bench';
import type { Genome } from './contracts.ts';
import type { EventBus } from './bus.ts';
import { loaderSystemText } from './genome.ts';

const ACTIONS = new Set(['place', 'remove', 'reset', 'set_rack']);

/** What the loader's episode left behind besides the record. */
export interface LoaderTrace {
  /** item_id -> location (lower_rack, upper_rack, cutlery_basket, counter, ...) as the results said. */
  readonly locations: Map<string, string>;
  readonly notes: string[];
  refusedStarts: number;
}

export interface CrewLoaderOptions {
  readonly genome: Genome;
  readonly plan: string | null;
  readonly brief: string | null;
  readonly provider: ModelProvider;
  readonly bus: EventBus | null;
  readonly episodeKey: string;
}

/** One line about a tool result. */
export function resultSummary(name: string, outcome: ToolOutcome): string {
  const s = outcome.structured;
  if (s === null) return outcome.text.slice(0, 160);
  if (s['accepted'] === false) return `refused: ${String(s['reason'] ?? '')} ${String(s['detail'] ?? '').slice(0, 120)}`.trim();
  const budget = s['budget'] as { [k: string]: string } | undefined;
  const b = budget === undefined ? '' : ` [${Object.entries(budget).map(([k, v]) => `${k} ${v}`).join(', ')}]`;
  if (name === 'place') {
    const items = ((s['changes'] as { items?: { item_id: string; location?: string; stable?: boolean }[] } | undefined)?.items ?? []);
    const me = items.find((i) => i.item_id === s['item_id']);
    return `${String(s['item_id'])} -> ${me?.location ?? '?'}${s['stable'] === false ? ' (unstable)' : ''}${items.length > 1 ? `, ${items.length - 1} others moved` : ''}${b}`;
  }
  if (name === 'check_load') {
    const problems = ['fell_out', 'on_tub_floor', 'protruding', 'door_blocked_by', 'dispenser_blocked_by']
      .map((k) => [k, s[k]] as const)
      .filter(([, v]) => Array.isArray(v) && v.length > 0)
      .map(([k, v]) => `${k}: ${(v as unknown[]).length}`);
    return problems.length === 0 ? `load checks out${b}` : `problems: ${problems.join(', ')}${b}`;
  }
  if (name === 'start_cycle') return `cycle started (${String(s['phase'] ?? '')})`;
  return `ok${b}`;
}

function track(trace: LoaderTrace, outcome: ToolOutcome): void {
  const s = outcome.structured;
  if (s === null) return;
  const placed = s['placed'] as { columns?: string[]; rows?: unknown[][] } | undefined;
  if (placed?.columns !== undefined && Array.isArray(placed.rows)) {
    const id = placed.columns.indexOf('item_id');
    const loc = placed.columns.indexOf('location');
    if (id >= 0 && loc >= 0) {
      trace.locations.clear();
      for (const row of placed.rows) trace.locations.set(String(row[id]), String(row[loc]));
    }
  }
  const changes = s['changes'] as { [k: string]: unknown } | undefined;
  if (changes !== undefined) {
    for (const [key, value] of Object.entries(changes)) {
      if (key === 'items' && Array.isArray(value)) {
        for (const item of value as { item_id?: string; location?: string }[]) {
          if (item.item_id !== undefined) trace.locations.set(item.item_id, item.location ?? 'unknown');
        }
      } else if (Array.isArray(value) && /counter|return|removed/i.test(key)) {
        for (const v of value) {
          const id = typeof v === 'string' ? v : (v as { item_id?: string })?.item_id;
          if (id !== undefined) trace.locations.delete(id);
        }
      }
    }
  }
}

/** The loader's tools as the policy holds them. */
export function wrapTools(tools: EpisodeTools, o: { genome: Genome; bus: EventBus | null; episodeKey: string; trace: LoaderTrace }): EpisodeTools {
  let seq = 0;
  let checkedSinceAction = false;
  const denied = new Set(o.genome.loader.deniedTools);
  const wrapped = {
    get calls() {
      return tools.calls;
    },
    list: async () => (await tools.list()).filter((t) => !denied.has(t.name)),
    resource: (uri: string) => tools.resource(uri),
    identity: () => tools.identity(),
    async call(name: string, args: unknown): Promise<ToolOutcome> {
      let outcome: ToolOutcome;
      if (denied.has(name)) {
        outcome = { structured: { accepted: false, reason: 'tool_denied' }, text: JSON.stringify({ accepted: false, reason: 'tool_denied', detail: `${name} is not available to you` }), images: [], isError: true };
      } else if (name === 'start_cycle' && o.genome.team.preflightCheck && !checkedSinceAction) {
        o.trace.refusedStarts += 1;
        const detail = 'preflight: call check_load first (after your last action), fix every problem it reports, then call start_cycle again';
        outcome = { structured: { accepted: false, reason: 'preflight_required', detail }, text: JSON.stringify({ accepted: false, reason: 'preflight_required', detail }), images: [], isError: true };
      } else {
        outcome = await tools.call(name, args);
        if (!outcome.isError) {
          if (ACTIONS.has(name) && outcome.structured?.['accepted'] !== false) checkedSinceAction = false;
          if (name === 'check_load') checkedSinceAction = true;
        }
        track(o.trace, outcome);
      }
      seq += 1;
      o.bus?.emit({ type: 'tool_call', episodeKey: o.episodeKey, seq, name, args, ok: !outcome.isError && outcome.structured?.['accepted'] !== false, summary: resultSummary(name, outcome) });
      return outcome;
    },
  };
  return wrapped as unknown as EpisodeTools;
}

/** The provider with the genome's text appended to the system prompt, pictures removed if asked, turns told. */
export function wrapProvider(provider: ModelProvider, o: { extra: string; images: boolean; bus: EventBus | null; episodeKey: string; trace: LoaderTrace }): ModelProvider {
  return {
    name: provider.name,
    model: provider.model,
    settings: () => provider.settings(),
    async complete(request: TurnRequest) {
      const history = o.images
        ? request.history
        : request.history.map((entry) =>
            entry.role === 'tool'
              ? { ...entry, results: entry.results.map((r) => ({ ...r, images: r.images.map(() => ({ removed: true as const, note: '[picture not shown to this loader]' })) })) }
              : entry.role === 'user' && entry.images !== undefined
                ? { role: 'user' as const, text: entry.text }
                : entry,
          );
      const started = performance.now();
      o.bus?.emit({ type: 'agent_status', role: 'loader', status: 'thinking', label: 'thinking', episodeKey: o.episodeKey });
      const turn = await provider.complete({ system: o.extra === '' ? request.system : `${request.system}\n\n---\n\n${o.extra}`, tools: request.tools, history });
      const text = turn.text.trim();
      if (text !== '') {
        o.trace.notes.push(text.slice(0, 500));
        if (o.trace.notes.length > 8) o.trace.notes.shift();
      }
      o.bus?.emit({
        type: 'model_turn',
        episodeKey: o.episodeKey,
        role: 'loader',
        text: text.slice(0, 600),
        toolCalls: turn.tool_calls.map((c) => c.name),
        tokensIn: turn.usage.input_tokens + turn.usage.cache_read_input_tokens + turn.usage.cache_creation_input_tokens,
        tokensOut: turn.usage.output_tokens,
        ms: Math.round(performance.now() - started),
      });
      o.bus?.emit({ type: 'agent_status', role: 'loader', status: 'acting', label: turn.tool_calls.map((c) => c.name).join(', ') || 'talking', episodeKey: o.episodeKey });
      return turn;
    },
  };
}

/** The crew's loader as a bench policy, and the trace it fills. */
export function crewLoaderPolicy(o: CrewLoaderOptions): { policy: Policy; trace: LoaderTrace } {
  const trace: LoaderTrace = { locations: new Map(), notes: [], refusedStarts: 0 };
  const extra = loaderSystemText(o.genome, o.plan, o.brief);
  const provider = wrapProvider(o.provider, { extra, images: o.genome.loader.images, bus: o.bus, episodeKey: o.episodeKey, trace });
  const inner = llmPolicy({ provider, maxTurns: o.genome.loader.maxTurns, maxInputTokens: 3_000_000 });
  const policy: Policy = {
    name: `crew:${o.genome.id}`,
    kind: 'agent',
    settings: () => ({ crew_genome: o.genome.id, inner: inner.settings() }),
    play: (context) => inner.play({ ...context, tools: wrapTools(context.tools, { genome: o.genome, bus: o.bus, episodeKey: o.episodeKey, trace }) }),
  };
  return { policy, trace };
}
