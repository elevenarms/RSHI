/**
 * Crusoe Managed Inference: the OpenAI-compatible chat completions endpoint, for every role.
 *
 *  - `chatJSON`: one text request whose answer is a JSON object (planner, critic, coach).
 *  - `loaderProvider`: the bench `ModelProvider` the loader plays through (tool calls, pictures).
 *  - A per-model client-side rate limiter shared by the whole process (CREW_RPM, default 25),
 *    and retries with jittered back-off on 429 / 503 / 5xx / time-outs.
 *
 * The key (CRUSOE_API_KEY) goes into one request header and nowhere else.
 */

import type { JsonValue } from '@spotless/core';
import type { ModelProvider, ModelTurn, OpenAiToolCall, TurnRequest, TurnStop } from '@spotless/bench';
import { ProviderError, openaiMessages, openaiUsage } from '@spotless/bench';
import type { CrewEventInput, Role } from './contracts.ts';

export const CRUSOE_BASE_URL = process.env['CRUSOE_BASE_URL'] ?? 'https://api.inference.crusoecloud.com/v1';

/** Default models per role (overridable by CREW_MODEL_<ROLE>). */
export const DEFAULT_MODELS = {
  // The weakest Nemotron that still plays competently (thinking off): the team improves around it.
  loader: 'nvidia/Nemotron-3.5-Lightning-30B-A3B',
  planner: 'nvidia/NVIDIA-Nemotron-3.5-Super-VL',
  critic: 'nvidia/Nemotron-3-Nano-Omni-Reasoning-30B-A3B',
  coach: 'nvidia/NVIDIA-Nemotron-3-Super-120B-A12B',
  librarian: 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B',
} as const;

/** The loader's default reasoning setting: thinking off for the weak Lightning loader, else 20. */
export function defaultLoaderEffort(model: string): string {
  return process.env['CREW_LOADER_EFFORT'] ?? (model.toLowerCase().includes('lightning') ? 'off' : '20');
}

export function modelFor(role: keyof typeof DEFAULT_MODELS): string {
  return process.env[`CREW_MODEL_${role.toUpperCase()}`] ?? DEFAULT_MODELS[role];
}

const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------
// Rate limiting (per model, process-wide)
// ---------------------------------------------------------------------------------------------

const windows = new Map<string, number[]>();
const chains = new Map<string, Promise<void>>();

function rpm(): number {
  const n = Number(process.env['CREW_RPM'] ?? '25');
  return Number.isFinite(n) && n > 0 ? n : 25;
}

/** Waits until a request to `model` fits in the last minute's budget, then books it. */
export function acquire(model: string): Promise<void> {
  const prev = chains.get(model) ?? Promise.resolve();
  const next = prev.then(async () => {
    const limit = rpm();
    for (;;) {
      const now = Date.now();
      const times = (windows.get(model) ?? []).filter((t) => now - t < 60_000);
      if (times.length < limit) {
        times.push(now);
        windows.set(model, times);
        return;
      }
      await pause(60_000 - (now - (times[0] as number)) + 50);
    }
  });
  chains.set(model, next.catch(() => undefined));
  return next;
}

/** Totals per model, for reports. */
export const usageTotals = new Map<string, { requests: number; in: number; out: number; cached: number; retries: number }>();
function tally(model: string, add: { in: number; out: number; cached: number; retry?: boolean }): void {
  const t = usageTotals.get(model) ?? { requests: 0, in: 0, out: 0, cached: 0, retries: 0 };
  if (add.retry === true) t.retries += 1;
  else {
    t.requests += 1;
    t.in += add.in;
    t.out += add.out;
    t.cached += add.cached;
  }
  usageTotals.set(model, t);
}

// ---------------------------------------------------------------------------------------------
// One request
// ---------------------------------------------------------------------------------------------

function apiKey(): string {
  const key = process.env['CRUSOE_API_KEY'] ?? '';
  if (key === '') throw new ProviderError('auth', 'no API key (set CRUSOE_API_KEY in .env)');
  return key;
}

/** Posts a chat completions body with rate limiting and retries; the reply JSON. */
export async function crusoeChat(body: { model: string; [k: string]: unknown }, options: { timeoutMs?: number; maxRetries?: number; stream?: StreamTag } = {}): Promise<{ reply: any; ms: number }> {
  if (process.env['CREW_FAKE'] === '1') return fakeChat(body);
  const streaming = options.stream !== undefined && process.env['CREW_STREAM'] !== '0';
  if (streaming) body = { ...body, stream: true, stream_options: { include_usage: true } };
  const key = apiKey();
  const maxRetries = options.maxRetries ?? 6;
  const timeoutMs = options.timeoutMs ?? 5 * 60_000;
  const clean = (s: string): string => s.split(key).join('[key]');
  for (let attempt = 0; ; attempt++) {
    const cap = IMAGE_CAPS.get(body.model);
    if (cap !== undefined && Array.isArray(body['messages'])) body = { ...body, messages: capImages(body['messages'] as any[], cap) };
    await acquire(body.model);
    const started = performance.now();
    let failure: ProviderError;
    let again = false;
    let wait: number | null = null;
    try {
      const response = await fetch(`${CRUSOE_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok && streaming) {
        try {
          return { reply: await readStream(response, body, options.stream as StreamTag), ms: Math.round(performance.now() - started) };
        } catch (error) {
          throw new StreamBroken(error instanceof Error ? error.message : String(error));
        }
      }
      const text = await response.text();
      if (response.ok) {
        try {
          return { reply: JSON.parse(text), ms: Math.round(performance.now() - started) };
        } catch {
          failure = new ProviderError('api', 'reply is not JSON', response.status);
          again = true;
        }
      } else {
        const status = response.status;
        const message = clean(`HTTP ${status}: ${text.slice(0, 400)}`);
        failure =
          status === 401 || status === 403
            ? new ProviderError('auth', message, status)
            : status === 429
              ? new ProviderError('rate_limit', message, status)
              : status >= 500 || status === 408
                ? new ProviderError('api', message, status)
                : new ProviderError('bad_request', message, status);
        again = status === 429 || status === 408 || status >= 500;
        const learnt = status === 400 ? imageCapFromError(text) : null;
        if (learnt !== null && learnt !== IMAGE_CAPS.get(body.model)) {
          IMAGE_CAPS.set(body.model, learnt);
          again = true;
          wait = 0;
        }
        const ra = response.headers.get('retry-after');
        if (ra !== null && Number.isFinite(Number(ra))) wait = Number(ra) * 1000;
      }
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      const name = error instanceof StreamBroken ? 'StreamBroken' : error instanceof Error ? error.name : '';
      failure =
        name === 'TimeoutError' || name === 'AbortError'
          ? new ProviderError('timeout', `no reply within ${timeoutMs} ms`)
          : new ProviderError('connection', clean(error instanceof Error ? error.message : String(error)));
      again = true;
    }
    if (!again || attempt >= maxRetries) throw failure;
    tally(body.model, { in: 0, out: 0, cached: 0, retry: true });
    const backoff = Math.min(60_000, 1500 * 2 ** attempt) * (0.7 + Math.random() * 0.6);
    await pause(Math.min(90_000, wait ?? backoff));
  }
}

// ---------------------------------------------------------------------------------------------
// Streaming: the reply assembled from SSE chunks, and `stream` events for the studio
// ---------------------------------------------------------------------------------------------

/** Who a streamed call belongs to. */
export interface StreamTag {
  readonly role: Role;
  readonly episodeKey?: string;
}

class StreamBroken extends Error {}

type StreamEvent = Extract<CrewEventInput, { type: 'stream' }>;
let streamSink: ((event: StreamEvent) => void) | null = null;
/** Where `stream` events go (the bus); null for nowhere. */
export function setStreamSink(sink: ((event: StreamEvent) => void) | null): void {
  streamSink = sink;
}

let streamSeq = 0;
const FLUSH_MS = 100;

/** Batches deltas per channel and emits them about every 100 ms. */
class StreamEmitter {
  private readonly id: string;
  private readonly buffers = new Map<StreamEvent['channel'], string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastChannel: StreamEvent['channel'] = 'content';
  constructor(private readonly tag: StreamTag, private readonly model: string) {
    streamSeq += 1;
    this.id = `${tag.role}-${Date.now().toString(36)}-${streamSeq}`;
  }
  push(channel: StreamEvent['channel'], delta: string): void {
    if (streamSink === null || delta === '') return;
    this.lastChannel = channel;
    this.buffers.set(channel, (this.buffers.get(channel) ?? '') + delta);
    if (this.timer === null) this.timer = setInterval(() => this.flush(false), FLUSH_MS);
  }
  private emit(channel: StreamEvent['channel'], delta: string, done: boolean): void {
    streamSink?.({ type: 'stream', streamId: this.id, role: this.tag.role, ...(this.tag.episodeKey === undefined ? {} : { episodeKey: this.tag.episodeKey }), model: this.model, channel, delta, done });
  }
  flush(done: boolean): void {
    for (const [channel, text] of this.buffers) if (text !== '') this.emit(channel, text, false);
    this.buffers.clear();
    if (done) {
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = null;
      if (streamSink !== null) this.emit(this.lastChannel, '', true);
    }
  }
}

/** Reads an SSE chat completion into the shape of a non-streamed reply. */
async function readStream(response: Response, body: { model: string; [k: string]: unknown }, tag: StreamTag): Promise<any> {
  const emitter = new StreamEmitter(tag, body.model);
  let content = '';
  let reasoning = '';
  let finish: string | null = null;
  let usage: any = null;
  let model: string = body.model;
  const calls: { id: string; name: string; args: string }[] = [];
  const decoder = new TextDecoder();
  let pending = '';
  const handle = (data: string): void => {
    if (data === '[DONE]') return;
    let chunk: any;
    try {
      chunk = JSON.parse(data);
    } catch {
      return;
    }
    if (chunk.error !== undefined) throw new Error(`stream error: ${JSON.stringify(chunk.error).slice(0, 300)}`);
    if (typeof chunk.model === 'string') model = chunk.model;
    if (chunk.usage != null) usage = chunk.usage;
    const choice = chunk.choices?.[0];
    if (choice === undefined) return;
    if (choice.finish_reason != null) finish = choice.finish_reason;
    const d = choice.delta ?? {};
    const r = typeof d.reasoning_content === 'string' ? d.reasoning_content : typeof d.reasoning === 'string' ? d.reasoning : '';
    if (r !== '') {
      reasoning += r;
      emitter.push('reasoning', r);
    }
    if (typeof d.content === 'string' && d.content !== '') {
      content += d.content;
      emitter.push('content', d.content);
    }
    for (const tc of (d.tool_calls ?? []) as any[]) {
      const i = typeof tc.index === 'number' ? tc.index : calls.length;
      let call = calls[i];
      if (call === undefined) {
        call = { id: '', name: '', args: '' };
        calls[i] = call;
      }
      if (typeof tc.id === 'string' && tc.id !== '') call.id = tc.id;
      if (typeof tc.function?.name === 'string' && tc.function.name !== '') {
        call.name += tc.function.name;
        emitter.push('tool_args', `${i > 0 || content !== '' ? '\n' : ''}${tc.function.name} `);
      }
      if (typeof tc.function?.arguments === 'string' && tc.function.arguments !== '') {
        call.args += tc.function.arguments;
        emitter.push('tool_args', tc.function.arguments);
      }
    }
  };
  try {
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, nl).trim();
        pending = pending.slice(nl + 1);
        if (line.startsWith('data:')) handle(line.slice(5).trim());
      }
    }
    if (pending.trim().startsWith('data:')) handle(pending.trim().slice(5).trim());
  } finally {
    emitter.flush(true);
  }
  if (usage === null) {
    // No usage in the stream: an estimate (four characters a token).
    const sent = JSON.stringify(body['messages'] ?? '').length + JSON.stringify(body['tools'] ?? '').length;
    usage = { prompt_tokens: Math.ceil(sent / 4), completion_tokens: Math.ceil((content.length + reasoning.length + calls.reduce((a, c) => a + c.args.length, 0)) / 4), estimated: true };
  }
  const toolCalls = calls.filter((c) => c !== undefined).map((c, i) => ({ id: c.id === '' ? `call_s${streamSeq}_${i}` : c.id, type: 'function', function: { name: c.name, arguments: c.args === '' ? '{}' : c.args } }));
  return {
    model,
    usage,
    choices: [{ finish_reason: finish, message: { role: 'assistant', content: content === '' && toolCalls.length > 0 ? null : content, ...(reasoning === '' ? {} : { reasoning_content: reasoning }), ...(toolCalls.length === 0 ? {} : { tool_calls: toolCalls }) } }],
  };
}

// ---------------------------------------------------------------------------------------------
// Pictures per request: some models take only a few (Super-VL: 1, counting the whole history)
// ---------------------------------------------------------------------------------------------

/** Most pictures one request may carry, per model (measured); learnt from a 400 when not listed. */
export const IMAGE_CAPS = new Map<string, number>([
  ['nvidia/NVIDIA-Nemotron-3.5-Super-VL', 1],
  ['nvidia/Nemotron-3-Nano-Omni-Reasoning-30B-A3B', 8],
]);

/**
 * The messages with only the newest `cap` pictures kept; older ones become a short text note. Pure:
 * the same messages give the same result, so the prefix only changes when a new picture arrives.
 */
export function capImages(messages: readonly any[], cap: number): any[] {
  let kept = 0;
  const out = [...messages];
  for (let m = out.length - 1; m >= 0; m--) {
    const msg = out[m];
    if (!Array.isArray(msg?.content)) continue;
    let changed = false;
    const parts = [...msg.content];
    for (let p = parts.length - 1; p >= 0; p--) {
      if (parts[p]?.type !== 'image_url') continue;
      if (kept < cap) kept += 1;
      else {
        parts[p] = { type: 'text', text: '[an older picture was removed: this model takes only the most recent picture]' };
        changed = true;
      }
    }
    if (changed) out[m] = { ...msg, content: parts };
  }
  return out;
}

function imageCapFromError(message: string): number | null {
  const m = /At most (\d+) image/i.exec(message);
  return m === null ? null : Number(m[1]);
}

// ---------------------------------------------------------------------------------------------
// Reasoning switches per model family
// ---------------------------------------------------------------------------------------------

/** `low` / `high` / a number; null for the model default. Turns into request fields per model. */
export function reasoningFields(model: string, effort: string | null): Record<string, unknown> {
  const m = model.toLowerCase();
  if (m.includes('nemotron')) {
    // The Nemotron cards: thinking via enable_thinking, force_nonempty_content for agents,
    // sampling temperature 1.0, top_p 0.95. `off` turns thinking off; `low` asks for low effort.
    const thinking = effort !== 'off' && effort !== '0';
    return {
      temperature: 1.0,
      top_p: 0.95,
      chat_template_kwargs: { enable_thinking: thinking, force_nonempty_content: true, ...(effort === 'low' ? { low_effort: true } : {}) },
    };
  }
  if (m.includes('deepseek-v4.1')) {
    // Numeric effort 1..100; "off" turns thinking off.
    if (effort === null) return {};
    if (effort === 'off' || effort === '0') return { chat_template_kwargs: { thinking: false } };
    const n = Number(effort);
    const value = Number.isFinite(n) ? Math.max(1, Math.min(100, Math.round(n))) : effort === 'low' ? 15 : effort === 'high' ? 60 : 30;
    return { chat_template_kwargs: { thinking: true, reasoning_effort: value } };
  }
  if (m.includes('deepseek')) {
    if (effort === null || effort === 'off') return {};
    return { chat_template_kwargs: { thinking: true }, ...(effort === 'on' ? {} : { reasoning_effort: effort }) };
  }
  if (m.includes('glm')) {
    if (effort === null) return {};
    return { reasoning_effort: effort };
  }
  return {};
}

// ---------------------------------------------------------------------------------------------
// Text roles: JSON out
// ---------------------------------------------------------------------------------------------

/** The first JSON object in a model's text (fences and prose around it are ignored). */
export function extractJSON(text: string): unknown {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidates = [fence?.[1], text];
  for (const c of candidates) {
    if (c === undefined) continue;
    const s = c.trim();
    try {
      return JSON.parse(s);
    } catch {
      // Find the first balanced {...}.
      const start = s.indexOf('{');
      if (start < 0) continue;
      let depth = 0;
      let inStr = false;
      let esc = false;
      for (let i = start; i < s.length; i++) {
        const ch = s[i];
        if (inStr) {
          if (esc) esc = false;
          else if (ch === '\\') esc = true;
          else if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') inStr = true;
        else if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            try {
              return JSON.parse(s.slice(start, i + 1));
            } catch {
              break;
            }
          }
        }
      }
    }
  }
  throw new Error(`no JSON object in the reply: ${text.slice(0, 200)}`);
}

export interface ChatJSONOptions<T> {
  readonly model: string;
  readonly system: string;
  readonly user: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly reasoning?: string | null;
  readonly validate?: (value: unknown) => T;
  /** Tries when the reply is not valid JSON; default 2. */
  readonly attempts?: number;
  /** The role whose tokens are streamed to the studio; none: not streamed. */
  readonly role?: Role;
  /** PNG pictures (base64) given with the user message, for a multimodal model. */
  readonly images?: readonly string[];
}

export interface ChatJSONResult<T> {
  readonly value: T;
  readonly text: string;
  readonly usage: { in: number; out: number; cached: number };
  readonly ms: number;
}

/** A text request whose answer is one JSON object. */
export async function chatJSON<T = unknown>(o: ChatJSONOptions<T>): Promise<ChatJSONResult<T>> {
  const attempts = o.attempts ?? 2;
  let lastError: unknown;
  let ms = 0;
  for (let i = 0; i < attempts; i++) {
    const { reply, ms: took } = await crusoeChat({
      model: o.model,
      messages: [
        { role: 'system', content: o.system },
        {
          role: 'user',
          content: ((text: string) =>
            (o.images ?? []).length === 0
              ? text
              : [{ type: 'text', text }, ...(o.images ?? []).map((data) => ({ type: 'image_url', image_url: { url: `data:image/png;base64,${data}` } }))])(
            i === 0 ? o.user : `${o.user}\n\n(Your previous answer was not a valid JSON object. Answer with the JSON object only.)`,
          ),
        },
      ],
      max_tokens: o.maxTokens ?? 8000,
      temperature: o.temperature ?? 0.6,
      ...reasoningFields(o.model, o.reasoning ?? null),
    }, o.role === undefined ? {} : { stream: { role: o.role } });
    ms += took;
    const u = openaiUsage(reply.usage);
    const usage = { in: u.input_tokens + u.cache_read_input_tokens, out: u.output_tokens, cached: u.cache_read_input_tokens };
    tally(o.model, usage);
    const text: string = reply.choices?.[0]?.message?.content ?? '';
    try {
      const raw = extractJSON(text);
      const value = o.validate === undefined ? (raw as T) : o.validate(raw);
      return { value, text, usage, ms };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

// ---------------------------------------------------------------------------------------------
// The loader's provider
// ---------------------------------------------------------------------------------------------

export interface LoaderProviderOptions {
  readonly model: string;
  readonly reasoningEffort: string | null;
  readonly maxTokens?: number;
  readonly temperature?: number;
  /** Streams the turn's tokens to the studio under this episode. */
  readonly episodeKey?: string;
}

/**
 * A bench `ModelProvider` for a Crusoe model over chat completions. It builds the messages with
 * bench's `openaiMessages` (pictures in a user message after the tool messages of their round)
 * and adds what bench's provider cannot send: Crusoe's reasoning switches (`chat_template_kwargs`,
 * numeric effort) and the shared rate limiter.
 */
export function loaderProvider(o: LoaderProviderOptions): ModelProvider {
  const maxTokens = o.maxTokens ?? 16_000;
  let requests = 0;
  const argumentsOf = (text: string): unknown => {
    try {
      return text.trim() === '' ? {} : (JSON.parse(text) as unknown);
    } catch {
      return text;
    }
  };
  return {
    name: 'crusoe',
    model: o.model,
    settings: (): JsonValue => ({
      api: 'chat.completions',
      endpoint: 'crusoe',
      max_tokens: maxTokens,
      reasoning_effort: o.reasoningEffort,
      requests,
    }),
    async complete(request: TurnRequest): Promise<ModelTurn> {
      requests += 1;
      const { reply } = await crusoeChat({
        model: o.model,
        messages: openaiMessages(request.system, request.history),
        tools: request.tools.map((tool) => ({
          type: 'function',
          function: { name: tool.name, description: tool.description, parameters: tool.input_schema },
        })),
        max_tokens: maxTokens,
        ...(o.temperature === undefined ? {} : { temperature: o.temperature }),
        ...reasoningFields(o.model, o.reasoningEffort),
      }, { stream: { role: 'loader', ...(o.episodeKey === undefined ? {} : { episodeKey: o.episodeKey }) } });
      const choice = reply.choices?.[0];
      const message = choice?.message;
      if (choice === undefined || message === undefined) throw new ProviderError('api', 'the reply has no choice');
      const usage = openaiUsage(reply.usage);
      tally(o.model, { in: usage.input_tokens + usage.cache_read_input_tokens, out: usage.output_tokens, cached: usage.cache_read_input_tokens });
      const toolCalls: OpenAiToolCall[] = (message.tool_calls ?? []).map((c: OpenAiToolCall, i: number) => ({
        id: c.id && c.id !== '' ? c.id : `call_${requests}_${i}`,
        type: 'function',
        function: { name: c.function?.name ?? '', arguments: c.function?.arguments ?? '{}' },
      }));
      const calls = toolCalls.map((call) => ({ id: call.id, name: call.function.name, arguments: argumentsOf(call.function.arguments) }));
      const reason: string | null = choice.finish_reason ?? null;
      let stop: TurnStop;
      if (calls.length > 0) stop = 'tool_use';
      else if (reason === 'length') stop = 'max_tokens';
      else if (reason === 'content_filter') stop = 'refusal';
      else stop = 'end_turn';
      const content: string = typeof message.content === 'string' ? message.content : '';
      return {
        text: content,
        tool_calls: calls,
        stop,
        usage,
        model: reply.model ?? o.model,
        native: {
          role: 'assistant',
          content: content === '' && toolCalls.length > 0 ? null : content,
          ...(toolCalls.length === 0 ? {} : { tool_calls: toolCalls }),
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// A fake endpoint (CREW_FAKE=1) for dry runs of the control flow: no network, no spend.
// ---------------------------------------------------------------------------------------------

let fakeN = 0;
function fakeChat(body: { model: string; [k: string]: unknown }): Promise<{ reply: any; ms: number }> {
  fakeN += 1;
  const usage = { prompt_tokens: 100, completion_tokens: 20 };
  if (Array.isArray(body['tools'])) {
    return Promise.resolve({ ms: 1, reply: { model: body.model, usage, choices: [{ finish_reason: 'tool_calls', message: { content: 'fake loader: washing now', tool_calls: [{ id: `fake_${fakeN}`, type: 'function', function: { name: 'start_cycle', arguments: '{}' } }] } }] } });
  }
  const content = JSON.stringify({
    plan: 'fake plan: plates on edge in the lower rack, bowls mouth down upstairs',
    leave_out: [],
    worked: ['fake: something worked'],
    failed: ['fake: nothing was loaded'],
    lessons: [{ text: `Load something before starting the cycle (${fakeN % 3}).`, tags: ['general'], polarity: 'support' }],
    proposals: [
      { title: `fake rule ${fakeN}`, hypothesis: 'fake', edits: [{ op: 'add_rule', rule: { text: `Fake rule ${fakeN}`, tags: ['general'] } }] },
      { title: 'fake preflight', hypothesis: 'fake', edits: [{ op: 'set_team', key: 'preflightCheck', value: true }] },
    ],
  });
  return Promise.resolve({ ms: 1, reply: { model: body.model, usage, choices: [{ finish_reason: 'stop', message: { content } }] } });
}
