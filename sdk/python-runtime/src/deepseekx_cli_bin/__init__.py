from __future__ import annotations

import os
from pathlib import Path

PACKAGE_NAME = "deepseekx-cli-bin"


def bundled_deepseekx_path() -> Path:
    exe = "deepseekx.exe" if os.name == "nt" else "deepseekx"
    path = Path(__file__).resolve().parent / "bin" / exe
    if not path.is_file():
        raise FileNotFoundError(
            f"{PACKAGE_NAME} is installed but missing its packaged deepseekx binary at {path}"
        )
    return path


__all__ = ["PACKAGE_NAME", "bundled_deepseekx_path"]
