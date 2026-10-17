/**
 * A supervised fine-tuning set for the loader, from the call logs: the conversations of training
 * episodes that scored well under the genomes that were kept (baseline, accepted, champion).
 * Exam and test-split episodes are never used, so the held-out drills stay held out.
 *
 * One example per context segment of an episode: the full request of the last call before the
 * harness folded the conversation (or of the last call), with the model's answer appended, so
 * every assistant turn is in at least one example (they overlap where a picture was only pruned). Pictures are already logged as
 * text notes. Two files: `tools` format (OpenAI chat with `tools`, assistant `tool_calls`, `tool`
 * messages) and `text` format (system / user / assistant only, tool calls and results as text),
 * since Crusoe's fine-tuning docs only document the system / user / assistant roles.
 */

import { readEvents } from './bus.ts';
import { reconstructRequests } from './calllog.ts';
import { readJsonlAnywhere } from './archive.ts';

export interface SftOptions {
  readonly runDirs: readonly string[];
  readonly keptGenomes: ReadonlySet<string>;
  readonly minShare: number;
}

export interface SftResult {
  readonly toolsLines: string[];
  readonly textLines: string[];
  readonly episodes: { runId: string; episodeKey: string; genomeId: string; taskId: string; share: number; examples: number }[];
  readonly chars: number;
}

/** A conversation with tool calls turned into text (system / user / assistant only). */
export function asText(messages: readonly any[]): any[] {
  const out: any[] = [];
  for (const m of messages) {
    if (m.role === 'assistant') {
      const calls = (m.tool_calls ?? []).map((c: any) => `<tool_call>${JSON.stringify({ name: c.function?.name, arguments: safeJson(c.function?.arguments) })}</tool_call>`);
      out.push({ role: 'assistant', content: [m.content ?? '', ...calls].filter((x) => x !== '').join('\n') });
    } else if (m.role === 'tool') {
      const text = `<tool_result id="${m.tool_call_id}">${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}</tool_result>`;
      const last = out[out.length - 1];
      if (last?.role === 'user') last.content = `${last.content}\n${text}`;
      else out.push({ role: 'user', content: text });
    } else {
      const content = Array.isArray(m.content) ? m.content.map((p: any) => (p.type === 'text' ? p.text : '')).join('\n') : m.content;
      const last = out[out.length - 1];
      if (m.role === 'user' && last?.role === 'user') last.content = `${last.content}\n${content}`;
      else out.push({ role: m.role, content });
    }
  }
  return out;
}

function safeJson(s: unknown): unknown {
  if (typeof s !== 'string') return s;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

/** Text parts only (pictures are already notes in the call log). */
function flatten(messages: readonly any[]): any[] {
  return messages.map((m) => (Array.isArray(m.content) ? { ...m, content: m.content.map((p: any) => (p.type === 'text' ? p.text : '')).join('\n') } : m));
}

export function exportSft(o: SftOptions): SftResult {
  const toolsLines: string[] = [];
  const textLines: string[] = [];
  const episodes: SftResult['episodes'] = [];
  let chars = 0;
  for (const dir of o.runDirs) {
    const runId = dir.split('/').pop() as string;
    const summaries = readEvents(dir)
      .filter((e: any) => e.type === 'episode_finished')
      .map((e: any) => e.summary)
      .filter((s: any) => (s.purpose === 'train' || s.purpose === 'eval') && s.split === 'train' && !s.failed && s.share >= o.minShare && o.keptGenomes.has(s.genomeId));
    if (summaries.length === 0) continue;
    const wanted = new Set(summaries.map((s: any) => s.episodeKey));
    const all = reconstructRequests(readJsonlAnywhere(dir, 'calls.jsonl').join('\n'));
    const tools = new Map<string, unknown>();
    for (const c of all) if (c.line.tools !== undefined) tools.set(c.line.toolsHash, c.line.tools);
    const calls = all.filter((c) => c.line.role === 'loader' && wanted.has(c.line.episodeKey) && c.line.response != null);
    for (const s of summaries) {
      const mine = calls.filter((c) => c.line.episodeKey === s.episodeKey);
      let examples = 0;
      for (let i = 0; i < mine.length; i++) {
        const next = mine[i + 1];
        // A segment ends where the next request does not extend this one (a fold), or at the end.
        const ends = next === undefined || next.line.keep < mine[i]!.messages.length;
        if (!ends) continue;
        const r = mine[i]!.line.response;
        const answer = { role: 'assistant', content: r.content ?? '', ...(Array.isArray(r.tool_calls) && r.tool_calls.length > 0 ? { tool_calls: r.tool_calls } : {}) };
        const messages = [...flatten(mine[i]!.messages), answer];
        const t = tools.get(mine[i]!.line.toolsHash);
        const toolsLine = JSON.stringify({ messages, ...(t === undefined ? {} : { tools: t }) });
        const textLine = JSON.stringify({ messages: asText(messages) });
        toolsLines.push(toolsLine);
        textLines.push(textLine);
        chars += textLine.length;
        examples += 1;
      }
      if (examples > 0) episodes.push({ runId, episodeKey: s.episodeKey, genomeId: s.genomeId, taskId: s.taskId, share: s.share, examples });
    }
  }
  return { toolsLines, textLines, episodes, chars };
}
