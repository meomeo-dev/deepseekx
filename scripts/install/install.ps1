Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Error @"
DeepSeekX standalone installer is not available yet.

This downstream repository intentionally refuses to run the upstream OpenAI
Codex installer because users may have both DeepSeekX and OpenAI Codex
installed. Running the old installer here could overwrite the user's codex
command or read/write the user's OpenAI Codex data.

Use the manual nightly artifacts workflow output, or install the npm package
when a DeepSeekX release is published.
"@
