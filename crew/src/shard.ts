/**
 * One game server shard as a process of its own (used when CREW_SHARD_GPU_ENV pins each shard's
 * wash workers to a GPU: the server forks its wash workers with this process's environment).
 *
 *   tsx src/shard.ts <levels.json> <dataDir> <tier> <adminToken>
 *
 * Prints one line `SHARD {"url": ...}` when listening; exits when its parent's stdin closes.
 */

import { readFileSync } from 'node:fs';
import { startGame } from '@spotless/bench';
import type { Level } from '@spotless/levels';
import { DEFAULT_STATIC_DIR } from '@spotless/server';
import type { WashTier } from '@spotless/session';

const [levelsFile, dataDir, tier, adminToken] = process.argv.slice(2) as [string, string, string, string];
const levels = JSON.parse(readFileSync(levelsFile, 'utf8')) as Level[];
const game = await startGame({ dataDir, washTier: tier as WashTier, render: true, levels, server: { staticDir: DEFAULT_STATIC_DIR, adminToken } });
console.log(`SHARD ${JSON.stringify({ url: game.url })}`);
process.stdin.resume();
process.stdin.on('end', () => {
  void game.close().finally(() => process.exit(0));
});
