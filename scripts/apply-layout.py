#!/usr/bin/env python3
"""Adapts code imported from the monorepo (packages/crew, apps/studio, docs/crew) to the RSHI
layout. Idempotent: each edit is skipped when already applied and fails loudly when neither the
old nor the new text is found (the imported code changed: update this file).

    python3 -I scripts/apply-layout.py [RSHI root]
"""
import re
import sys
from pathlib import Path

root = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent)

# (file, old, new): exact text edits
EDITS = [
    ("crew/tsconfig.json", '"../../tsconfig.base.json"', '"../tsconfig.base.json"'),
    ("studio/tsconfig.json", '"../../tsconfig.base.json"', '"../tsconfig.base.json"'),
    # repository root and .crew: crew/src/paths.ts (crew/src -> crew -> RSHI root), not ../../../
    ("crew/src/runner.ts",
     "export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));\nexport const CREW_ROOT = join(REPO_ROOT, '.crew');",
     "export { CREW_ROOT, RSHI_ROOT as REPO_ROOT } from './paths.ts';\nimport { CREW_ROOT, RSHI_ROOT as REPO_ROOT } from './paths.ts';\nvoid fileURLToPath;"),
    # .env: RSHI root first, then the submodule's (bench's default points into the submodule)
    ("crew/src/cli.ts", "import { loadEnvFile } from '@spotless/bench';\n", "import { loadCrewEnv, STUDIO_DIST } from './paths.ts';\n"),
    ("crew/src/cli.ts", "\nloadEnvFile();\n", "\nloadCrewEnv();\n"),
    # the studio is built to studio/dist
    ("crew/src/cli.ts", "const STUDIO_DIR = join(REPO_ROOT, 'apps', 'studio', 'dist');", "const STUDIO_DIR = STUDIO_DIST;"),
]

# (glob, regex, replacement): path mentions in prose and comments
REWRITES = [
    ("docs/*.md", r"(?<![\w/])packages/crew\b", "crew"),
    ("docs/*.md", r"(?<![\w/])apps/studio\b", "studio"),
    ("docs/*.md", r"(?<![\w/])(apps/web|packages/(?!crew\b)[a-z-]+)", r"upstream/DishwasherBench/\1"),
    ("crew/src/**/*.ts", r"(?<![\w/])apps/studio/dist\b", "studio/dist"),
    ("crew/src/**/*.ts", r"(?<![\w/])packages/crew/runs\b", "crew/runs"),
    ("studio/**/*.ts", r"(?<![\w/])apps/studio/", "studio/"),
]

failed = False
for rel, old, new in EDITS:
    p = root / rel
    s = p.read_text()
    if new in s:
        continue
    if old not in s:
        print(f"apply-layout: {rel}: expected text not found: {old[:70]!r}", file=sys.stderr)
        failed = True
        continue
    p.write_text(s.replace(old, new, 1))
    print(f"apply-layout: {rel}: edited")

for pattern, rx, rep in REWRITES:
    for p in sorted(root.glob(pattern)):
        if "node_modules" in p.parts or "dist" in p.parts:
            continue
        s = p.read_text()
        t = re.sub(rx, rep, s)
        if t != s:
            p.write_text(t)
            print(f"apply-layout: {p.relative_to(root)}: paths rewritten")

sys.exit(1 if failed else 0)
