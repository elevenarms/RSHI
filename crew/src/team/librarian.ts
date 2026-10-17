/**
 * The Librarian: the deterministic memory counts and merges; a small model (Nemotron Nano) condenses
 * memory.briefFor(...) and the placement statistics of the level's kinds into a crisp brief, and
 * phrases the statistics as lessons. On failure the memory's own brief is used.
 */

import type { CrewMemoryApi, Role } from '../contracts.ts';
import type { EventBus } from '../bus.ts';
import { chatJSON, modelFor } from '../crusoe.ts';

export const LIBRARIAN_SYSTEM = `You are the Librarian of a team that loads a simulated dishwasher (Spotless; an item scores only if it comes out clean).
You get what the team's memory holds for one level: lessons with confidence, and placement statistics (kind, rack, stance: clean/n).
Write a crisp brief for the player of this level: at most 8 bullet points, most useful first, each concrete (kind, rack, stance) and true to the evidence.
Phrase strong statistics as lessons ("cereal bowls mouth_down in upper_rack: 5/5 clean"). Do not invent facts that are not in the memory.
Answer with a JSON object: {"brief": "- ...\\n- ...", "stat_lessons": ["..."]}`;

export async function librarianBrief(o: { memory: CrewMemoryApi; card: { kinds: string[]; soils: string[] }; maxLessons: number; bus: EventBus | null; to: Role; title: string; episodeKey?: string }): Promise<string | null> {
  const raw = o.memory.briefFor(o.card, o.maxLessons);
  if (raw.trim() === '') return null;
  const kinds = new Set(o.card.kinds);
  const stats = o.memory
    .placementStats()
    .filter((s) => kinds.has(s.kind) && s.n >= 2)
    .sort((a, b) => b.n - a.n)
    .slice(0, 30)
    .map((s) => `${s.kind} ${s.rack} ${s.stance}: ${s.clean}/${s.n}`)
    .join('\n');
  const { bus } = o;
  bus?.emit({ type: 'agent_status', role: 'librarian', status: 'thinking', label: `brief: ${o.title}`, ...(o.episodeKey === undefined ? {} : { episodeKey: o.episodeKey }) });
  let brief = raw;
  try {
    const r = await chatJSON<{ brief: string; stat_lessons: string[] }>({
      model: modelFor('librarian'),
      role: 'librarian',
      system: LIBRARIAN_SYSTEM,
      user: `Level kinds: ${o.card.kinds.join(', ')}\nSoils: ${o.card.soils.join(', ')}\n\nMemory brief:\n${raw}\n\nPlacement statistics:\n${stats || '(none)'}`,
      maxTokens: 6000,
      reasoning: process.env['CREW_LIBRARIAN_REASONING'] ?? 'off',
      validate: (v) => {
        const x = v as { brief?: unknown; stat_lessons?: unknown };
        if (typeof x.brief !== 'string' || x.brief.trim() === '') throw new Error('no brief');
        return { brief: x.brief.trim(), stat_lessons: Array.isArray(x.stat_lessons) ? x.stat_lessons.map(String) : [] };
      },
    });
    brief = r.value.brief;
    bus?.emit({ type: 'agent_status', role: 'librarian', status: 'done', label: `brief ready (${r.ms} ms)`, ...(o.episodeKey === undefined ? {} : { episodeKey: o.episodeKey }) });
  } catch (error) {
    bus?.emit({ type: 'agent_status', role: 'librarian', status: 'error', label: `using memory's brief: ${String(error).slice(0, 100)}` });
  }
  bus?.emit({ type: 'message', from: 'librarian', to: o.to, kind: 'brief', title: o.title, body: brief });
  return brief;
}
