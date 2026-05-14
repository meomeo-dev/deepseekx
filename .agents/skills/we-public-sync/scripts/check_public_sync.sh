#!/usr/bin/env bash
set -euo pipefail

private_root="${WE_PRIVATE_ROOT:-/Users/jin/projects/deepseekx}"
public_root="${WE_PUBLIC_ROOT:-/Users/jin/projects/deepseekx-public}"
private_remote_hint="${WE_PRIVATE_REMOTE_HINT:-deepseekx}"
public_remote_hint="${WE_PUBLIC_REMOTE_HINT:-deepseekx.git}"
expected_owner="${WE_GITHUB_OWNER:-meomeo-dev}"

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
    echo "git_dir=$(git rev-parse --absolute-git-dir 2>/dev/null || true)"
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
    echo "package_version=$(node -p "require('./codex-cli/package.json').version" \
      2>/dev/null || true)"
  )
}

repo_summary private "$private_root" "$private_remote_hint"
repo_summary public "$public_root" "$public_remote_hint"

section "identity separation"
private_abs="$(cd "$private_root" 2>/dev/null && pwd || true)"
public_abs="$(cd "$public_root" 2>/dev/null && pwd || true)"
echo "private_abs=$private_abs"
echo "public_abs=$public_abs"
if [[ -n "$private_abs" && "$private_abs" == "$public_abs" ]]; then
  echo "identity_check=same_worktree_error"
else
  echo "identity_check=separate_paths"
fi

if [[ -d "$private_root/.git" && -d "$public_root/.git" ]]; then
  private_git="$(git -C "$private_root" rev-parse --absolute-git-dir)"
  public_git="$(git -C "$public_root" rev-parse --absolute-git-dir)"
  echo "private_git_dir=$private_git"
  echo "public_git_dir=$public_git"
  if [[ "$private_git" == "$public_git" ]]; then
    echo "git_identity_check=same_git_dir_error"
  else
    echo "git_identity_check=separate_git_dirs"
  fi
fi

section "github visibility"
if command -v gh >/dev/null 2>&1; then
  for label in private public; do
    root_var="${label}_root"
    root="${!root_var}"
    if [[ ! -d "$root/.git" ]]; then
      echo "$label.visibility=missing_repo"
      continue
    fi
    origin_url="$(git -C "$root" remote get-url origin 2>/dev/null || true)"
    repo="${origin_url#https://github.com/}"
    repo="${repo#git@github.com:}"
    repo="${repo%.git}"
    if [[ "$repo" == "$expected_owner/"* ]]; then
      echo "$label.owner_check=ok repo=$repo"
    else
      echo "$label.owner_check=unexpected repo=$repo"
    fi
    visibility="$(gh repo view "$repo" --json visibility --jq .visibility \
      2>/dev/null || true)"
    echo "$label.visibility=${visibility:-unavailable}"
  done
else
  echo "gh=missing"
fi

section "public forbidden paths"
if [[ -d "$public_root/.git" ]]; then
  (
    cd "$public_root"
    find . -maxdepth 2 \( \
      -path './_tasks' -o \
      -path './_workflows' -o \
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
      '/Users/jin/projects/deepseekx'
      '_tasks'
      '_workflows'
      '\.deep-research'
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
const root = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const pkg = JSON.parse(fs.readFileSync('codex-cli/package.json', 'utf8'))
console.log(`root_private=${root.private ?? ''}`)
console.log(`name=${pkg.name ?? ''}`)
console.log(`bin=${Object.keys(pkg.bin ?? {}).join(',')}`)
console.log(`repository=${pkg.repository?.url ?? ''}`)
console.log(`bugs=${pkg.bugs?.url ?? ''}`)
console.log(`homepage=${pkg.homepage ?? ''}`)
NODE
  )
else
  echo "public_repo=missing"
fi
