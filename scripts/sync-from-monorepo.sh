#!/usr/bin/env bash
# Re-imports the latest hackathon work from the working monorepo and rebuilds RSHI's history
# deterministically. Re-runnable and idempotent; the monorepo is only read (cloned), never changed.
#
#   bash scripts/sync-from-monorepo.sh            # rebuild locally, verify, no push
#   PUSH=1 bash scripts/sync-from-monorepo.sh     # ... then secret scan and force-push both repos
#
# What it does:
#  1. Fork (elevenarms/DishwasherBench, branch rshi): upstream base + the monorepo's commits,
#     limited to apps/web (format-patch | am, author and committer dates kept), + RSHI-CHANGES.md
#     (from fork/RSHI-CHANGES.md here, dated by its last commit in RSHI).
#  2. RSHI main: the monorepo's packages/crew, apps/studio, docs/crew with their history
#     (git filter-repo, renamed to crew/, studio/, docs/; dates kept), then this repo's own
#     commits (trailer "RSHI-Overlay: yes", cherry-picked with their dates), then two generated
#     commits (trailer "RSHI-Generated: yes"): the layout adaptation (scripts/apply-layout.py),
#     submodule pin and lockfile; and PROVENANCE.md. Generated commits are dated by the newest
#     input commit, so an unchanged input gives the same SHAs.
#  3. Secret scan of everything that would be pushed (the Crusoe key); abort on a hit.
#  4. PUSH=1: force-push the fork's rshi, then RSHI main.
#
# Env: MONO (monorepo path), MONO_BRANCH, BASE (upstream base), WORK (scratch dir), KEYFILE, PUSH.
set -euo pipefail

RSHI=${RSHI:-$(cd "$(dirname "$0")/.." && pwd)}
# run from a copy: the checkout below rewrites this file while bash is reading it
if [ -z "${SYNC_FROM_COPY:-}" ]; then
  mkdir -p "${WORK:-$(dirname "$RSHI")/RSHI-build}"
  COPY=${WORK:-$(dirname "$RSHI")/RSHI-build}/sync-from-monorepo.sh
  cp "$0" "$COPY"
  RSHI=$RSHI SYNC_FROM_COPY=1 exec bash "$COPY" "$@"
fi
MONO=${MONO:-/Users/elevenarms/Code/wash/DishwasherBench}
MONO_BRANCH=${MONO_BRANCH:-self-improving-crew}
WORK=${WORK:-$(dirname "$RSHI")/RSHI-build}
KEYFILE=${KEYFILE:-$(dirname "$RSHI")/crusoe_key}
PUSH=${PUSH:-0}
FORK=$WORK/DishwasherBench-fork
FORK_URL=https://github.com/elevenarms/DishwasherBench.git
RSHI_URL=https://github.com/elevenarms/RSHI.git
SUB=upstream/DishwasherBench

log() { printf '== %s\n' "$*" >&2; }
die() { printf 'sync: %s\n' "$*" >&2; exit 1; }

command -v git-filter-repo >/dev/null || die "git-filter-repo missing (brew install git-filter-repo)"
mkdir -p "$WORK"
BASE=$(git -C "$MONO" rev-parse "${BASE:-99b974a}^{commit}")
MONO_TIP=$(git -C "$MONO" rev-parse "$MONO_BRANCH")
log "monorepo $MONO_BRANCH at ${MONO_TIP:0:7}, upstream base ${BASE:0:7}"

# RSHI must be clean (ignored files such as .env, .crew, node_modules are kept).
cd "$RSHI"
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || die "RSHI is not on main"
git diff --quiet && git diff --cached --quiet || die "RSHI has uncommitted changes: commit them (with the trailer 'RSHI-Overlay: yes') first"
[ -z "$(git ls-files --others --exclude-standard)" ] || die "RSHI has untracked files: commit or remove them first"
OLD_MAIN=$(git rev-parse main)
OVERLAYS=$(git log --reverse --format=%H --grep='^RSHI-Overlay: yes' main)
[ -n "$OVERLAYS" ] || die "no overlay commits found on main"

# ---------------------------------------------------------------- 1. the fork's rshi branch
if [ ! -d "$FORK/.git" ]; then git clone -q "$FORK_URL" "$FORK"; fi
git -C "$FORK" fetch -q origin
git -C "$FORK" cat-file -e "$BASE^{commit}" || git -C "$FORK" fetch -q https://github.com/composo-ai/DishwasherBench.git main
git -C "$FORK" am --abort >/dev/null 2>&1 || true
git -C "$FORK" checkout -q -f -B rshi "$BASE"
git -C "$FORK" clean -qfdx
git -C "$MONO" format-patch --stdout "$BASE..$MONO_TIP" -- apps/web > "$WORK/web.patch"
if [ -s "$WORK/web.patch" ]; then git -C "$FORK" am -q --committer-date-is-author-date "$WORK/web.patch"; fi
CHANGES_DATE=$(git log -1 --format=%aI -- fork/RSHI-CHANGES.md)
cp fork/RSHI-CHANGES.md "$FORK/RSHI-CHANGES.md"
git -C "$FORK" add RSHI-CHANGES.md
GIT_AUTHOR_DATE=$CHANGES_DATE GIT_COMMITTER_DATE=$CHANGES_DATE \
  git -C "$FORK" commit -q -m "RSHI-CHANGES.md: what the rshi branch changes (apps/web only) and what it does not"
FORK_TIP=$(git -C "$FORK" rev-parse rshi)
outside=$(git -C "$FORK" diff --name-only "$BASE" "$FORK_TIP" | grep -v -e '^apps/web/' -e '^RSHI-CHANGES.md$' || true)
[ -z "$outside" ] || die "fork rshi touches files outside apps/web: $outside"
log "fork rshi at ${FORK_TIP:0:7} ($(git -C "$FORK" rev-list --count "$BASE..$FORK_TIP") commits on the base)"

# ---------------------------------------------------------------- 2. RSHI history
rm -rf "$WORK/import"
git clone -q --no-local --single-branch --branch "$MONO_BRANCH" "$MONO" "$WORK/import"
git -C "$WORK/import" reset -q --hard "$MONO_TIP"
(cd "$WORK/import" && git filter-repo --quiet --force \
  --path packages/crew --path apps/studio --path docs/crew \
  --path-rename packages/crew/:crew/ --path-rename apps/studio/:studio/ --path-rename docs/crew/:docs/)
git fetch -q "$WORK/import" "$MONO_BRANCH"
IMPORT_TIP=$(git rev-parse FETCH_HEAD)
git -C "$WORK/import" log --format=%H | while read -r c; do
  # the import holds only hackathon commits: none may predate the upstream base
  [ "$(git log -1 --format=%ct "$c")" -gt "$(git -C "$MONO" log -1 --format=%ct "$BASE")" ] || die "imported commit $c predates the base"
done
log "imported $(git rev-list --count "$IMPORT_TIP") commits of crew/ studio/ docs/"

git checkout -q -f --detach "$IMPORT_TIP"
for c in $OVERLAYS; do
  git cherry-pick --allow-empty -X theirs "$c" >/dev/null || { git cherry-pick --abort; git checkout -q -f main; die "overlay $c does not apply"; }
  GIT_COMMITTER_DATE=$(git log -1 --format=%cI "$c") git commit -q --amend --no-edit --allow-empty
done

# the generated commits are dated by the newest input
DATE=$( { git log -1 --format=%ct "$IMPORT_TIP"; git -C "$FORK" log -1 --format=%ct "$FORK_TIP"; for c in $OVERLAYS; do git log -1 --format=%ct "$c"; done; } | sort -n | tail -1)
DATE="@$DATE"
gen_commit() {
  GIT_AUTHOR_DATE=$DATE GIT_COMMITTER_DATE=$DATE git commit -q --allow-empty -m "$1

RSHI-Generated: yes"
}

python3 -I scripts/apply-layout.py "$RSHI" >&2
git submodule sync -q
git -C "$SUB" fetch -q "$FORK" "+rshi:refs/remotes/origin/rshi" 2>/dev/null || git -C "$SUB" fetch -q "$FORK" rshi
git -C "$SUB" checkout -q -f "$FORK_TIP"
git -C "$SUB" config core.fileMode false
git update-index --cacheinfo "160000,$FORK_TIP,$SUB"
pnpm install --silent >&2
git add -A crew studio docs pnpm-lock.yaml
gen_commit "rshi(generated): adapt imported code to the RSHI layout, pin upstream to rshi@${FORK_TIP:0:7}"
bash scripts/provenance.sh > PROVENANCE.md
git add PROVENANCE.md
gen_commit "rshi(generated): PROVENANCE.md"
NEW_MAIN=$(git rev-parse HEAD)
git checkout -q -B main "$NEW_MAIN"
log "RSHI main: ${OLD_MAIN:0:7} -> ${NEW_MAIN:0:7}"

# ---------------------------------------------------------------- 3. secret scan
K=$(tr -d '\n' < "$KEYFILE")
[ -n "$K" ] || die "empty key file"
if git log -p --binary main | grep -qF "$K"; then die "LEAK: the key is in RSHI main; nothing pushed"; fi
if git -C "$FORK" log -p --binary "$BASE..$FORK_TIP" | grep -qF "$K"; then die "LEAK: the key is in the fork's rshi; nothing pushed"; fi
if git ls-tree -r --name-only main | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$'; then die "a .env file is tracked; nothing pushed"; fi
log "secret scan clean"

# ---------------------------------------------------------------- 4. push
if [ "$PUSH" = 1 ]; then
  git -C "$FORK" push -q -f "$FORK_URL" rshi
  git push -q -f "$RSHI_URL" main
  log "pushed: $FORK_URL rshi@${FORK_TIP:0:7}, $RSHI_URL main@${NEW_MAIN:0:7}"
else
  log "not pushed (PUSH=1 to force-push)"
fi
