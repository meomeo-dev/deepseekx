# DeepSeekX

Chinese README: [README.zh-CN.md](README.zh-CN.md)

DeepSeekX is a downstream adaptation of OpenAI Codex CLI for DeepSeek API
usage. It keeps the local terminal coding-agent workflow while defaulting to
DeepSeek-oriented provider, model, packaging, and user-facing behavior.

The original upstream OpenAI Codex README is preserved as
[CODEX_README.md](CODEX_README.md) to reduce conflicts during future upstream
syncs.

## Install

Install from npm:

```shell
npm install -g @meomeo-dev/deepseekx@0.131.0-deepseekx.1
```

Run:

```shell
deepseekx
```

For one-off usage:

```shell
npx @meomeo-dev/deepseekx@0.131.0-deepseekx.1
```

Homebrew is not supported yet. GitHub Releases provide release notes and
optional tarball downloads.

## Quickstart

Set a DeepSeek API key and start DeepSeekX:

```shell
export DEEPSEEK_API_KEY="sk-..."
deepseekx
```

DeepSeekX uses its own user directory and does not read the original OpenAI
Codex user directory by default.

## Configuration

User-level config lives at `DEEPSEEKX_HOME/config.toml`. If `DEEPSEEKX_HOME`
is not set, the default user directory is `~/.deepseekx`, so the default file
is:

```text
~/.deepseekx/config.toml
```

Project-level config lives at the project root:

```text
.deepseekx/config.toml
```

Use project config for repository-specific model, sandbox, approval, MCP,
provider, or profile settings that should not become global user defaults.

Configuration precedence:

```text
command-line overrides -> project .deepseekx/config.toml ->
user DEEPSEEKX_HOME/config.toml -> built-in defaults
```

### User Config

Create `~/.deepseekx/config.toml`:

```toml
model_provider = "deepseek"
model = "deepseek-v4-pro"
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[model_providers.deepseek]
name = "DeepSeek"
base_url = "https://api.deepseek.com"
env_key = "DEEPSEEK_API_KEY"
wire_api = "chat"
requires_openai_auth = false
```

For a custom DeepSeek-compatible provider, keep the provider id in the
`deepseek-*` namespace:

```toml
model_provider = "deepseek-vendor-a"
model = "deepseek-v4-flash"

[model_providers.deepseek-vendor-a]
name = "Vendor A DeepSeek"
base_url = "https://vendor.example/v1"
env_key = "VENDOR_DEEPSEEK_API_KEY"
wire_api = "chat"
requires_openai_auth = false
```

### Project Config

Create `.deepseekx/config.toml` in a repository:

```toml
model = "deepseek-v4-flash"
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[profiles.pro]
model_provider = "deepseek"
model = "deepseek-v4-pro"
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[profiles.flash]
model_provider = "deepseek"
model = "deepseek-v4-flash"
approval_policy = "on-request"
sandbox_mode = "workspace-write"
```

Run with a profile:

```shell
deepseekx --profile pro
```

## Models

DeepSeekX currently exposes:

- `deepseek-v4-pro`
- `deepseek-v4-flash`

DeepSeek model metadata, base instructions, and personality templates are
maintained inside the DeepSeek provider catalog rather than loaded from the
OpenAI model catalog at runtime.

## Differences From OpenAI Codex

- The CLI command is `deepseekx`.
- The npm package is `@meomeo-dev/deepseekx`.
- User config defaults to `~/.deepseekx`.
- Project config defaults to `.deepseekx/config.toml`.
- DeepSeek auth uses `DEEPSEEK_API_KEY`.
- OpenAI login and unsupported IDE/app commands are hidden or disabled.
- Some upstream Codex features may stay unavailable until they are adapted for
  DeepSeekX.

## Release Channels

- npm is the primary install channel.
- GitHub Releases provide release notes and optional tarballs.
- Homebrew is not currently supported.

## License

This repository is licensed under the [Apache-2.0 License](LICENSE).

DeepSeekX is a downstream fork of OpenAI Codex. See
[CODEX_README.md](CODEX_README.md) for the preserved upstream README.
