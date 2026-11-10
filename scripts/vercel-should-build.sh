#!/usr/bin/env bash
# Vercel ignoreCommand: exit 0 → skip build, exit 1 → proceed.
# Skips build when only tooling/docs changed (.claude/, .github/, *.md, .vscode/).
#
# Compares against the last deployed commit (VERCEL_GIT_PREVIOUS_SHA), not HEAD^: a push of several commits
# whose last one only touches docs must still build the code in the earlier ones (incident 2026-11-09).
set -e

BASE="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
# Shallow clone without that commit, or no previous commit: build anyway (safe default).
if ! git rev-parse --verify --quiet "${BASE}^{commit}" >/dev/null 2>&1; then
  echo "[vercel-should-build] base ${BASE} not available — proceeding with build"
  exit 1
fi

# Check if there are changes OUTSIDE the ignored paths.
# Important: .vercelignore and vercel.json affect build config — they DO trigger a build.
# git diff exits 0 = no diff, 1 = diff found.
if git diff --quiet "$BASE" HEAD -- \
  ':!.claude' \
  ':!.github' \
  ':!.vscode' \
  ':!*.md' \
  ':!.gitignore' \
  ':!scripts/vercel-should-build.sh' ; then
  echo "[vercel-should-build] only tooling/docs changed — skipping build"
  exit 0
else
  echo "[vercel-should-build] app/build config changed — proceeding with build"
  exit 1
fi
