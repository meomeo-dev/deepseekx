# DeepSeekX CLI Runtime for Python SDK

Platform-specific runtime package consumed by the published `deepseekx`.

This package is staged during release so the SDK can pin an exact DeepSeekX CLI
version without checking platform binaries into the repo.

`deepseekx-cli-bin` is intentionally wheel-only. Do not build or publish an
sdist for this package.
