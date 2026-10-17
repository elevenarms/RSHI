/** The Planner: level card (+ brief) -> a loading plan for the Loader. */

import type { Level } from '@spotless/levels';
import type { Genome } from '../contracts.ts';
import type { EventBus } from '../bus.ts';
import { chatJSON, modelFor } from '../crusoe.ts';

/** The items of a level as the planner reads them (what a player is shown on the card). */
export function cardText(level: Level): string {
  return level.items
    .map((i) => `${i.id} (${i.itemType}, ${i.points} pts): ${i.soils.map((s) => `${s.type} on ${s.regions.map((r) => r.region).join('+')}${s.description === undefined ? '' : ` "${s.description}"`}`).join('; ') || 'clean'}`)
    .join('\n');
}

export async function makePlan(o: { genome: Genome; level: Level; brief: string | null; bus: EventBus | null; episodeKey: string }): Promise<string | null> {
  const { bus } = o;
  bus?.emit({ type: 'agent_status', role: 'planner', status: 'thinking', label: `planning ${o.level.title}`, episodeKey: o.episodeKey });
  try {
    const user = [
      `Level: ${o.level.title} (${o.level.items.length} items). Machine: Bosch SMV4HAX40G, programme ${o.level.programmeId}.`,
      `Items:\n${cardText(o.level)}`,
      o.genome.playbook.length > 0 ? `Playbook:\n${o.genome.playbook.map((r) => `- ${r.text}`).join('\n')}` : '',
      o.brief !== null && o.brief !== '' ? `Brief from memory:\n${o.brief}` : '',
    ]
      .filter((s) => s !== '')
      .join('\n\n');
    const r = await chatJSON<{ plan: string; leave_out?: string[] }>({
      model: modelFor('planner'),
      system: o.genome.prompts.planner,
      user,
      maxTokens: 6000,
      reasoning: 'low',
      validate: (v) => {
        const x = v as { plan?: unknown; leave_out?: unknown };
        if (typeof x.plan !== 'string' || x.plan.trim() === '') throw new Error('no plan');
        return { plan: x.plan, leave_out: Array.isArray(x.leave_out) ? x.leave_out.map(String) : [] };
      },
    });
    const plan = `${r.value.plan.trim()}${(r.value.leave_out ?? []).length > 0 ? `\nLeave out: ${(r.value.leave_out ?? []).join(', ')}` : ''}`;
    bus?.emit({ type: 'message', from: 'planner', to: 'loader', kind: 'plan', title: `Plan for ${o.level.title}`, body: plan });
    bus?.emit({ type: 'agent_status', role: 'planner', status: 'done', label: `plan ready (${r.ms} ms)`, episodeKey: o.episodeKey });
    return plan;
  } catch (error) {
    bus?.emit({ type: 'agent_status', role: 'planner', status: 'error', label: String(error).slice(0, 120), episodeKey: o.episodeKey });
    return null;
  }
}
