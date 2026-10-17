/**
 * The call log: one JSON line per model call in runs/<id>/calls.jsonl. A call carries its ids,
 * role, model, episode, times, usage, finish reason, retries and 429s, the request and the full
 * response (reasoning, content, tool calls as assembled). Never headers or the key.
 *
 * Requests: a team role's request is logged whole. The loader's conversation grows by appending
 * (except where the harness folds old turns), so a loader call logs its system prompt once per
 * episode by hash and, of its messages, how many it keeps from the previous call of the episode
 * (`keep`) and the new `tail`; a fold shows as a smaller `keep`. `reconstructRequests` rebuilds
 * every full request. Pictures are logged as `[png sha256:<hash> <bytes> bytes]`.
 */

import { createHash } from 'node:crypto';
import { closeSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs';

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

let fd: number | null = null;
let file: string | null = null;
let seq = 0;
const systemsSeen = new Set<string>();
const previous = new Map<string, string[]>();

/** Starts logging to `path` (appending); null stops. */
export function setCallLog(path: string | null): void {
  if (fd !== null) {
    try {
      fsyncSync(fd);
      closeSync(fd);
    } catch {
      // closed already
    }
  }
  fd = path === null ? null : openSync(path, 'a');
  file = path;
}

/** Flushes the log to disk (generation boundaries, the end of a run). */
export function syncCallLog(): void {
  if (fd !== null) {
    try {
      fsyncSync(fd);
    } catch {
      // nothing to sync
    }
  }
}

export function callLogFile(): string | null {
  return file;
}

/** A message with its pictures replaced by their hash and size. */
function withoutPictures(message: any): any {
  if (!Array.isArray(message?.content)) return message;
  return {
    ...message,
    content: message.content.map((part: any) => {
      if (part?.type !== 'image_url') return part;
      const url: string = part.image_url?.url ?? '';
      const data = url.slice(url.indexOf(',') + 1);
      return { type: 'text', text: `[png sha256:${sha(data).slice(0, 16)} ${Math.round((data.length * 3) / 4)} bytes]` };
    }),
  };
}

export interface CallRecord {
  readonly role: string;
  readonly model: string;
  readonly episodeKey?: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly ms: number;
  readonly attempts: number;
  readonly throttled: number;
  readonly body: { readonly [k: string]: unknown };
  readonly reply: any;
  readonly error?: string;
}

/** Appends one call. Never throws. */
export function logCall(c: CallRecord): void {
  if (fd === null) return;
  try {
    seq += 1;
    const { messages: rawMessages, tools, ...params } = c.body as { messages?: unknown[]; tools?: unknown[]; [k: string]: unknown };
    const messages = (rawMessages ?? []).map(withoutPictures);
    const choice = c.reply?.choices?.[0];
    const line: { [k: string]: unknown } = {
      seq,
      callId: `${c.role}-${Date.parse(c.startedAt).toString(36)}-${seq}`,
      role: c.role,
      model: c.model,
      ...(c.episodeKey === undefined ? {} : { episodeKey: c.episodeKey }),
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      ms: c.ms,
      attempts: c.attempts,
      throttled: c.throttled,
      params,
      ...(tools === undefined ? {} : { toolsHash: sha(JSON.stringify(tools)).slice(0, 16), toolNames: (tools as { function?: { name?: string } }[]).map((t) => t.function?.name ?? '') }),
      finishReason: choice?.finish_reason ?? null,
      usage: c.reply?.usage ?? null,
      response: choice?.message ?? null,
      ...(c.error === undefined ? {} : { error: c.error }),
    };
    if (c.role === 'loader' && c.episodeKey !== undefined) {
      const texts = messages.map((m) => JSON.stringify(m));
      const system = messages[0]?.role === 'system' ? String(messages[0].content) : '';
      const systemHash = sha(system).slice(0, 16);
      const prev = previous.get(c.episodeKey) ?? [];
      let keep = 0;
      while (keep < prev.length && keep < texts.length && prev[keep] === texts[keep]) keep++;
      // The system message is logged once per hash; the tail never repeats it.
      if (keep === 0 && messages[0]?.role === 'system') keep = 0;
      line['systemHash'] = systemHash;
      if (!systemsSeen.has(systemHash)) {
        systemsSeen.add(systemHash);
        line['system'] = system;
      }
      line['keep'] = keep;
      line['tail'] = messages.slice(Math.max(keep, 1));
      line['messages_total'] = messages.length;
      previous.set(c.episodeKey, texts);
      if (tools !== undefined && !systemsSeen.has(`tools:${line['toolsHash'] as string}`)) {
        systemsSeen.add(`tools:${line['toolsHash'] as string}`);
        line['tools'] = tools;
      }
    } else {
      line['messages'] = messages;
      if (tools !== undefined) line['tools'] = tools;
    }
    writeSync(fd, `${JSON.stringify(line)}\n`);
  } catch {
    // The log never breaks a run.
  }
}

/** Forgets an episode's conversation (when it ends). */
export function endEpisodeLog(episodeKey: string): void {
  previous.delete(episodeKey);
}

/**
 * Every call of a calls.jsonl with its full request messages rebuilt (pictures as their notes):
 * a loader call's messages are the system prompt (by hash) + `keep` messages of the previous call
 * of its episode + its `tail`.
 */
export function reconstructRequests(text: string): { line: any; messages: any[] }[] {
  const systems = new Map<string, string>();
  const last = new Map<string, any[]>();
  const out: { line: any; messages: any[] }[] = [];
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = JSON.parse(raw);
    if (line.messages !== undefined) {
      out.push({ line, messages: line.messages });
      continue;
    }
    if (typeof line.system === 'string') systems.set(line.systemHash, line.system);
    const prev = last.get(line.episodeKey) ?? [{ role: 'system', content: systems.get(line.systemHash) ?? '' }];
    const kept = prev.slice(0, Math.max(1, line.keep));
    kept[0] = { role: 'system', content: systems.get(line.systemHash) ?? '' };
    const messages = [...kept, ...line.tail];
    last.set(line.episodeKey, messages);
    out.push({ line, messages });
  }
  return out;
}

export function readCalls(path: string): { line: any; messages: any[] }[] {
  return reconstructRequests(readFileSync(path, 'utf8'));
}
