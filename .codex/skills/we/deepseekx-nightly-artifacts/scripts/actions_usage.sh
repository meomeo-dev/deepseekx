#!/usr/bin/env bash
set -euo pipefail

origin_url="$(git remote get-url origin)"
repo="${origin_url#https://github.com/}"
repo="${repo#git@github.com:}"
repo="${repo%.git}"
owner="${repo%%/*}"

echo "repo=${repo}"
echo "owner=${owner}"

visibility="$(
  gh repo view "$repo" --json visibility --jq .visibility 2>/dev/null || true
)"
if [[ -n "$visibility" ]]; then
  echo "visibility=${visibility}"
fi

if [[ "$visibility" == "PUBLIC" ]]; then
  echo "standard hosted runners are free for public repositories."
fi

try_api() {
  local path="$1"
  local out="/tmp/deepseekx-actions-usage.json"
  local err="/tmp/deepseekx-actions-usage.err"
  if gh api "$path" >"$out" 2>"$err"; then
    echo "endpoint=${path}"
    cat "$out"
    rm -f "$out" "$err"
    return 0
  fi
  return 1
}

if try_api "/orgs/${owner}/settings/billing/actions"; then
  exit 0
fi

if try_api "/users/${owner}/settings/billing/actions"; then
  exit 0
fi

echo "Unable to read GitHub Actions billing usage for ${owner}." >&2
echo "This usually means the token lacks billing scope or owner access." >&2
if [[ -s /tmp/deepseekx-actions-usage.err ]]; then
  cat /tmp/deepseekx-actions-usage.err >&2
fi
rm -f /tmp/deepseekx-actions-usage.json /tmp/deepseekx-actions-usage.err
exit 1
