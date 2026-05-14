#!/usr/bin/env bash
set -euo pipefail

private_root="${WE_PRIVATE_ROOT:-__WE_PRIVATE_ROOT__}"
public_root="${WE_PUBLIC_ROOT:-__WE_PUBLIC_ROOT__}"
private_remote_hint="${WE_PRIVATE_REMOTE_HINT:-__WE_PRIVATE_REPO_NAME__}"
public_remote_hint="${WE_PUBLIC_REMOTE_HINT:-__WE_PUBLIC_REMOTE_HINT__}"

section() {
  printf '\n== %s ==\n' "$1"
}

repo_summary() {
  local label="$1"
  local root="$2"
  local remote_hint="$3"

  section "$label repo"
  if [[ ! -d "$root/.git" ]]; then
    echo "missing_git_repo=$root"
    return
  fi

  (
    cd "$root"
    echo "root=$root"
    echo "branch=$(git branch --show-current 2>/dev/null || echo detached)"
    local origin_url
    origin_url="$(git remote get-url origin 2>/dev/null || true)"
    echo "origin=$origin_url"
    if [[ "$origin_url" == *"$remote_hint"* ]]; then
      echo "origin_check=ok"
    else
      echo "origin_check=unexpected"
    fi
    echo "status_short:"
    git status --short
    echo "package_version=$(node -p "require('./package.json').version" \
      2>/dev/null || true)"
  )
}

repo_summary private "$private_root" "$private_remote_hint"
repo_summary public "$public_root" "$public_remote_hint"

section "public forbidden paths"
if [[ -d "$public_root/.git" ]]; then
  (
    cd "$public_root"
    find . -maxdepth 2 \( \
      -path './_tasks' -o \
      -path './_workflows' -o \
      -path './.codex' -o \
      -path './.deep-research' -o \
      -name '.env' -o \
      -name '.npmrc' \
    \) -print | sort
  )
else
  echo "public_repo=missing"
fi

section "public private indicators"
if [[ -d "$public_root/.git" ]]; then
  (
    cd "$public_root"
    private_pattern=(
      '__WE_PRIVATE_REPO_NAME__'
      '__WE_PRIVATE_ROOT__'
      '_tasks'
      '_workflows'
      '\.deep-research'
      '\.codex'
    )
    joined_pattern="$(IFS='|'; echo "${private_pattern[*]}")"
    rg -n --hidden --glob '!node_modules/**' --glob '!.git/**' \
      --glob '!package-lock.json' "$joined_pattern" . || true
  )
else
  echo "public_repo=missing"
fi

section "public credential-like assignments"
if [[ -d "$public_root/.git" ]]; then
  (
    cd "$public_root"
    credential_pattern='[A-Z0-9_]*(API[_-]?KEY|TOKEN|SECRET|CREDENTIAL)'
    credential_pattern+='[A-Z0-9_]*[[:space:]]*[:=][[:space:]]*'
    credential_pattern+='[A-Za-z0-9_./+=-]{16,}|PRIVATE KEY'
    rg -n --hidden --glob '!node_modules/**' --glob '!.git/**' \
      --glob '!package-lock.json' "$credential_pattern" . || true
  )
else
  echo "public_repo=missing"
fi

section "public package metadata"
if [[ -d "$public_root/.git" ]]; then
  (
    cd "$public_root"
    node - <<'NODE'
const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
console.log(`repository=${pkg.repository?.url ?? ''}`)
console.log(`bugs=${pkg.bugs?.url ?? ''}`)
console.log(`homepage=${pkg.homepage ?? ''}`)
NODE
  )
else
  echo "public_repo=missing"
fi
