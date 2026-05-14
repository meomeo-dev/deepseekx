#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_dir="$(cd "$script_dir/.." && pwd)"

default_baseline="$skill_dir/data/professional-dev-to-release-baseline.dot"
baseline="${WE_SKILL_AUDIT_BASELINE:-$default_baseline}"
date_stamp="${WE_SKILL_AUDIT_DATE:-$(date +%F)}"
default_output="$skill_dir/data/we-skill-audit-${date_stamp}.dot"
output="${WE_SKILL_AUDIT_OUTPUT:-$default_output}"

if [[ ! -f "$baseline" ]]; then
  echo "missing baseline: $baseline" >&2
  exit 1
fi

if [[ -e "$output" && "${WE_SKILL_AUDIT_OVERWRITE:-0}" != "1" ]]; then
  echo "output exists: $output" >&2
  echo "set WE_SKILL_AUDIT_OVERWRITE=1 to overwrite" >&2
  exit 1
fi

mkdir -p "$(dirname "$output")"
cp "$baseline" "$output"

cat <<EOF
baseline=$baseline
output=$output
EOF
