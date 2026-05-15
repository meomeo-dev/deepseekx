#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
usage: trigger.sh --ref <ref> --target <target> --confirm RUN_NIGHTLY
                  [--retention-days <1-30>]

targets:
  linux-x64 linux-arm64 linux-bundle mac-x64 mac-arm64 mac-universal
  win-x64 win-arm64 win-bundle all
EOF
}

ref=""
target=""
confirm=""
retention_days="7"

is_valid_target() {
  case "$1" in
    linux-x64|linux-arm64|linux-bundle)
      return 0
      ;;
    mac-x64|mac-arm64|mac-universal)
      return 0
      ;;
    win-x64|win-arm64|win-bundle|all)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref)
      ref="${2:-}"
      shift 2
      ;;
    --target)
      target="${2:-}"
      shift 2
      ;;
    --confirm)
      confirm="${2:-}"
      shift 2
      ;;
    --retention-days)
      retention_days="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$ref" || -z "$target" ]]; then
  usage >&2
  exit 2
fi

if ! is_valid_target "$target"; then
  echo "invalid target: $target" >&2
  exit 2
fi

if [[ "$confirm" != "RUN_NIGHTLY" ]]; then
  echo "refusing to trigger; pass --confirm RUN_NIGHTLY" >&2
  exit 2
fi

if [[ ! "$retention_days" =~ ^[0-9]+$ ]]; then
  echo "--retention-days must be an integer" >&2
  exit 2
fi

if (( retention_days < 1 || retention_days > 30 )); then
  echo "--retention-days must be between 1 and 30" >&2
  exit 2
fi

origin_url="$(git remote get-url origin)"
repo="${origin_url#https://github.com/}"
repo="${repo#git@github.com:}"
repo="${repo%.git}"

if ! gh workflow view deepseekx-nightly-artifacts.yml --repo "$repo" >/dev/null; then
  echo "workflow is not visible on the remote default branch yet." >&2
  echo "merge .github/workflows/deepseekx-nightly-artifacts.yml first." >&2
  exit 1
fi

gh workflow run deepseekx-nightly-artifacts.yml \
  --repo "$repo" \
  --ref "$ref" \
  -f "target=$target" \
  -f "confirm_run=RUN_NIGHTLY" \
  -f "artifact_retention_days=$retention_days"

echo "triggered workflow=deepseekx-nightly-artifacts.yml"
echo "repo=$repo"
echo "ref=$ref"
echo "target=$target"
echo "artifact_retention_days=$retention_days"
