/** The Critic: one episode's outcome -> a Critique (worked, failed, lessons). */

import type { Critique, EpisodeSummary, Genome } from '../contracts.ts';
import type { EventBus } from '../bus.ts';
import { chatJSON, modelFor } from '../crusoe.ts';

export function outcomeTable(s: EpisodeSummary): string {
  return s.items
    .map((i) =>
      i.loaded
        ? `${i.itemId} ${i.kind} [${i.soils.join(',') || 'clean'}] ${i.points}pts: ${i.rack ?? '?'} ${i.stance ?? '?'} -> ${i.clean ? 'CLEAN' : `DIRTY${i.residueRegions.length > 0 ? ` residue on ${i.residueRegions.join('+')}` : ''}`}${i.holdsWater ? ` holds ${i.retainedWaterMl.toFixed(0)}ml water` : ''}${i.movedDuringWash ? ' moved during wash' : ''}`
        : `${i.itemId} ${i.kind} [${i.soils.join(',') || 'clean'}] ${i.points}pts: LEFT OUT`,
    )
    .join('\n');
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String).filter((s) => s.trim() !== '').slice(0, 8) : [];
}

export async function critique(o: { summary: EpisodeSummary; genome: Genome; bus: EventBus | null }): Promise<Critique | null> {
  const { summary: s, bus } = o;
  bus?.emit({ type: 'agent_status', role: 'critic', status: 'thinking', label: `reviewing ${s.taskId}`, episodeKey: s.episodeKey });
  try {
    const user = [
      `Episode ${s.taskId}: ${s.points}/${s.pointsAvailable} points (${(s.share * 100).toFixed(0)}%), ${s.itemsClean} clean of ${s.itemsLoaded} loaded, ${s.itemsOffered} offered. Stopped: ${s.stopped}. Turns ${s.turns}, actions ${s.actions}, rejected calls ${s.rejectedCalls}.`,
      `Items (rack, stance, outcome):\n${outcomeTable(s)}`,
      s.plan !== null ? `Plan:\n${s.plan}` : 'No plan was used.',
      o.genome.playbook.length > 0 ? `Playbook:\n${o.genome.playbook.map((r) => `- [${r.id}] ${r.text}`).join('\n')}` : 'Playbook: empty.',
      s.loaderNotes.length > 0 ? `Last words of the loader:\n${s.loaderNotes.join('\n---\n').slice(0, 1500)}` : '',
      'Give at most 5 lessons, each specific (kind / soil / rack / stance), and tag them with the catalogue kinds, soil ids, racks or stances they are about (lowercase), or "general".',
    ]
      .filter((x) => x !== '')
      .join('\n\n');
    const r = await chatJSON<Critique>({
      model: modelFor('critic'),
      system: o.genome.prompts.critic,
      user,
      maxTokens: 12000,
      reasoning: process.env['CREW_CRITIC_REASONING'] ?? null,
      validate: (v) => {
        const x = v as { worked?: unknown; failed?: unknown; lessons?: unknown };
        const lessons = (Array.isArray(x.lessons) ? x.lessons : [])
          .map((l: any) => ({
            text: String(l?.text ?? '').trim(),
            tags: Array.isArray(l?.tags) ? l.tags.map((t: unknown) => String(t).toLowerCase()) : ['general'],
            polarity: l?.polarity === 'contradict' ? ('contradict' as const) : ('support' as const),
          }))
          .filter((l) => l.text !== '')
          .slice(0, 6);
        return { episodeKey: s.episodeKey, worked: strings(x.worked), failed: strings(x.failed), lessons };
      },
    });
    bus?.emit({ type: 'message', from: 'critic', to: 'librarian', kind: 'critique', title: `Review of ${s.taskId} (${(s.share * 100).toFixed(0)}%)`, body: [`Worked: ${r.value.worked.join(' | ')}`, `Failed: ${r.value.failed.join(' | ')}`, ...r.value.lessons.map((l) => `Lesson (${l.polarity}): ${l.text} [${l.tags.join(', ')}]`)].join('\n') });
    bus?.emit({ type: 'agent_status', role: 'critic', status: 'done', label: `${r.value.lessons.length} lessons (${r.ms} ms)`, episodeKey: s.episodeKey });
    return r.value;
  } catch (error) {
    bus?.emit({ type: 'agent_status', role: 'critic', status: 'error', label: String(error).slice(0, 120), episodeKey: s.episodeKey });
    return null;
  }
}
