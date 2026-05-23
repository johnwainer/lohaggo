#!/usr/bin/env bash
# Vercel ignoreCommand: exit 0 → skip build, exit 1 → proceed.
# Skips build when only tooling/docs changed (.claude/, .github/, *.md, .vscode/).
set -e

# If git history is shallow or HEAD^ doesn't exist, build anyway (safe default).
if ! git rev-parse HEAD^ >/dev/null 2>&1; then
  echo "[vercel-should-build] no previous commit — proceeding with build"
  exit 1
fi

# Check if there are changes OUTSIDE the ignored paths.
# Important: .vercelignore and vercel.json affect build config — they DO trigger a build.
# git diff exits 0 = no diff, 1 = diff found.
if git diff --quiet HEAD^ HEAD -- \
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
