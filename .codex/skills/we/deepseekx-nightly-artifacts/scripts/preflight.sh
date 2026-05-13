#!/usr/bin/env bash
set -euo pipefail

workflow=".github/workflows/deepseekx-nightly-artifacts.yml"

echo "== branch =="
git branch --show-current

echo
echo "== remotes =="
git remote -v

echo
echo "== worktree =="
git status --short --branch

echo
echo "== workflow =="
if [[ -f "$workflow" ]]; then
  echo "present=${workflow}"
else
  echo "missing=${workflow}" >&2
fi

echo
echo "== gh auth =="
if gh auth status >/tmp/deepseekx-gh-auth.out 2>&1; then
  cat /tmp/deepseekx-gh-auth.out
else
  cat /tmp/deepseekx-gh-auth.out >&2
  rm -f /tmp/deepseekx-gh-auth.out
  exit 1
fi
rm -f /tmp/deepseekx-gh-auth.out

echo
echo "== latest nightly runs =="
origin_url="$(git remote get-url origin)"
repo="${origin_url#https://github.com/}"
repo="${repo#git@github.com:}"
repo="${repo%.git}"
if ! gh run list \
  --repo "$repo" \
  --workflow deepseekx-nightly-artifacts.yml \
  --limit 5 2>/tmp/deepseekx-nightly-runs.err; then
  echo "nightly workflow is not visible on the remote default branch yet."
  if [[ -s /tmp/deepseekx-nightly-runs.err ]]; then
    cat /tmp/deepseekx-nightly-runs.err
  fi
fi
rm -f /tmp/deepseekx-nightly-runs.err

echo
echo "== actions usage =="
if .codex/skills/we/deepseekx-nightly-artifacts/scripts/actions_usage.sh; then
  true
else
  echo "billing usage unavailable; continue only after user understands risk."
fi
