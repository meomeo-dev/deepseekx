#!/usr/bin/env bash
set -euo pipefail

container_name="${1:-deepseekx-cache-bench}"
preview_port="${3:-5173}"
image_name="${4:-deepseek-cache-bench:local}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_dir="$(cd "${script_dir}/.." && pwd)"
env_file="${2:-${skill_dir}/../../../DEEPSEEK_API_KEY.env}"

if [[ -d "${env_file}" ]]; then
  env_file="${env_file}/DEEPSEEK_API_KEY.env"
fi

if [[ ! -f "${env_file}" ]]; then
  echo "missing env file: ${env_file}" >&2
  exit 1
fi

env_file="$(cd "$(dirname "${env_file}")" && pwd)/$(basename "${env_file}")"

docker build \
  -t "${image_name}" \
  -f "${script_dir}/Dockerfile" \
  "${script_dir}"

docker run -d --name "${container_name}" \
  --env-file "${env_file}" \
  -p "${preview_port}:${preview_port}" \
  -v "${skill_dir}:/skill:ro" \
  -v "${container_name}-state:/bench" \
  "${image_name}" \
  sleep infinity
