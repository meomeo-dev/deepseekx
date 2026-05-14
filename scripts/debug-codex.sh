#!/bin/bash

# Set "chatgpt.cliExecutable":
# "/Users/<USERNAME>/code/deepseekx/scripts/debug-codex.sh" in VS Code settings
# to always get the latest DeepSeekX binary when debugging the extension.


set -euo pipefail

CODEX_RS_DIR=$(realpath "$(dirname "$0")/../codex-rs")
(cd "$CODEX_RS_DIR" && cargo run --quiet --bin deepseekx -- "$@")
