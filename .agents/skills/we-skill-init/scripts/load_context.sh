#!/usr/bin/env bash
set -euo pipefail

sha256_file() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{ print $1 }'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{ print $1 }'
  else
    echo "unknown"
  fi
}

sha256_stdin() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{ print $1 }'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{ print $1 }'
  else
    cat >/dev/null
    echo "unknown"
  fi
}

sha256_tree() {
  local root="$1"
  find "$root" -type f | LC_ALL=C sort |
    while IFS= read -r file; do
      printf '%s  %s\n' "$(sha256_file "$file")" "${file#$root/}"
    done |
    sha256_stdin
}

read_package_field() {
  local expr="$1"
  if [[ ! -f "$target_root/package.json" ]]; then
    return 0
  fi
  if ! command -v node >/dev/null 2>&1; then
    return 0
  fi
  node -e "
const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'))
const value = $expr
if (value !== undefined && value !== null) console.log(String(value))
" "$target_root/package.json" 2>/dev/null || true
}

repo_slug_from_url() {
  local url="$1"
  url="${url%.git}"
  printf '%s\n' "$url" |
    sed -nE 's#.*github.com[:/]([^/]+/[^/]+)$#\1#p'
}

repo_url_from_slug() {
  local slug="$1"
  if [[ "$slug" == */* ]]; then
    printf 'https://github.com/%s\n' "$slug"
  fi
}

project_type_from_files() {
  if [[ -n "${WE_SKILL_PROJECT_TYPE:-}" ]]; then
    echo "$WE_SKILL_PROJECT_TYPE"
  elif [[ -f "$target_root/package.json" && -n "$bin_name" ]]; then
    echo "npm-cli"
  elif [[ -f "$target_root/package.json" ]]; then
    echo "npm-package"
  elif [[ -f "$target_root/pyproject.toml" ]]; then
    echo "python"
  elif [[ -f "$target_root/Cargo.toml" ]]; then
    echo "rust"
  elif [[ -f "$target_root/go.mod" ]]; then
    echo "go"
  else
    echo "generic"
  fi
}

set_adaptation_status() {
  case "$project_type" in
    npm-cli)
      release_status="ready:npm-cli"
      release_guidance="- 当前模板可直接使用 npm CLI release 主流程。"
      publish_status="ready:npm-cli"
      publish_guidance="- 当前模板可直接使用 npm registry 发布和 CLI smoke 验证。"
      ;;
    npm-package)
      release_status="partial:npm-package"
      release_guidance="- 这是 npm package；发布前改写 CLI smoke checks。"
      publish_status="partial:npm-package"
      publish_guidance="- npm publish 可适用；临时安装验证需要改为 API 检查。"
      ;;
    *)
      release_status="needs-adaptation:${project_type}"
      release_guidance="- 先定义版本源、发布物、校验和发布渠道。"
      publish_status="needs-adaptation:${project_type}"
      publish_guidance="- 不要执行 npm publish；先改写为实际发布渠道。"
      ;;
  esac
}

manifest_version="$(
  awk -F': *' '$1 == "version" { print $2; exit }' "$bundle_manifest"
)"
manifest_version="${manifest_version:-unknown}"
manifest_hash="$(sha256_file "$bundle_manifest")"
bundle_tree_hash="$(sha256_tree "$bundle_root")"
source_commit="$(git -C "$skill_dir" rev-parse --short HEAD 2>/dev/null || true)"
source_commit="${source_commit:-unknown}"

project_name="$(basename "$target_root")"
origin_url="$(git -C "$target_root" remote get-url origin 2>/dev/null || true)"
pkg_name="$(read_package_field "pkg.name")"
bin_name="$(read_package_field "
typeof pkg.bin === 'string'
  ? pkg.name
  : Object.keys(pkg.bin ?? {})[0]
")"
pkg_repo_url="$(read_package_field "
typeof pkg.repository === 'string'
  ? pkg.repository
  : pkg.repository?.url
")"

private_repo_slug="${WE_SKILL_PRIVATE_REPO:-$(repo_slug_from_url "$origin_url")}"
if [[ "$private_repo_slug" != */* ]]; then
  private_repo_slug="OWNER/${project_name}"
fi

public_repo_slug="${WE_SKILL_PUBLIC_REPO:-$(repo_slug_from_url "$pkg_repo_url")}"
if [[ "$public_repo_slug" != */* ]]; then
  public_repo_slug="${private_repo_slug%-private}"
fi

private_repo_name="${private_repo_slug##*/}"
public_repo_name="${public_repo_slug##*/}"
private_remote_url="${origin_url:-https://github.com/${private_repo_slug}.git}"
public_remote_url="https://github.com/${public_repo_slug}.git"
private_repo_url="$(repo_url_from_slug "$private_repo_slug")"
public_repo_url="$(repo_url_from_slug "$public_repo_slug")"

package_name="${WE_SKILL_PACKAGE_NAME:-${pkg_name:-$project_name}}"
cli_bin="${WE_SKILL_CLI_BIN:-${bin_name:-$package_name}}"
cli_entry="$(read_package_field "
typeof pkg.bin === 'string'
  ? pkg.bin
  : Object.values(pkg.bin ?? {})[0]
")"
license="$(read_package_field "pkg.license")"
npm_access="$(read_package_field "pkg.publishConfig?.access")"
project_type="$(project_type_from_files)"
set_adaptation_status

public_root="${WE_SKILL_PUBLIC_ROOT:-${target_root}-public}"
worktree_root="${WE_SKILL_WORKTREE_ROOT:-${target_root}-wt}"
worktree_root_rel="${WE_SKILL_WORKTREE_ROOT_REL:-../$(basename "$worktree_root")}"
knowledge_dir="${WE_SKILL_PUBLIC_KNOWLEDGE_DIR:-docs/notes}"
experimental_path="${WE_SKILL_EXPERIMENTAL_RUNTIME_PATH:-experimental/example}"
tarball_prefix="${package_name#@}"
tarball_prefix="${tarball_prefix//\//-}"
artifact_prefix="${WE_SKILL_ARTIFACT_PREFIX:-$tarball_prefix}"
tarball_glob="${WE_SKILL_PACKAGE_TARBALL_GLOB:-${tarball_prefix}-*.tgz}"
tarball_pattern="${WE_SKILL_PACKAGE_TARBALL_PATTERN:-${tarball_prefix}-<version>.tgz}"

smoke_1="${WE_SKILL_SMOKE_COMMAND_1:-$cli_bin --help}"
smoke_2="${WE_SKILL_SMOKE_COMMAND_2:-$cli_bin --version}"
smoke_3="${WE_SKILL_SMOKE_COMMAND_3:-$cli_bin --help}"

context_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
default_export_script="$context_script_dir/export_context.sh"
export_context_script="${WE_SKILL_INIT_EXPORT_SCRIPT:-$default_export_script}"
. "$export_context_script"
