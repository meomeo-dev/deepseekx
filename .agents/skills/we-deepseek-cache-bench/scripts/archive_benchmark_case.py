#!/usr/bin/env python3
import argparse
import json
import shutil
from pathlib import Path


def copy_tree(src, dst):
    if dst.exists():
        raise SystemExit(f"destination already exists: {dst}")
    ignore = shutil.ignore_patterns(
        "node_modules",
        ".git",
        "dist",
        "build",
        "coverage",
    )
    shutil.copytree(src, dst, ignore=ignore)


def write_manifest(case_dir, args):
    state_path = Path(args.report_dir) / "state.json"
    state = {}
    if state_path.exists():
        state = json.loads(state_path.read_text(encoding="utf-8"))
    turns = state.get("turnReports") or []
    efforts = sorted(
        {
            str(turn.get("reasoningEffort"))
            for turn in turns
            if turn.get("reasoningEffort")
        }
    )
    context_windows = [
        turn.get("modelContextWindow")
        for turn in turns
        if turn.get("modelContextWindow")
    ]
    manifest = {
        "caseId": args.case_id,
        "model": state.get("model", "deepseek-v4-pro"),
        "modelProvider": state.get("modelProvider", "deepseek"),
        "threadId": state.get("threadId"),
        "previewPort": args.preview_port,
        "reasoningEfforts": efforts,
        "modelContextWindow": context_windows[-1] if context_windows else None,
        "lineCount": state.get("lineCount"),
        "workspaceSource": str(Path(args.workspace).resolve()),
        "reportSource": str(Path(args.report_dir).resolve()),
        "startCommand": args.start_command,
        "notes": args.notes,
    }
    (case_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--case-id", required=True)
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--report-dir", required=True)
    parser.add_argument("--output-root", required=True)
    parser.add_argument("--preview-port", type=int, default=5173)
    parser.add_argument("--start-command", required=True)
    parser.add_argument("--notes", default="")
    args = parser.parse_args()

    case_dir = Path(args.output_root).resolve() / args.case_id
    case_dir.mkdir(parents=True, exist_ok=False)
    copy_tree(Path(args.workspace).resolve(), case_dir / "project")
    copy_tree(Path(args.report_dir).resolve(), case_dir / "experiment")
    (case_dir / "RUN_COMMAND.txt").write_text(
        args.start_command.strip() + "\n",
        encoding="utf-8",
    )
    write_manifest(case_dir, args)
    print(case_dir)


if __name__ == "__main__":
    main()
