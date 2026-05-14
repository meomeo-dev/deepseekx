#!/usr/bin/env bash
set -euo pipefail

private_root="${WE_PRIVATE_ROOT:-__WE_PRIVATE_ROOT__}"
public_root="${WE_PUBLIC_ROOT:-__WE_PUBLIC_ROOT__}"
package_name="${WE_PACKAGE_NAME:-__WE_PACKAGE_NAME__}"
tarball_glob="${WE_PACKAGE_TARBALL_GLOB:-__WE_PACKAGE_TARBALL_GLOB__}"

section() {
  printf '\n== %s ==\n' "$1"
}

repo_report() {
  local label="$1"
  local root="$2"
  local expected_remote="$3"

  section "$label repo"
  if [[ ! -d "$root/.git" ]]; then
    echo "missing_git_repo=$root"
    return
  fi

  (
    cd "$root"
    local branch
    branch="$(git branch --show-current 2>/dev/null || true)"
    if [[ -z "$branch" ]]; then
      echo "branch=detached"
    else
      echo "branch=$branch"
    fi

    local origin_url
    origin_url="$(git remote get-url origin 2>/dev/null || true)"
    echo "origin=$origin_url"
    if [[ "$origin_url" == *"$expected_remote"* ]]; then
      echo "origin_check=ok"
    else
      echo "origin_check=unexpected"
    fi

    echo "status_short:"
    git status --short

    echo "ignored_summary:"
    git status --short --ignored |
      awk '$1 == "!!" { print $2 }' |
      sed -n '1,20p'

    echo "ahead_behind_origin_main:"
    if git show-ref --verify --quiet refs/remotes/origin/main; then
      git rev-list --left-right --count origin/main...main |
        awk '{ print "behind=" $1 " ahead=" $2 }'
    else
      echo "missing_origin_main"
    fi

    echo "head:"
    git log -1 --format='%h %s'

    local version
    version="$(node -p "require('./package.json').version" 2>/dev/null || true)"
    echo "package_version=$version"
    if [[ -n "$version" ]]; then
      local tag="v$version"
      echo "local_tag:"
      git tag --list "$tag"
      echo "remote_tag:"
      git ls-remote --tags origin "$tag" | sed -n '1,4p'
    fi

    echo "local_artifacts:"
    find . -maxdepth 2 \( -name "$tarball_glob" -o -name '*.sha256' \) \
      -print | sed -n '1,20p'
  )
}

section "release cleanup check"
echo "private_root=$private_root"
echo "public_root=$public_root"
echo "package_name=$package_name"
echo "tarball_glob=$tarball_glob"

repo_report "private" "$private_root" "__WE_PRIVATE_REPO_NAME__"
repo_report "public" "$public_root" "__WE_PUBLIC_REMOTE_HINT__"

section "npm registry"
if command -v npm >/dev/null 2>&1; then
  npm view "$package_name" version dist-tags --json 2>/dev/null || \
    echo "npm_view=failed"
else
  echo "npm=missing"
fi

section "recent ci"
if command -v gh >/dev/null 2>&1; then
  echo "public:"
  gh run list --repo __WE_PUBLIC_REPO_SLUG__ --limit 3 \
    --json databaseId,status,conclusion,event,displayTitle,url 2>/dev/null || \
    echo "public_ci=unavailable"
  echo "private:"
  gh run list --repo __WE_PRIVATE_REPO_SLUG__ --limit 3 \
    --json databaseId,status,conclusion,event,displayTitle,url 2>/dev/null || \
    echo "private_ci=unavailable"
else
  echo "gh=missing"
fi
