#!/usr/bin/env bash
set -euo pipefail

container_name="${1:-deepseekx-cache-bench}"
repo_root="${2:-$(pwd)}"
preview_port="${3:-5173}"
image_name="${4:-deepseek-cache-bench:local}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

docker build \
  -t "${image_name}" \
  -f "${script_dir}/Dockerfile" \
  "${script_dir}"

docker run -d --name "${container_name}" \
  --env-file DEEPSEEK_API_KEY.env \
  -p "${preview_port}:${preview_port}" \
  -v "${repo_root}:/src:ro" \
  -v "${container_name}-state:/bench" \
  "${image_name}" \
  sleep infinity
