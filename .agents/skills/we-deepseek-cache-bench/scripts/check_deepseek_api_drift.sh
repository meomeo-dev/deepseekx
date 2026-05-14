#!/usr/bin/env bash
set -euo pipefail

docs_root="${DEEPSEEK_API_DOCS_ROOT:-docs/deepseek-api}"
fetcher="${docs_root}/fetch_deepseek_docs.mjs"
snapshots="${docs_root}/snapshots"

section() {
  printf '\n== %s ==\n' "$1"
}

section "preflight"
echo "docs_root=$docs_root"
if [[ ! -f "$fetcher" ]]; then
  echo "missing_fetcher=$fetcher" >&2
  exit 2
fi
if [[ ! -d "$snapshots" ]]; then
  echo "missing_snapshots=$snapshots" >&2
  exit 2
fi
if ! command -v node >/dev/null 2>&1; then
  echo "node=missing" >&2
  exit 2
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

mkdir -p "$tmp/deepseek-api"
cp "$fetcher" "$tmp/deepseek-api/fetch_deepseek_docs.mjs"
if [[ -f "${docs_root}/sources.yaml" ]]; then
  cp "${docs_root}/sources.yaml" "$tmp/deepseek-api/sources.yaml"
fi

section "fetch"
(
  cd "$tmp/deepseek-api"
  node fetch_deepseek_docs.mjs
)
echo "temp_snapshots=$tmp/deepseek-api/snapshots"

section "diff"
set +e
diff -ru --exclude='*.tmp' "$snapshots" "$tmp/deepseek-api/snapshots"
status=$?
set -e

case "$status" in
  0)
    echo "drift=none"
    ;;
  1)
    echo "drift=detected"
    exit 1
    ;;
  *)
    echo "drift=check_failed"
    exit "$status"
    ;;
esac
