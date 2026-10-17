import type { Moment, World } from './mock';

/** What the director wants in the spotlight. */
export type Spot = 'live' | 'critic' | 'memory' | 'evo' | 'exam' | 'team';

export function spotFor(m: Moment): Spot | null {
  switch (m.kind) {
    case 'episode':
      return 'live';
    case 'critique':
      return 'critic';
    case 'memory':
      return 'memory';
    case 'proposal':
    case 'evaluate':
    case 'verdict':
      return 'evo';
    case 'exam':
      return 'exam';
    default:
      return null;
  }
}

export interface Ctx {
  /** Present mode on (the director drives the spotlight). */
  readonly present: boolean;
  /** The current spotlight (null when present mode is off). */
  readonly spot: Spot | null;
  /** True on the frame the spotlight changed. */
  readonly spotChanged: boolean;
}

export interface View {
  readonly id: string;
  readonly name: string;
  mount(stage: HTMLElement): void;
  update(w: World, ctx: Ctx): void;
  destroy(): void;
}
