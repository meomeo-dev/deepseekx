# Getting Started

This is the fastest path from install to a multi-turn thread using the public SDK surface.

The SDK is experimental. Treat the API, bundled runtime strategy, and packaging details as unstable until the first public release.

## 1) Install

From repo root:

```bash
cd sdk/python
uv sync
source .venv/bin/activate
```

Requirements:

- Python `>=3.10`
- uv
- installed `deepseekx-cli-bin` runtime package, or an explicit `deepseekx_bin` override
- local DeepSeekX auth/session configured

## 2) Run your first turn (sync)

```python
from deepseekx import DeepSeekX

with DeepSeekX() as deepseekx:
    server = deepseekx.metadata.serverInfo
    print("Server:", None if server is None else server.name, None if server is None else server.version)

    thread = deepseekx.thread_start(model="deepseek-v4-pro", config={"model_reasoning_effort": "high"})
    result = thread.run("Say hello in one sentence.")

    print("Thread:", thread.id)
    print("Text:", result.final_response)
    print("Items:", len(result.items))
```

What happened:

- `DeepSeekX()` started and initialized `deepseekx app-server`.
- `thread_start(...)` created a thread.
- `thread.run("...")` started a turn, consumed events until completion, and returned the final assistant response plus collected items and usage.
- `result.final_response` is `None` when no final-answer or phase-less assistant message item completes for the turn.
- use `thread.turn(...)` when you need a `TurnHandle` for streaming, steering, interrupting, or turn IDs/status
- one client can consume multiple active turns concurrently; turn streams are routed by turn ID

## 3) Continue the same thread (multi-turn)

```python
from deepseekx import DeepSeekX

with DeepSeekX() as deepseekx:
    thread = deepseekx.thread_start(model="deepseek-v4-pro", config={"model_reasoning_effort": "high"})

    first = thread.run("Summarize Rust ownership in 2 bullets.")
    second = thread.run("Now explain it to a Python developer.")

    print("first:", first.final_response)
    print("second:", second.final_response)
```

## 4) Async parity

Use `async with AsyncDeepSeekX()` as the normal async entrypoint. `AsyncDeepSeekX`
initializes lazily, and context entry makes startup/shutdown explicit.

```python
import asyncio
from deepseekx import AsyncDeepSeekX


async def main() -> None:
    async with AsyncDeepSeekX() as deepseekx:
        thread = await deepseekx.thread_start(model="deepseek-v4-pro", config={"model_reasoning_effort": "high"})
        result = await thread.run("Continue where we left off.")
        print(result.final_response)


asyncio.run(main())
```

## 5) Resume an existing thread

```python
from deepseekx import DeepSeekX

THREAD_ID = "thr_123"  # replace with a real id

with DeepSeekX() as deepseekx:
    thread = deepseekx.thread_resume(THREAD_ID)
    result = thread.run("Continue where we left off.")
    print(result.final_response)
```

## 6) Public app-server types

The convenience wrappers live at the package root. Public app-server value and
event types live under:

```python
from deepseekx.types import ThreadReadResponse, Turn, TurnStatus
```

## 7) Next stops

- API surface and signatures: `docs/api-reference.md`
- Common decisions/pitfalls: `docs/faq.md`
- End-to-end runnable examples: `examples/README.md`
