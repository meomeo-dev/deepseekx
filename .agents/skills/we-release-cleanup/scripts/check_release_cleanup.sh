#!/usr/bin/env bash
set -euo pipefail

repo_root="${WE_REPO_ROOT:-/Users/jin/projects/deepseekx}"
package_name="${WE_PACKAGE_NAME:-@meomeo-dev/deepseekx}"
tarball_glob="${WE_PACKAGE_TARBALL_GLOB:-deepseekx-*.tgz}"
main_branch="${WE_RELEASE_MAIN_BRANCH:-deepseekx/main}"

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
    if git show-ref --verify --quiet "refs/remotes/origin/${main_branch}"; then
      git rev-list --left-right --count "origin/${main_branch}...${main_branch}" |
        awk '{ print "behind=" $1 " ahead=" $2 }'
    else
      echo "missing_origin_${main_branch}"
    fi

    echo "head:"
    git log -1 --format='%h %s'

    local version
    version="$(
      node -p "require('./codex-cli/package.json').version" 2>/dev/null || true
    )"
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
echo "repo_root=$repo_root"
echo "package_name=$package_name"
echo "tarball_glob=$tarball_glob"

repo_report "public" "$repo_root" "meomeo-dev/deepseekx"

section "npm registry"
if command -v npm >/dev/null 2>&1; then
  npm view "$package_name" version dist-tags --json 2>/dev/null || \
    echo "npm_view=failed"
else
  echo "npm=missing"
fi

section "recent ci"
if command -v gh >/dev/null 2>&1; then
  gh run list --repo meomeo-dev/deepseekx --limit 3 \
    --json databaseId,status,conclusion,event,displayTitle,url 2>/dev/null || \
    echo "ci=unavailable"
else
  echo "gh=missing"
fi
