#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_dir="$(cd "$script_dir/.." && pwd)"
bundle_root="${WE_SKILL_INIT_BUNDLE_ROOT:-$skill_dir/templates/bundles}"
bundle_manifest="${WE_SKILL_INIT_MANIFEST:-$skill_dir/templates/bundles.yaml}"
load_context_script="$script_dir/load_context.sh"
export_context_script="${WE_SKILL_INIT_EXPORT_SCRIPT:-$script_dir/export_context.sh}"
render_script="$script_dir/render_placeholders.sh"

target_root="${WE_SKILL_INIT_ROOT:-}"
if [[ -z "$target_root" ]]; then
  target_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi

target_we_dir="$target_root/.agents/skills"
state_file="${WE_SKILL_INIT_STATE_FILE:-$target_we_dir/.we-skill-init-state}"
force="${WE_SKILL_INIT_FORCE:-0}"
overwrite="${WE_SKILL_INIT_OVERWRITE:-0}"

if [[ -f "$state_file" && "$force" != "1" ]]; then
  echo "already_initialized=$state_file" >&2
  echo "set WE_SKILL_INIT_FORCE=1 to run again" >&2
  exit 1
fi

for required in "$bundle_root" "$bundle_manifest" "$load_context_script" \
  "$export_context_script" "$render_script"; do
  if [[ ! -e "$required" ]]; then
    echo "missing required path: $required" >&2
    exit 1
  fi
done

if [[ ! -x "$load_context_script" || ! -x "$export_context_script" || \
  ! -x "$render_script" ]]; then
  echo "helper scripts must be executable" >&2
  exit 1
fi

mkdir -p "$target_we_dir"
export WE_SKILL_INIT_EXPORT_SCRIPT="$export_context_script"
. "$load_context_script"

copied=()
skipped=()
excluded=("we-skill-init" "we-skill-maker")

for bundle in "$bundle_root"/*; do
  [[ -d "$bundle" ]] || continue
  name="$(basename "$bundle")"
  case "$name" in
    we-skill-init|we-skill-maker)
      continue
      ;;
  esac

  if [[ "$name" == we-* ]]; then
    skill_name="$name"
  else
    skill_name="we-$name"
  fi

  dest="$target_we_dir/$skill_name"
  if [[ -e "$dest" && "$overwrite" != "1" ]]; then
    skipped+=("$skill_name")
    continue
  fi

  if [[ -e "$dest" && "$overwrite" == "1" ]]; then
    rm -rf "$dest"
  fi
  mkdir -p "$dest"
  cp -R "$bundle/." "$dest/"
  "$render_script" "$dest"
  if [[ ! -f "$dest/SKILL.TEMPLATE" ]]; then
    echo "missing skill template: $bundle/SKILL.TEMPLATE" >&2
    exit 1
  fi
  mv "$dest/SKILL.TEMPLATE" "$dest/SKILL.md"
  copied+=("$skill_name")
done

{
  echo "initialized_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "source=we-skill-init"
  echo "template_schema=we-skill-bundle/v1"
  echo "template_version=$manifest_version"
  echo "source_commit=$source_commit"
  echo "bundle_manifest=$bundle_manifest"
  echo "bundle_manifest_hash=$manifest_hash"
  echo "bundle_tree_hash=$bundle_tree_hash"
  echo "project_type=$project_type"
  echo "target_root=$target_root"
  echo "bundle_root=$bundle_root"
  echo "force=$force"
  echo "overwrite=$overwrite"
  echo "copied=${copied[*]:-}"
  echo "skipped=${skipped[*]:-}"
  echo "excluded=${excluded[*]}"
} >"$state_file"

cat <<EOF
target_root=$target_root
state_file=$state_file
project_type=$project_type
template_version=$manifest_version
bundle_manifest_hash=$manifest_hash
bundle_tree_hash=$bundle_tree_hash
copied=${copied[*]:-}
skipped=${skipped[*]:-}
excluded=${excluded[*]}
EOF
