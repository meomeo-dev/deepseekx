#!/usr/bin/env bash
set -euo pipefail

repo="${WE_BRANCH_PROTECTION_REPO:-meomeo-dev/deepseekx}"
branch="${WE_BRANCH_PROTECTION_BRANCH:-deepseekx/main}"
apply="${WE_BRANCH_PROTECTION_APPLY:-0}"

branch_path() {
  printf '%s' "$branch" | sed 's#/#%2F#g'
}

cat <<EOF
repo=$repo
branch=$branch
apply=$apply
EOF

payload="$(mktemp)"
trap 'rm -f "$payload"' EXIT

cat >"$payload" <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["build-test"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
JSON

if [[ "$apply" != "1" ]]; then
  echo "dry_run=1"
  echo "Set WE_BRANCH_PROTECTION_APPLY=1 to apply this payload:"
  cat "$payload"
  exit 0
fi

gh api \
  --method PUT \
  "repos/${repo}/branches/$(branch_path)/protection" \
  --input "$payload"
