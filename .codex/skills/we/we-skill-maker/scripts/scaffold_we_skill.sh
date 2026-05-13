#!/usr/bin/env bash
set -euo pipefail

name="${1:-}"
description="${2:-}"

if [[ -z "${name}" || -z "${description}" ]]; then
  echo "usage: $0 <short_name> <description>" >&2
  exit 2
fi

if [[ ! "${name}" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "short_name must be lowercase kebab-case" >&2
  exit 2
fi

skill_dir=".codex/skills/we/${name}"
skill_file="${skill_dir}/SKILL.md"

if [[ -e "${skill_dir}" ]]; then
  echo "skill already exists: ${skill_dir}" >&2
  exit 1
fi

mkdir -p "${skill_dir}"
cat > "${skill_file}" <<EOF
---
name: we:${name}
description: ${description}
---

# ${name}

Use this skill when ...

## Invariants

- ...

## Workflow

1. ...

## Validation

\`\`\`bash
# Add focused checks here.
\`\`\`

## Final Response

Report:

- ...
EOF

echo "${skill_file}"
