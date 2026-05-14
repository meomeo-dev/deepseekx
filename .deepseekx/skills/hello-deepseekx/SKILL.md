---
name: hello-deepseekx
description: Introduce the DeepSeekX development story, architecture decisions, and DeepSeek API integration design. Use when asked about DeepSeekX project background, why certain design choices were made, how the OpenAI Codex fork was adapted for DeepSeek API, or when onboarding new contributors.
---

# DeepSeekX Development Story

DeepSeekX is a downstream adaptation of OpenAI Codex CLI, rebuilt to use the DeepSeek API as its primary model backend. It follows a **shell-first strategy**: change what the user sees (CLI, TUI, config, packaging) while preserving internal crate names, wire protocols, and core types to minimize upstream merge conflicts.

## Core Architecture Decisions

### Shell-First Rebranding

DeepSeekX adopts an isolation-first approach:

- **User-facing surfaces** use DeepSeekX naming: CLI binary (`deepseekx`), TUI branding, config home (`DEEPSEEKX_HOME` / `~/.deepseekx`), npm/Python packages.
- **Internal naming** retains Codex: Rust crates (`codex-core`, `codex-tui`), app-server v2 wire schema (`codexErrorInfo`), Bazel targets, test fixtures.
- No `codex` alias, shim, or fallback is shipped; DeepSeekX never reads `CODEX_HOME` or `~/.codex`.

### Protocol Adaptation: Responses → Chat Completions

The upstream Codex uses OpenAI Responses API (`POST /responses`). DeepSeek exposes Chat Completions (`POST /chat/completions`). The integration requires a full protocol adapter, not just a `base_url` config change. Key challenges: request conversion (Prompt → DeepSeek messages[]), response conversion (SSE chunks → internal ResponseEvent), reasoning content preservation across tool-call rounds (highest risk), hosted tool capability narrowing, and `apply_patch` parity.

### Provider Model

Uses `profile + provider` for multi-vendor support. Provider ID `deepseek` / `deepseek-*` triggers DeepSeek runtime. Default API key env var: `DEEPSEEK_API_KEY`. Static model catalog with 384K default context window, optional `[1m]` suffix for 1M.

## Reference Documents

When more detail is needed, load the appropriate reference file:

- **Integration assessment**: [references/integration-assessment.md](references/integration-assessment.md) — full capability mapping, protocol design, risk analysis, acceptance criteria.
- **User-facing surface**: [references/user-facing-surface.md](references/user-facing-surface.md) — rebranding boundary, phased rollout, naming rules.
- **OpenAI interface analysis**: [references/openai-interface-analysis.md](references/openai-interface-analysis.md) — upstream Responses API surface that DeepSeekX adapts.

## Key Design Principles

- **Isolation**: DeepSeekX and OpenAI Codex coexist; no shared config or binary collision.
- **Upstream compatibility**: Internal Codex naming preserved to reduce merge conflicts.
- **Capability narrowing**: Unsupported features disabled explicitly, not silently broken.
- **Provider parity**: `apply_patch` behaves identically across backends.
- **No silent auth migration**: Credential migration from `~/.codex` requires explicit user action.
