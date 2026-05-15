#!/usr/bin/env bash
set -euo pipefail

repo="${WE_BRANCH_PROTECTION_REPO:-meomeo-dev/deepseekx}"
branch="${WE_BRANCH_PROTECTION_BRANCH:-deepseekx/main}"
apply="${WE_BRANCH_PROTECTION_APPLY:-0}"
default_required_checks="build-test"
default_required_checks+=",Blob size policy"
default_required_checks+=",cargo-deny"
default_required_checks+=",CI results (required)"
required_checks="${WE_BRANCH_PROTECTION_REQUIRED_CHECKS:-$default_required_checks}"
required_approvals="${WE_BRANCH_PROTECTION_REQUIRED_APPROVALS:-0}"

branch_path() {
  printf '%s' "$branch" | sed 's#/#%2F#g'
}

cat <<EOF
repo=$repo
branch=$branch
apply=$apply
required_checks=$required_checks
required_approvals=$required_approvals
EOF

payload="$(mktemp)"
trap 'rm -f "$payload"' EXIT

python3 - "$payload" "$required_checks" "$required_approvals" <<'PY'
import json
import sys

payload_path, required_checks, required_approvals = sys.argv[1:]
try:
    approvals = int(required_approvals)
except ValueError:
    raise SystemExit("WE_BRANCH_PROTECTION_REQUIRED_APPROVALS must be an integer")

if approvals < 0:
    raise SystemExit("WE_BRANCH_PROTECTION_REQUIRED_APPROVALS must be >= 0")

contexts = [item.strip() for item in required_checks.split(",") if item.strip()]
if not contexts:
    raise SystemExit("WE_BRANCH_PROTECTION_REQUIRED_CHECKS must not be empty")

payload = {
    "required_status_checks": {
        "strict": True,
        "contexts": contexts,
    },
    "enforce_admins": False,
    "required_pull_request_reviews": {
        "dismiss_stale_reviews": True,
        "require_code_owner_reviews": False,
        "required_approving_review_count": approvals,
    },
    "restrictions": None,
    "required_linear_history": True,
    "allow_force_pushes": False,
    "allow_deletions": False,
    "block_creations": False,
    "required_conversation_resolution": True,
    "lock_branch": False,
    "allow_fork_syncing": True,
}

with open(payload_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2)
    f.write("\n")
PY

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
