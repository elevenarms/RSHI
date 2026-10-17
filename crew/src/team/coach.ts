/** The Coach: incumbent + recent results + memory + past decisions -> 1..3 Proposals of typed edits. */

import type { Decision, EpisodeSummary, Genome, GenomeEdit, Lesson, PlacementStat, Proposal } from '../contracts.ts';
import type { EventBus } from '../bus.ts';
import { chatJSON, modelFor } from '../crusoe.ts';

export const COACH_SYSTEM = `You are the Coach of an agent team that plays Spotless, a physically simulated dishwasher-loading game (Bosch machine, one wash; an item scores its points only if it comes out clean).
Team roles: Planner (optional, writes a loading plan), Loader (an LLM that places items through tools), Critic, Librarian (memory brief), you, and a Gatekeeper that keeps a change only if it measurably raises the score on fresh tasks.
You propose changes to the team's genome as typed edits. Allowed edits (JSON):
 {"op":"add_rule","rule":{"text":"...","tags":["..."],"evidence":["lesson ids"]}}
 {"op":"edit_rule","id":"R1.1","text":"..."}
 {"op":"remove_rule","id":"R1.1"}
 {"op":"set_prompt","prompt":"loaderPreamble"|"planner"|"critic","text":"..."}
 {"op":"set_team","key":"usePlanner"|"useMemoryBrief"|"preflightCheck","value":true|false}
 {"op":"set_team","key":"briefLessons","value":0..30}
 {"op":"set_loader","key":"reasoningEffort","value":"1".."100" (numeric string, thinking budget) or "off"}
 {"op":"set_loader","key":"images","value":true|false}
 {"op":"set_loader","key":"deniedTools","value":["preview",...]}
 {"op":"set_loader","key":"maxTurns","value":20..400}
The Loader is a deliberately small model: it plays the tools competently but misjudges what washes clean. The levers that are expected to help a weak loader are the team around it:
 - team structure: usePlanner (a strong model writes a per-item plan: rack, stance, what to leave out), useMemoryBrief (the Librarian's lessons and placement statistics from earlier episodes), preflightCheck (check_load must be read before the wash), briefLessons (how many lessons the brief carries);
 - playbook rules: short imperatives the loader always sees, grounded in evidence (kinds, soils, racks, stances, clean rates), e.g. "Bowls and mugs: upper_rack, mouth_down", "Leave out items you cannot place stably";
 - the loader preamble (its standing instructions), and loader settings (reasoningEffort, maxTurns, deniedTools) when the record shows a reason.
Change ONE coherent thing per proposal (one structural switch, or one small group of related rules, or one prompt rewrite), so the Gatekeeper can attribute a gain to it. Different proposals of one round should test different ideas. Do not repeat ideas the Gatekeeper already rejected; build on accepted ones.
Answer with a JSON object: {"proposals":[{"title":"short","hypothesis":"why it should raise the score","edits":[...]}]}`;

const OPS = new Set(['add_rule', 'edit_rule', 'remove_rule', 'set_prompt', 'set_team', 'set_loader']);

function brief(s: EpisodeSummary): string {
  const dirty = s.items.filter((i) => i.loaded && !i.clean).map((i) => `${i.kind}@${i.rack}/${i.stance}${i.residueRegions.length > 0 ? `(${i.residueRegions.join('+')})` : ''}`);
  const out = s.items.filter((i) => !i.loaded).map((i) => i.kind);
  return `${s.taskId} [${s.genomeId}]: ${(s.share * 100).toFixed(0)}% (${s.points}/${s.pointsAvailable}), ${s.itemsClean}/${s.itemsLoaded} clean, stopped ${s.stopped}, ${s.turns} turns. Dirty: ${dirty.join(', ') || 'none'}. Left out: ${out.join(', ') || 'none'}.`;
}

export async function propose(o: {
  incumbent: Genome;
  recent: readonly EpisodeSummary[];
  lessons: readonly Lesson[];
  stats: readonly PlacementStat[];
  decisions: readonly Decision[];
  count: number;
  bus: EventBus | null;
}): Promise<Proposal[]> {
  const { bus, incumbent: g } = o;
  bus?.emit({ type: 'agent_status', role: 'coach', status: 'thinking', label: `proposing ${o.count} change(s)` });
  const user = [
    `Incumbent genome ${g.id} (generation ${g.generation}):\nteam ${JSON.stringify(g.team)}\nloader ${JSON.stringify({ reasoningEffort: g.loader.reasoningEffort, images: g.loader.images, deniedTools: g.loader.deniedTools, maxTurns: g.loader.maxTurns })}\nloaderPreamble: ${g.prompts.loaderPreamble}\nplaybook:\n${g.playbook.map((r) => `- [${r.id}] ${r.text}`).join('\n') || '(empty)'}`,
    `Recent episodes:\n${o.recent.slice(-10).map(brief).join('\n')}`,
    `Lessons in memory (best first):\n${o.lessons.slice(0, 15).map((l) => `- [${l.id}] (conf ${l.confidence.toFixed(2)}, +${l.support}/-${l.contradict}) ${l.text}`).join('\n') || '(none yet)'}`,
    `Placement statistics (kind, rack, stance: clean/n):\n${[...o.stats].sort((a, b) => b.n - a.n).slice(0, 25).map((s) => `${s.kind} ${s.rack} ${s.stance}: ${s.clean}/${s.n}`).join('\n') || '(none)'}`,
    `Past decisions:\n${o.decisions.map((d) => (d.void === true ? `- "${d.proposalTitle}": VOID (not tested: infrastructure failures; may be proposed again)` : `- "${d.proposalTitle}": ${d.accepted ? 'ACCEPTED' : 'REJECTED'} (${d.delta >= 0 ? '+' : ''}${d.delta.toFixed(3)})`)).join('\n') || '(none)'}`,
    `Propose exactly ${o.count} different proposal(s), each with 1-4 edits.`,
  ].join('\n\n');
  try {
    const r = await chatJSON<Proposal[]>({
      model: modelFor('coach'),
      role: 'coach',
      system: COACH_SYSTEM,
      user,
      maxTokens: 16000,
      reasoning: process.env['CREW_COACH_REASONING'] ?? 'low',
      validate: (v) => {
        const raw = (v as { proposals?: unknown }).proposals;
        if (!Array.isArray(raw) || raw.length === 0) throw new Error('no proposals');
        return raw.slice(0, o.count).map((p: any, i: number) => {
          const edits = (Array.isArray(p?.edits) ? p.edits : []).filter((e: any) => e !== null && typeof e === 'object' && OPS.has(e.op)) as GenomeEdit[];
          if (edits.length === 0) throw new Error('a proposal without valid edits');
          return { id: `P${g.generation + 1}.${i + 1}`, title: String(p?.title ?? `proposal ${i + 1}`).slice(0, 100), hypothesis: String(p?.hypothesis ?? '').slice(0, 500), edits };
        });
      },
    });
    for (const p of r.value) bus?.emit({ type: 'message', from: 'coach', to: 'gatekeeper', kind: 'proposal', title: p.title, body: `${p.hypothesis}\n${p.edits.map((e) => JSON.stringify(e)).join('\n')}` });
    bus?.emit({ type: 'agent_status', role: 'coach', status: 'done', label: `${r.value.length} proposal(s) (${r.ms} ms)` });
    return r.value;
  } catch (error) {
    bus?.emit({ type: 'agent_status', role: 'coach', status: 'error', label: String(error).slice(0, 120) });
    bus?.log(`coach failed: ${String(error)}`, 'warn');
    return fallbackProposals(g, o.count);
  }
}

/** When the Coach cannot answer: the structural toggles not tried yet. */
export function fallbackProposals(g: Genome, count: number): Proposal[] {
  const out: Proposal[] = [];
  if (!g.team.useMemoryBrief) out.push({ id: 'PF.1', title: 'Use the memory brief', hypothesis: 'Lessons from memory help the loader.', edits: [{ op: 'set_team', key: 'useMemoryBrief', value: true }] });
  if (!g.team.preflightCheck) out.push({ id: 'PF.2', title: 'Preflight check', hypothesis: 'Checking the load before washing avoids blocked arms.', edits: [{ op: 'set_team', key: 'preflightCheck', value: true }] });
  if (!g.team.usePlanner) out.push({ id: 'PF.3', title: 'Use the planner', hypothesis: 'A plan helps.', edits: [{ op: 'set_team', key: 'usePlanner', value: true }] });
  return out.slice(0, count);
}
