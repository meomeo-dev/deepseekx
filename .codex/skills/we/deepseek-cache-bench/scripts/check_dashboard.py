#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


SKIP_DIRS = {"node_modules", ".git", "dist", "build", "coverage"}
SKIP_SUFFIXES = {".lock", ".png", ".jpg", ".jpeg", ".gif", ".webp"}


def first_party_files(root: Path):
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(root)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        if path.suffix in SKIP_SUFFIXES:
            continue
        yield path, rel


def count_lines(root: Path):
    files = []
    total = 0
    for path, rel in first_party_files(root):
        text = path.read_text(encoding="utf-8", errors="ignore")
        lines = text.splitlines()
        total += len(lines)
        files.append((len(lines), str(rel)))
    files.sort(reverse=True)
    return {"lineCount": total, "fileCount": len(files), "topFiles": files[:20]}


def has_runnable_entry(root: Path):
    package_json = root / "package.json"
    if not package_json.exists():
        return False
    try:
        data = json.loads(package_json.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return False
    scripts = data.get("scripts") or {}
    return any(name in scripts for name in ("dev", "start", "preview"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", default=".")
    parser.add_argument("--min-lines", type=int, default=10000)
    args = parser.parse_args()

    root = Path(args.workspace).resolve()
    result = count_lines(root)
    result["hasRunnableEntry"] = has_runnable_entry(root)
    print(json.dumps(result, indent=2))

    if result["lineCount"] < args.min_lines:
        raise SystemExit("line count below required minimum")
    if not result["hasRunnableEntry"]:
        raise SystemExit("missing dev/start/preview package script")


if __name__ == "__main__":
    main()
