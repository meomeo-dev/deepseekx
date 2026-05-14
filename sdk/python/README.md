# DeepSeekX Python SDK (Experimental)

Experimental Python SDK for `deepseekx app-server` JSON-RPC v2 over stdio, with a small default surface optimized for real scripts and apps.

The generated wire-model layer is sourced from the pinned `deepseekx-cli-bin`
runtime package and exposed as Pydantic models with snake_case Python fields
that serialize back to the app-server’s camelCase wire format.
The package root exports the ergonomic client API; public app-server value and
event types live in `deepseekx.types`.

## Install

```bash
cd sdk/python
uv sync
source .venv/bin/activate
```

Published SDK builds pin an exact `deepseekx-cli-bin` runtime dependency
with the same version as the SDK. For local repo development, either pass
`AppServerConfig(deepseekx_bin=...)` to point at a local build explicitly, or use
the repo examples/notebook bootstrap which installs the pinned runtime package
automatically.

## Quickstart

```python
from deepseekx import DeepSeekX

with DeepSeekX() as deepseekx:
    thread = deepseekx.thread_start(model="deepseek-v4-pro")
    result = thread.run("Say hello in one sentence.")
    print(result.final_response)
    print(len(result.items))
```

`result.final_response` is `None` when the turn completes without a final-answer
or phase-less assistant message item.

## Docs map

- Golden path tutorial: `docs/getting-started.md`
- API reference (signatures + behavior): `docs/api-reference.md`
- Common decisions and pitfalls: `docs/faq.md`
- Runnable examples index: `examples/README.md`
- Jupyter walkthrough notebook: `notebooks/sdk_walkthrough.ipynb`

## Examples

Start here:

```bash
cd sdk/python
python examples/01_quickstart_constructor/sync.py
python examples/01_quickstart_constructor/async.py
```

## Runtime packaging

The repo no longer checks DeepSeekX binaries into `sdk/python`.

Published SDK builds are pinned to an exact `deepseekx-cli-bin` package
version, and that runtime package carries the platform-specific binary for the
target wheel. The SDK package version and runtime package version must match.

For local repo development, the checked-in `sdk/python-runtime` package is only
a template for staged release artifacts. Editable installs should use an
explicit `deepseekx_bin` override for manual SDK usage; the repo examples and
notebook bootstrap the pinned runtime package automatically.

## Maintainer workflow

```bash
cd sdk/python
uv sync
python scripts/update_sdk_artifacts.py generate-types
python scripts/update_sdk_artifacts.py \
  stage-sdk \
  /tmp/deepseekx-python-release/deepseekx \
  --deepseekx-version <deepseekx-release-tag-or-pep440-version>
python scripts/update_sdk_artifacts.py \
  stage-runtime \
  /tmp/deepseekx-python-release/deepseekx-cli-bin \
  /path/to/deepseekx \
  --deepseekx-version <deepseekx-release-tag-or-pep440-version>
```

Pass `--platform-tag ...` to `stage-runtime` when the wheel should be tagged for
a Rust target that differs from the Python build host. The intended one-off
matrix is `macosx_11_0_arm64`, `macosx_10_9_x86_64`,
`musllinux_1_1_aarch64`, `musllinux_1_1_x86_64`, `win_arm64`, and
`win_amd64`.

This supports the CI release flow:

- run `generate-types` before packaging
- stage `deepseekx` once with an exact `deepseekx-cli-bin==...` dependency
- stage `deepseekx-cli-bin` on each supported platform runner with the same pinned runtime version
- build and publish `deepseekx-cli-bin` as platform wheels only through PyPI trusted publishing; do not publish an sdist

## Compatibility and versioning

- Package: `deepseekx`
- Runtime package: `deepseekx-cli-bin`
- Python: `>=3.10`
- Target protocol: DeepSeekX `app-server` JSON-RPC v2
- Versioning rule: the SDK package version is the underlying DeepSeekX runtime version

## Notes

- `DeepSeekX()` is eager and performs startup + `initialize` in the constructor.
- Use context managers (`with DeepSeekX() as deepseekx:`) to ensure shutdown.
- Prefer `thread.run("...")` for the common case. Use `thread.turn(...)` when
  you need streaming, steering, or interrupt control.
- For transient overload, use `retry_on_overload` from the package root.
