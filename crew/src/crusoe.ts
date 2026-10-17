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

export const CRUSOE_BASE_URL = process.env['CRUSOE_BASE_URL'] ?? 'https://api.inference.crusoecloud.com/v1';

/** Default models per role (overridable by CREW_MODEL_<ROLE>). */
export const DEFAULT_MODELS = {
  loader: 'deepseek-ai/DeepSeek-V4.1-Flash',
  planner: 'zai-org/GLM-5.3-Flash',
  critic: 'deepseek-ai/DeepSeek-V4-Pro',
  coach: 'zai-org/GLM-5.3',
} as const;

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
export async function crusoeChat(body: { model: string; [k: string]: unknown }, options: { timeoutMs?: number; maxRetries?: number } = {}): Promise<{ reply: any; ms: number }> {
  if (process.env['CREW_FAKE'] === '1') return fakeChat(body);
  const key = apiKey();
  const maxRetries = options.maxRetries ?? 6;
  const timeoutMs = options.timeoutMs ?? 5 * 60_000;
  const clean = (s: string): string => s.split(key).join('[key]');
  for (let attempt = 0; ; attempt++) {
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
        const ra = response.headers.get('retry-after');
        if (ra !== null && Number.isFinite(Number(ra))) wait = Number(ra) * 1000;
      }
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
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
// Reasoning switches per model family
// ---------------------------------------------------------------------------------------------

/** `low` / `high` / a number; null for the model default. Turns into request fields per model. */
export function reasoningFields(model: string, effort: string | null): Record<string, unknown> {
  const m = model.toLowerCase();
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
          content:
            i === 0 ? o.user : `${o.user}\n\n(Your previous answer was not a valid JSON object. Answer with the JSON object only.)`,
        },
      ],
      max_tokens: o.maxTokens ?? 8000,
      temperature: o.temperature ?? 0.6,
      ...reasoningFields(o.model, o.reasoning ?? null),
    });
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
      });
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
