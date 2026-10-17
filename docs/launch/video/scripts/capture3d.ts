/**
 * 3D shots for the launch video, captured from DishwasherBench's own three.js web client
 * (apps/web) driven by headless Chrome. Parametric: a shot list (JSON) in, one MP4 per shot out.
 *
 *   tsx scripts/capture3d.ts <shots.json> [--only id,id] [--out captures] [--server http://127.0.0.1:8899]
 *                            [--no-build] [--keep-frames]
 *
 * Without --server it builds the web client (`pnpm --filter @spotless/web build`, skipped with
 * --no-build) and starts its OWN game server (scripts/game-server.ts: port 8899, data
 * .scratch/video-game, open mode, the course levels plus the crew's drill levels), and stops it
 * at the end. Chrome comes from SPOTLESS_CHROME or /Applications/Google Chrome.app (the
 * resolver of @spotless/render).
 *
 * Shot fields (all optional except id and view):
 *   id            output name: <out>/<id>.mp4 (and <id>.png, the last frame)
 *   view          "watch" (fixed camera on the machine) | "turntable" (one item on a plinth)
 *   size          [w, h], default [1920, 1080]
 *   fps           default 30 (the shot-list file may set a default)
 *   seconds       length of a watch shot
 *   mode          "step" (default): deterministic virtual time; the page's clock and
 *                 requestAnimationFrame are replaced, every frame advances exactly 1/fps, so
 *                 motion is perfectly smooth whatever the capture speed. "realtime": wall-clock
 *                 frames grabbed as fast as possible and resampled to fps (use for the wash,
 *                 whose progress comes from the server's clock).
 *   level         level id of a fresh session, or
 *   episode       an episode of the evolve run (<run>/episodes/<name>/record.json): its level,
 *                 and its accepted actions to replay
 *   replay        how many of the episode's accepted actions to replay before capturing:
 *                 "all" | number (default 0); start_cycle is never replayed
 *   setup         extra actions before capturing: [{ "action": "place"|"remove"|"set_rack", "args": {...} }]
 *   wash          true: run a fast-tier wash after setup and wait for the report before capturing
 *                 (turntables then show clean / residue tints; watch shows the washed load)
 *   during        timed actions while capturing: [{ "at": seconds, "action": ..., "args": {...} }];
 *                 "action": "start_cycle" starts a fast wash.
 *   replay_during { "from": k, "count": n, "every": seconds, "start": seconds }: replay the
 *                 episode's accepted actions k..k+n-1 during the shot, one every `every` s of
 *                 shot time (drops play at real speed: a sped-up loading sequence)
 *   camera        watch only: { "az": [from, to] degrees about the default view (+ = to the
 *                 right), "el": [from, to] degrees of elevation (default view 28.6),
 *                 "zoom": [from, to] distance factor (1 = the client's own fit, <1 = closer),
 *                 "pan": [right, up] metres, a constant shift of the view in the image plane },
 *                 eased in-out over the shot
 *   items         turntable only: [{ "id": item id, "seconds": s }]
 *   zoom          turntable only: camera distance factor (>1 = further; for tall items)
 *   water         "demo": the cosmetic water plays without a wash (watch, step mode)
 *   until_done    realtime watch with a wash: stop when the report is in (max `seconds`)
 *   hud           false (default) hides the page's small display
 *   warmup        seconds of page time (run at wall-clock speed, not captured) after the
 *                 actions at t <= 0, before the first frame: e.g. let a wash get going
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO = resolve(HERE, '..');
const ROOT = resolve(VIDEO, '../../../..');
const RUN = join(ROOT, 'packages/crew/runs/2026-10-17T20-49-49-evolve');
const { launchChrome, sleep } = (await import(join(ROOT, 'apps/web/scripts/driver.ts'))) as {
  launchChrome: () => Promise<Browser>;
  sleep: (ms: number) => Promise<void>;
};

// Minimal structural types for the parts of puppeteer used here.
interface Page {
  setViewport(v: { width: number; height: number; deviceScaleFactor: number }): Promise<void>;
  goto(url: string, o?: unknown): Promise<unknown>;
  evaluate<T>(fn: string | ((...a: never[]) => T), ...args: unknown[]): Promise<T>;
  evaluateOnNewDocument(fn: string): Promise<unknown>;
  screenshot(o: { path?: string; type?: 'png' | 'jpeg'; quality?: number; optimizeForSpeed?: boolean }): Promise<Uint8Array>;
  addStyleTag(o: { content: string }): Promise<unknown>;
  on(event: string, cb: (m: { type(): string; text(): string }) => void): void;
  close(): Promise<void>;
}
interface Browser {
  newPage(): Promise<Page>;
  close(): Promise<void>;
}

type Action = { action: string; args?: Record<string, unknown>; at?: number };
interface Shot {
  id: string;
  view: 'watch' | 'turntable';
  size?: [number, number];
  fps?: number;
  seconds?: number;
  mode?: 'step' | 'realtime';
  level?: string;
  episode?: string;
  replay?: 'all' | number;
  setup?: Action[];
  wash?: boolean;
  during?: Action[];
  replay_during?: { from: number; count: number; every: number; start?: number };
  camera?: { az?: [number, number]; el?: [number, number]; zoom?: [number, number]; pan?: [number, number] };
  items?: { id: string; seconds: number }[];
  zoom?: number;
  water?: 'demo';
  until_done?: boolean;
  hud?: boolean;
  warmup?: number;
}
interface ShotList {
  fps?: number;
  shots: Shot[];
}

// ---------------------------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : undefined;
};
const listFile = argv.find((a) => a.endsWith('.json'));
if (listFile === undefined) {
  console.error('usage: tsx scripts/capture3d.ts <shots.json> [--only id,id] [--out dir] [--server url] [--no-build] [--keep-frames]');
  process.exit(2);
}
const list = JSON.parse(readFileSync(listFile, 'utf8')) as ShotList;
const only = flag('--only')?.split(',');
const outDir = resolve(VIDEO, flag('--out') ?? 'captures');
const keepFrames = argv.includes('--keep-frames');
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------------------------------------
// Game server
// ---------------------------------------------------------------------------------------------

let server = flag('--server');
let child: ChildProcess | null = null;
async function startServer(): Promise<string> {
  if (!argv.includes('--no-build')) {
    console.log('building the web client…');
    const built = spawnSync('pnpm', ['--filter', '@spotless/web', 'build'], { cwd: ROOT, stdio: 'inherit' });
    if (built.status !== 0) throw new Error('web build failed');
  }
  const tsx = join(ROOT, 'node_modules/.bin/tsx');
  child = spawn(tsx, [join(HERE, 'game-server.ts'), '--port', '8899', '--data', join(ROOT, '.scratch/video-game')], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return new Promise((resolveUrl, reject) => {
    let buf = '';
    child?.stdout?.on('data', (d: Buffer) => {
      buf += d.toString();
      const m = /READY (\S+)/.exec(buf);
      if (m !== null) resolveUrl(m[1] as string);
    });
    child?.once('exit', (code) => reject(new Error(`game server exited (${code}); is port 8899 free?`)));
  });
}

async function api(path: string, body?: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(`${server}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (response.status >= 400) throw new Error(`${path}: ${response.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

async function act(session: string, a: Action): Promise<boolean> {
  const path =
    a.action === 'start_cycle'
      ? `/api/sessions/${session}/start_cycle?wash_tier=fast`
      : `/api/sessions/${session}/${a.action}`;
  const result = await api(path, a.args ?? {});
  const ok = result['accepted'] !== false;
  if (!ok) console.log(`  ${a.action} ${JSON.stringify(a.args).slice(0, 80)} refused: ${String(result['reason'] ?? '')}`);
  return ok;
}

/** The accepted actions of an episode record (start_cycle left out). */
function episodeActions(name: string): { level: string; actions: Action[] } {
  const record = JSON.parse(readFileSync(join(RUN, 'episodes', name, 'record.json'), 'utf8')) as {
    level: { id: string };
    events: { kind: string; name: string; args: Record<string, unknown>; accepted: boolean }[];
  };
  return {
    level: record.level.id,
    actions: record.events
      .filter((e) => e.kind === 'action' && e.accepted && e.name !== 'start_cycle')
      .map((e) => ({ action: e.name, args: e.args })),
  };
}

async function waitWash(session: string, maxS = 300): Promise<void> {
  const t0 = Date.now();
  for (;;) {
    const summary = await api(`/api/sessions/${session}`);
    const job = summary['job'] as { status?: string } | null;
    const phase = String(summary['phase'] ?? '');
    if ((job?.status === 'done' || job?.status === 'failed') && phase !== 'washing') return;
    if (Date.now() - t0 > maxS * 1000) throw new Error('wash did not finish');
    await sleep(1000);
  }
}

/** Creates the session of a shot and brings it to the state the shot starts from. */
async function prepare(shot: Shot): Promise<{ session: string; pending: Action[] }> {
  let level = shot.level ?? 'tutorial';
  let actions: Action[] = [];
  if (shot.episode !== undefined) ({ level, actions } = episodeActions(shot.episode));
  const created = await api('/api/sessions', { level_id: level });
  const session = String(created['session_id']);
  const n = shot.replay === 'all' ? actions.length : (shot.replay ?? 0);
  let refused = 0;
  for (const a of actions.slice(0, n)) if (!(await act(session, a))) refused++;
  for (const a of shot.setup ?? []) if (!(await act(session, a))) refused++;
  if (n > 0 || shot.setup) console.log(`  session ${session} (${level}): ${n + (shot.setup?.length ?? 0)} actions, ${refused} refused`);
  if (shot.wash === true) {
    console.log('  washing (fast tier)…');
    await act(session, { action: 'start_cycle' });
    await waitWash(session);
    const report = await api(`/api/sessions/${session}/get_report`, {}).catch(() => ({}) as Record<string, unknown>);
    const score = (report['score'] ?? (report['report'] as Record<string, unknown> | undefined)?.['score']) as
      | { points?: number; points_available?: number }
      | undefined;
    console.log(`  washed: ${score?.points ?? '?'} / ${score?.points_available ?? '?'} points`);
  }
  let pending: Action[] = [];
  if (shot.replay_during !== undefined) {
    const r = shot.replay_during;
    pending = actions.slice(r.from, r.from + r.count).map((a, i) => ({ ...a, at: (r.start ?? 0.5) + i * r.every }));
  }
  return { session, pending: [...pending, ...(shot.during ?? [])].sort((a, b) => (a.at ?? 0) - (b.at ?? 0)) };
}

// ---------------------------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------------------------

/** Replaces the page's clock and frame callbacks with a virtual clock stepped by the script. */
const VIRTUAL_TIME = `
(() => {
  const vt = { now: 0, cbs: [] };
  window.__vt = vt;
  performance.now = () => vt.now;
  window.requestAnimationFrame = (cb) => { vt.cbs.push(cb); return vt.cbs.length; };
  window.cancelAnimationFrame = () => {};
  window.__step = (ms) => {
    vt.now += ms;
    const cbs = vt.cbs; vt.cbs = [];
    for (const cb of cbs) { try { cb(vt.now); } catch (e) { console.error(e && e.message); } }
  };
})();`;

/**
 * Orbits the watching camera: wraps the client's WatchCamera.update (display only) so that the
 * view direction follows window.__cam over the page clock. The client itself is unchanged.
 */
const ORBIT = `
(() => {
  const wc = window.spotless && window.spotless.watchCamera;
  if (!wc || !wc.toward) return false;
  if (wc.__orbit) return true;
  const update = wc.update.bind(wc);
  const AZ0 = -Math.PI / 2 + 0.3, EL0 = 0.5;
  wc.update = function (camera, target, aspect) {
    const p = window.__cam;
    let zoom = 1;
    if (p) {
      const u = Math.min(1, Math.max(0, (performance.now() - p.t0) / 1000 / p.dur));
      const e = 0.5 - 0.5 * Math.cos(Math.PI * u);
      const lerp = (r) => r[0] + (r[1] - r[0]) * e;
      const az = AZ0 + (p.az ? lerp(p.az) : 0) * Math.PI / 180;
      const el = p.el ? lerp(p.el) * Math.PI / 180 : EL0;
      zoom = p.zoom ? lerp(p.zoom) : 1;
      this.toward.set(Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el));
      const zUp = this.toward.clone().set(0, 0, 1);
      this.right.crossVectors(zUp, this.toward).normalize().negate();
      this.up.crossVectors(this.toward, this.right).normalize().negate();
    }
    update(camera, target, aspect);
    if (zoom !== 1) camera.position.sub(target).multiplyScalar(zoom).add(target);
    if (p && p.pan) {
      // Shift the view in the image plane: pan[0] along the camera's right, pan[1] along its up (metres).
      const r = this.right, u = this.up;
      const dx = p.pan[0], dy = p.pan[1];
      for (const v of [camera.position, target]) {
        v.x += r.x * dx + u.x * dy; v.y += r.y * dx + u.y * dy; v.z += r.z * dx + u.z * dy;
      }
    }
    camera.lookAt(target);
  };
  wc.__orbit = true;
  return true;
})()`;

const HIDE_HUD = `#watch-hud, .hud, #toast, .toast { display: none !important; }`;

async function openPage(browser: Browser, shot: Shot, session: string, step: boolean, hash: string): Promise<Page> {
  const [w, h] = shot.size ?? [1920, 1080];
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('  page:', m.text().slice(0, 200));
  });
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  if (step) await page.evaluateOnNewDocument(VIRTUAL_TIME);
  await page.goto(`${server}/#${session}&${hash}`);
  // Let the page load its geometry and scene: frames must be stepped in virtual time.
  const ready =
    shot.view === 'turntable'
      ? `!!document.querySelector('.tt-name')`
      : `!!(window.spotless && window.spotless.geometry && window.spotless.watchCamera && window.spotless.watchCamera.ready && window.spotless.debugState().pending === 0)`;
  const t0 = Date.now();
  for (;;) {
    if (step) await page.evaluate(`window.__step(${1000 / 30})`);
    if (await page.evaluate<boolean>(ready).catch(() => false)) break;
    if (Date.now() - t0 > 60_000) throw new Error(`page not ready: ${shot.id}`);
    await sleep(step ? 20 : 200);
  }
  // Settle: a second of page time.
  for (let i = 0; i < 30; i++) {
    if (step) await page.evaluate(`window.__step(${1000 / 30})`);
    else await sleep(33);
  }
  if (shot.hud !== true) await page.addStyleTag({ content: HIDE_HUD });
  return page;
}

function encode(framesDir: string, pattern: string, fps: number, out: string, list?: string): void {
  const args = list
    ? ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `fps=${fps},format=yuv420p`]
    : ['-y', '-v', 'error', '-framerate', String(fps), '-i', join(framesDir, pattern), '-vf', 'format=yuv420p'];
  const r = spawnSync('ffmpeg', [...args, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-movflags', '+faststart', out], {
    stdio: 'inherit',
  });
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${out}`);
}

// ---------------------------------------------------------------------------------------------
// Shots
// ---------------------------------------------------------------------------------------------

async function capture(browser: Browser, shot: Shot, defaultFps: number): Promise<void> {
  const fps = shot.fps ?? defaultFps;
  const step = (shot.mode ?? 'step') === 'step';
  console.log(`shot ${shot.id}: ${shot.view}, ${step ? 'step' : 'realtime'}, ${fps} fps`);
  const { session, pending } = await prepare(shot);
  const framesDir = join(outDir, `${shot.id}.frames`);
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  const firstHash = shot.view === 'turntable' ? `turntable&item=${shot.items?.[0]?.id ?? ''}` : 'watch';
  const page = await openPage(browser, shot, session, step, firstHash);
  const queue = [...pending];
  if (shot.warmup !== undefined) {
    while (queue.length > 0 && (queue[0]?.at ?? 0) <= 0) await act(session, queue.shift() as Action);
    const end = Date.now() + shot.warmup * 1000;
    let last = Date.now();
    while (Date.now() < end) {
      await sleep(30);
      const now = Date.now();
      if (step) await page.evaluate(`window.__step(${now - last})`);
      last = now;
    }
  }
  if (shot.view === 'turntable' && shot.zoom !== undefined) {
    // Camera distance factor of the turntable (display only): >1 shows more of a tall item.
    await page.evaluate(`(() => { const t = window.spotless.turntable; const u = t.update.bind(t);
      t.update = function (dt, aspect) { const d = this.distance; this.distance = d * ${shot.zoom}; u(dt, aspect); this.distance = d; }; })()`);
  }
  if (shot.view === 'watch') {
    if (!(await page.evaluate<boolean>(ORBIT))) throw new Error('watch camera not found in the page');
    if (shot.camera !== undefined) {
      const seconds = shot.seconds ?? 5;
      await page.evaluate(`window.__cam = Object.assign(${JSON.stringify(shot.camera)}, { t0: performance.now(), dur: ${seconds} })`);
    }
    if (shot.water === 'demo') await page.evaluate(`window.spotless.debugWater(true, null)`);
  }

  // The frame schedule: watch shots run `seconds`; turntables run each item's seconds in turn.
  const segments =
    shot.view === 'turntable'
      ? (shot.items ?? []).map((it) => ({ hash: `${session}&turntable&item=${encodeURIComponent(it.id)}`, seconds: it.seconds }))
      : [{ hash: null as string | null, seconds: shot.seconds ?? 5 }];
  let frame = 0;
  const shotT0 = Date.now();
  const stamps: number[] = [];
  let segStart = 0;
  for (const [si, seg] of segments.entries()) {
    if (seg.hash !== null && si > 0) await page.evaluate(`location.hash = ${JSON.stringify(seg.hash)}`);
    const frames = Math.round(seg.seconds * fps);
    for (let f = 0; f < frames || (!step && shot.until_done === true && f < 1e6); f++) {
      const t = step ? segStart + f / fps : (Date.now() - shotT0) / 1000;
      if (!step && t >= (shot.seconds ?? 5) && (shot.until_done !== true || f >= frames)) break;
      while (queue.length > 0 && (queue[0]?.at ?? 0) <= t) {
        const a = queue.shift() as Action;
        await act(session, a);
        // Let the page receive the new state before time moves on.
        await sleep(250);
      }
      if (step) await page.evaluate(`window.__step(${1000 / fps})`);
      const path = join(framesDir, `${String(frame).padStart(5, '0')}.${step ? 'png' : 'jpg'}`);
      await page.screenshot(step ? { path, type: 'png' } : { path, type: 'jpeg', quality: 95, optimizeForSpeed: true });
      stamps.push((Date.now() - shotT0) / 1000);
      frame++;
      if (!step && shot.until_done === true && frame % 30 === 0) {
        const summary = await api(`/api/sessions/${session}`);
        const job = summary['job'] as { status?: string } | null;
        if (job?.status === 'done' && summary['phase'] !== 'washing' && t > 3) {
          // Two more seconds on the washed load.
          if ((summary as { __tail?: number }).__tail === undefined) {
            const until = Date.now() + 2000;
            while (Date.now() < until) {
              await page.screenshot({ path: join(framesDir, `${String(frame).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 95, optimizeForSpeed: true });
              stamps.push((Date.now() - shotT0) / 1000);
              frame++;
            }
          }
          break;
        }
      }
    }
    segStart += seg.seconds;
  }
  await page.close();
  const out = join(outDir, `${shot.id}.mp4`);
  if (step) {
    encode(framesDir, '%05d.png', fps, out);
  } else {
    // Wall-clock frames: a concat list with each frame's real duration, resampled to fps.
    const lines: string[] = [];
    for (let i = 0; i < frame; i++) {
      const d = i + 1 < frame ? (stamps[i + 1] as number) - (stamps[i] as number) : 1 / fps;
      lines.push(`file '${join(framesDir, `${String(i).padStart(5, '0')}.jpg`)}'`, `duration ${d.toFixed(4)}`);
    }
    lines.push(`file '${join(framesDir, `${String(frame - 1).padStart(5, '0')}.jpg`)}'`);
    const listPath = join(framesDir, 'list.txt');
    writeFileSync(listPath, lines.join('\n'));
    encode(framesDir, '', fps, out, listPath);
    console.log(`  realtime: ${frame} frames in ${stamps.at(-1)?.toFixed(1)} s (${(frame / (stamps.at(-1) ?? 1)).toFixed(1)} fps captured)`);
  }
  spawnSync('ffmpeg', ['-y', '-v', 'error', '-sseof', '-0.1', '-i', out, '-frames:v', '1', join(outDir, `${shot.id}.png`)]);
  if (!keepFrames) rmSync(framesDir, { recursive: true, force: true });
  console.log(`  → ${out}`);
}

// ---------------------------------------------------------------------------------------------

if (server === undefined) server = await startServer();
const browser = await launchChrome();
try {
  for (const shot of list.shots) {
    if (only !== undefined && !only.includes(shot.id)) continue;
    await capture(browser, shot, list.fps ?? 30);
  }
} finally {
  await browser.close();
  if (child !== null) (child as ChildProcess).kill('SIGTERM');
}
if (!existsSync(outDir)) process.exit(1);
