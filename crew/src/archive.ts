/**
 * Archiving a run into the repository: `.crew/runs/<id>` (and a snapshot of the memory) is copied
 * into the tracked `crew/runs/<id>/`. Logs are gzipped (split into parts so that no file
 * passes ~45 MB), episode records and transcripts are kept (gzipped when over 1 MB), pictures are
 * left out. Everything is scanned for the API key and `authorization` strings first: a hit
 * aborts. A manifest lists every file with its size, sha256 and line count.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

export const ARCHIVE_ROOT = fileURLToPath(new URL('../runs/', import.meta.url));
const MAX_FILE = 45 * 1024 * 1024;
const GZIP_OVER = 1024 * 1024;

export class SecretFound extends Error {}

/** Throws when the text holds the API key or an authorization header. */
export function scanForSecrets(text: string, where: string): void {
  const key = process.env['CRUSOE_API_KEY'] ?? '';
  if (key.length >= 8 && text.includes(key)) throw new SecretFound(`the API key is in ${where}`);
  if (/authorization["']?\s*[:=]\s*["']?bearer/i.test(text) || /"authorization"\s*:/i.test(text)) throw new SecretFound(`an authorization header is in ${where}`);
}

interface Entry {
  path: string;
  bytes: number;
  sha256: string;
  lines?: number;
  source: string;
}

function writeOut(outDir: string, rel: string, data: Buffer, entries: Entry[], source: string, lines?: number): void {
  const file = join(outDir, rel);
  mkdirSync(join(file, '..'), { recursive: true });
  if (data.length > MAX_FILE) throw new Error(`${rel} is ${data.length} bytes, over the limit`);
  writeFileSync(file, data);
  entries.push({ path: rel, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'), ...(lines === undefined ? {} : { lines }), source });
}

/** A JSONL file, gzipped, in parts of whole lines that each stay under the limit. */
function archiveJsonl(src: string, outDir: string, relBase: string, entries: Entry[]): void {
  const text = readFileSync(src, 'utf8');
  scanForSecrets(text, src);
  const lines = text.split('\n').filter((l) => l !== '');
  const one = gzipSync(Buffer.from(text));
  if (one.length <= MAX_FILE) {
    writeOut(outDir, `${relBase}.gz`, one, entries, src, lines.length);
    return;
  }
  const parts = Math.ceil(one.length / (MAX_FILE * 0.8));
  const per = Math.ceil(lines.length / parts);
  for (let p = 0; p < parts; p++) {
    const chunk = lines.slice(p * per, (p + 1) * per);
    writeOut(outDir, relBase.replace(/\.jsonl$/, `.part${String(p + 1).padStart(2, '0')}.jsonl.gz`), gzipSync(Buffer.from(`${chunk.join('\n')}\n`)), entries, src, chunk.length);
  }
}

function archiveFile(src: string, outDir: string, rel: string, entries: Entry[]): void {
  const data = readFileSync(src);
  scanForSecrets(data.toString('utf8'), src);
  if (data.length > GZIP_OVER) writeOut(outDir, `${rel}.gz`, gzipSync(data), entries, src);
  else writeOut(outDir, rel, data, entries, src);
}

/** Archives one run (and the memory) into crew/runs/<id>/; returns the manifest. */
export function archiveRun(runDir: string, memoryDir: string | null, root = ARCHIVE_ROOT): { dir: string; bytes: number; files: number } {
  const id = basename(runDir);
  const outDir = join(root, id);
  const staging = join(root, `.${id}.staging`);
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  const entries: Entry[] = [];
  try {
    for (const name of readdirSync(runDir)) {
      const src = join(runDir, name);
      if (statSync(src).isDirectory()) continue;
      if (name.endsWith('.jsonl')) archiveJsonl(src, staging, name, entries);
      else archiveFile(src, staging, name, entries);
    }
    const episodes = join(runDir, 'episodes');
    if (existsSync(episodes)) {
      for (const ep of readdirSync(episodes)) {
        for (const name of ['record.json', 'transcript.json']) {
          const src = join(episodes, ep, name);
          if (existsSync(src)) archiveFile(src, staging, `episodes/${ep}/${name}`, entries);
        }
      }
    }
    if (memoryDir !== null && existsSync(memoryDir)) {
      for (const name of readdirSync(memoryDir)) {
        const src = join(memoryDir, name);
        if (statSync(src).isDirectory()) continue;
        if (name.endsWith('.jsonl')) archiveJsonl(src, staging, `memory/${name}`, entries);
        else archiveFile(src, staging, `memory/${name}`, entries);
      }
    }
    const bytes = entries.reduce((a, e) => a + e.bytes, 0);
    const manifest = {
      runId: id,
      archivedAt: new Date().toISOString(),
      files: entries.map((e) => ({ ...e, source: relative(join(runDir, '..', '..'), e.source) })),
      totals: { files: entries.length, bytes, episodes: existsSync(episodes) ? readdirSync(episodes).length : 0 },
      note: 'Logs are gzipped JSONL (split into .partNN when large); pictures are not archived. Replay: pnpm --filter @spotless/crew crew serve --run <id>.',
    };
    writeFileSync(join(staging, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
    writeFileSync(join(staging, 'README.md'), `# Crew run ${id}\n\n${entries.length} files, ${(bytes / 1e6).toFixed(1)} MB (gzipped logs, episode records and transcripts, memory snapshot; no pictures). Replay in the studio: \`pnpm --filter @spotless/crew crew serve --run ${id}\`. Calls: \`calls.jsonl.gz\` (rebuild full requests with \`reconstructRequests\` of src/calllog.ts).\n`);
    rmSync(outDir, { recursive: true, force: true });
    // Rename the staging copy into place.
    mkdirSync(root, { recursive: true });
    renameSync(staging, outDir);
    return { dir: outDir, bytes, files: entries.length };
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}


/** The lines of a run's JSONL log, live (.crew/runs) or archived (gzipped, maybe in parts). */
export function readJsonlAnywhere(dir: string, name: string): string[] {
  const plain = join(dir, name);
  if (existsSync(plain)) return readFileSync(plain, 'utf8').split('\n').filter((l) => l.trim() !== '');
  if (existsSync(`${plain}.gz`)) return gunzipSync(readFileSync(`${plain}.gz`)).toString('utf8').split('\n').filter((l) => l.trim() !== '');
  const base = name.replace(/\.jsonl$/, '');
  if (!existsSync(dir)) return [];
  const parts = readdirSync(dir).filter((f) => f.startsWith(`${base}.part`) && f.endsWith('.jsonl.gz')).sort();
  return parts.flatMap((f) => gunzipSync(readFileSync(join(dir, f))).toString('utf8').split('\n').filter((l) => l.trim() !== ''));
}
