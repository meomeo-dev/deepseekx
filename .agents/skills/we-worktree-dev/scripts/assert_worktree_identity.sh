#!/usr/bin/env bash
set -euo pipefail

expected="${1:-}"

if [[ -z "$expected" ]]; then
  echo "usage: assert_worktree_identity.sh <expected-worktree-root>" >&2
  exit 2
fi

actual="$(git rev-parse --show-toplevel)"
expected="$(cd "$expected" && pwd)"

if [[ "$actual" != "$expected" ]]; then
  cat >&2 <<EOF
wrong worktree
expected=$expected
actual=$actual
EOF
  exit 1
fi

git status --short --branch
