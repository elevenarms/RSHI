/**
 * Where the crew finds things in the RSHI layout (every path can be overridden from the
 * environment):
 *
 *   <RSHI root>/                     RSHI_ROOT
 *     .env                           loaded first (then the submodule's .env, if any)
 *     .crew/                         CREW_DIR: memory, runs, event logs, game data
 *     crew/  studio/dist/            CREW_STUDIO_DIST: the studio the crew server serves
 *     upstream/DishwasherBench/      RSHI_UPSTREAM: DishwasherBench (git submodule, branch rshi);
 *                                    its apps/web/dist is the watch page served by the game server
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from '@spotless/bench';

const env = (name: string): string | undefined => {
  const v = process.env[name];
  return v === undefined || v === '' ? undefined : v;
};

/** The RSHI repository root (two directories above this file: crew/src → crew → root). */
export const RSHI_ROOT = resolve(env('RSHI_ROOT') ?? fileURLToPath(new URL('../../', import.meta.url)));
/** The DishwasherBench checkout (the submodule). */
export const UPSTREAM_ROOT = resolve(env('RSHI_UPSTREAM') ?? join(RSHI_ROOT, 'upstream', 'DishwasherBench'));
/** The crew's data directory (memory, runs, game data). */
export const CREW_ROOT = resolve(env('CREW_DIR') ?? join(RSHI_ROOT, '.crew'));
/** The built studio, served by `crew serve` / `crew evolve`. */
export const STUDIO_DIST = resolve(env('CREW_STUDIO_DIST') ?? join(RSHI_ROOT, 'studio', 'dist'));
/** Environment files, first wins (a variable already set in the environment wins over both). */
export const ENV_FILES: readonly string[] = [join(RSHI_ROOT, '.env'), join(UPSTREAM_ROOT, '.env')];

/** Loads the RSHI root `.env`, then the submodule's; returns the names set (never the values). */
export function loadCrewEnv(): string[] {
  return ENV_FILES.filter((f) => existsSync(f)).flatMap((f) => loadEnvFile(f));
}
