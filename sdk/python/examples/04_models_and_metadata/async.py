import sys
from pathlib import Path

_EXAMPLES_ROOT = Path(__file__).resolve().parents[1]
if str(_EXAMPLES_ROOT) not in sys.path:
    sys.path.insert(0, str(_EXAMPLES_ROOT))

from _bootstrap import ensure_local_sdk_src, runtime_config, server_label

ensure_local_sdk_src()

import asyncio

from deepseekx import AsyncDeepSeekX


async def main() -> None:
    async with AsyncDeepSeekX(config=runtime_config()) as deepseekx:
        print("server:", server_label(deepseekx.metadata))
        models = await deepseekx.models()
        print("models.count:", len(models.data))
        print("models:", ", ".join(model.id for model in models.data[:5]) or "[none]")


if __name__ == "__main__":
    asyncio.run(main())
