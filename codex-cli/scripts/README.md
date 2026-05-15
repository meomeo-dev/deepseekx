# npm releases

Use the staging helper in the repo root to generate npm tarballs for a release. For
example, to stage the CLI, responses proxy, and SDK packages for version `0.6.0`:

```bash
./scripts/stage_npm_packages.py \
  --release-version 0.6.0 \
  --package deepseekx \
  --package codex-responses-api-proxy \
  --package codex-sdk
```

This downloads the native artifacts once, hydrates `vendor/` for each package,
and writes tarballs to `dist/npm/`.

When `--package deepseekx` is provided, the staging helper builds the
lightweight `@meomeo-dev/deepseekx` meta package plus all platform-native
variants that are later published under platform-specific dist-tags.

Inside the DeepSeekX nightly artifact workflow, use `--artifacts-dir` after
`actions/download-artifact` has downloaded the platform artifacts:

```bash
./scripts/stage_npm_packages.py \
  --release-version 0.131.0-deepseekx.1 \
  --package deepseekx \
  --artifacts-dir artifacts \
  --output-dir dist/npm
```

If you need to invoke `build_npm_package.py` directly, run
`codex-cli/scripts/install_native_deps.py --workflow-url ...` first and pass
`--vendor-src` pointing to the directory that contains the populated
`vendor/` tree.
