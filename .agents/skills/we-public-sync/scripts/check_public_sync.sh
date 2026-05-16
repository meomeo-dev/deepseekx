#!/usr/bin/env bash
set -euo pipefail

repo_root="${WE_REPO_ROOT:-/Users/jin/projects/deepseekx}"
expected_repo="${WE_PUBLIC_REPO_SLUG:-meomeo-dev/deepseekx}"
remote_hint="${WE_PUBLIC_REMOTE_HINT:-meomeo-dev/deepseekx}"

section() {
  printf '\n== %s ==\n' "$1"
}

repo_summary() {
  local root="$1"

  section "public repo"
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

repo_summary "$repo_root"

section "github visibility"
if command -v gh >/dev/null 2>&1; then
  if [[ ! -d "$repo_root/.git" ]]; then
    echo "visibility=missing_repo"
  else
    origin_url="$(git -C "$repo_root" remote get-url origin 2>/dev/null || true)"
    repo="${origin_url#https://github.com/}"
    repo="${repo#git@github.com:}"
    repo="${repo%.git}"
    if [[ "$repo" == "$expected_repo" ]]; then
      echo "repo_check=ok repo=$repo"
    else
      echo "repo_check=unexpected repo=$repo expected=$expected_repo"
    fi
    visibility="$(gh repo view "$repo" --json visibility --jq .visibility \
      2>/dev/null || true)"
    echo "visibility=${visibility:-unavailable}"
  fi
else
  echo "gh=missing"
fi

section "tracked forbidden public paths"
if [[ -d "$repo_root/.git" ]]; then
  (
    cd "$repo_root"
    git ls-files |
      rg '^(_tasks|_workflows|\.deep-research/|\.env$)' || true
  )
else
  echo "repo=missing"
fi

section "npmrc auth entries"
if [[ -d "$repo_root/.git" ]]; then
  (
    cd "$repo_root"
    if [[ -f .npmrc ]]; then
      rg -n '(_authToken|_auth|always-auth|username|password)' .npmrc || \
        echo "npmrc_auth=none"
    else
      echo "npmrc=absent"
    fi
  )
else
  echo "repo=missing"
fi

section "stale mirror references"
if [[ -d "$repo_root/.git" ]]; then
  (
    cd "$repo_root"
    pattern='deepseekx-public|sanitized public mirror|双仓库|公开镜像'
    while IFS= read -r path; do
      case "$path" in
        .agents/skills/we-public-sync/*|\
        .agents/skills/we-skill-init/SKILL.md|\
        .agents/skills/we-skill-init/templates/*|\
        .agents/skills/we-skill-audit/data/*|\
        .agents/skills/we-skill-maker/data/*)
          continue
          ;;
      esac
      rg -n "$pattern" "$path" || true
    done < <(git ls-files .agents/skills | rg '/SKILL\.md$|/scripts/.*\.sh$') |
      rg -v '不使用独立 `deepseekx-public` 镜像' || true
  )
else
  echo "repo=missing"
fi

section "credential-like assignments"
if [[ -d "$repo_root/.git" ]]; then
  (
    cd "$repo_root"
    credential_pattern='[A-Z0-9_]*(API[_-]?KEY|TOKEN|SECRET|CREDENTIAL)'
    credential_pattern+='[A-Z0-9_]*[[:space:]]*[:=][[:space:]]*'
    credential_pattern+='[A-Za-z0-9_./+=-]{16,}|PRIVATE KEY'
    rg -n --hidden --glob '!node_modules/**' --glob '!.git/**' \
      --glob '!package-lock.json' \
      --glob '!codex-rs/**/tests/**' \
      --glob '!codex-rs/login/src/auth/auth_tests.rs' \
      --glob '!codex-rs/agent-identity/src/lib.rs' \
      --glob '!.agents/skills/we-skill-init/templates/**' \
      --glob '!.agents/skills/we-public-sync/scripts/check_public_sync.sh' \
      "$credential_pattern" . || true
  )
else
  echo "repo=missing"
fi

section "local-only sensitive files"
if [[ -d "$repo_root/.git" ]]; then
  (
    cd "$repo_root"
    git status --short --ignored .env .npmrc .deep-research 2>/dev/null || true
  )
else
  echo "repo=missing"
fi

section "public package metadata"
if [[ -d "$repo_root/.git" ]]; then
  (
    cd "$repo_root"
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
  echo "repo=missing"
fi
