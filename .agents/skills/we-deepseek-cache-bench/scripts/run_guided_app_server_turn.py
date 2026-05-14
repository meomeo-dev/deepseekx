#!/usr/bin/env python3
import argparse
import json
import os
import signal
import subprocess
import time
import uuid
from pathlib import Path


SKIP_DIRS = {"node_modules", ".git", "dist", "build", "coverage"}
SKIP_SUFFIXES = {".lock", ".png", ".jpg", ".jpeg", ".gif", ".webp"}


def cache_rate(usage):
    input_tokens = usage.get("inputTokens", 0) or 0
    cached = usage.get("cachedInputTokens", 0) or 0
    return cached / input_tokens if input_tokens else None


DEFAULT_REASONING_EFFORT = "high"


def empty_usage():
    return {
        "totalTokens": 0,
        "inputTokens": 0,
        "cachedInputTokens": 0,
        "outputTokens": 0,
        "reasoningOutputTokens": 0,
    }


def sum_last_usage(events):
    usage = empty_usage()
    for event in events:
        last = event.get("tokenUsage", {}).get("last") or {}
        for key in usage:
            usage[key] += last.get(key) or 0
    return usage


def status_value(turn):
    raw = turn.get("status")
    return raw.get("type") if isinstance(raw, dict) else raw


def resolve_prompt(args):
    if args.prompt_file and args.turn_name:
        return args.turn_name, Path(args.prompt_file).read_text(encoding="utf-8")
    raise SystemExit(
        "provide both --prompt-file and --turn-name for the dynamic turn"
    )


def first_party_files(root):
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(root)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        if path.suffix.lower() in SKIP_SUFFIXES:
            continue
        yield path, rel


def count_lines(root):
    files = []
    total = 0
    for path, rel in first_party_files(root):
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        lines = text.splitlines()
        total += len(lines)
        files.append((len(lines), str(rel)))
    files.sort(reverse=True)
    return {
        "lineCount": total,
        "fileCount": len(files),
        "topFiles": files[:30],
    }


class AppServerClient:
    def __init__(self, codex_bin, cwd, env, log_path, stderr_path):
        self.stderr_file = stderr_path.open("a", encoding="utf-8")
        self.proc = subprocess.Popen(
            [str(codex_bin), "app-server"],
            cwd=str(cwd),
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=self.stderr_file,
            text=True,
            bufsize=1,
        )
        self.log_path = log_path
        self.messages = []
        self.usage_events = []
        self.current_turn_index = None
        self.current_turn_items = []

    def append_log(self, prefix, text):
        with self.log_path.open("a", encoding="utf-8") as fh:
            fh.write(prefix + text + "\n")

    def write(self, obj):
        line = json.dumps(obj, ensure_ascii=False)
        self.append_log("> ", line)
        self.proc.stdin.write(line + "\n")
        self.proc.stdin.flush()

    def read_msg(self, timeout=600):
        deadline = time.time() + timeout
        while time.time() < deadline:
            line = self.proc.stdout.readline()
            if line:
                self.append_log("< ", line.rstrip("\n"))
                try:
                    msg = json.loads(line)
                except json.JSONDecodeError:
                    continue
                self.messages.append(msg)
                return msg
            if self.proc.poll() is not None:
                raise RuntimeError(f"codex exited {self.proc.returncode}")
            time.sleep(0.05)
        raise TimeoutError("timed out waiting for app-server message")

    def respond(self, rid, result):
        self.write({"jsonrpc": "2.0", "id": rid, "result": result})

    def handle_msg(self, msg):
        method = msg.get("method")
        if method == "thread/tokenUsage/updated":
            event = msg["params"].copy()
            event["turnIndex"] = self.current_turn_index
            self.usage_events.append(event)
            return
        if method == "item/completed":
            item = msg.get("params", {}).get("item", {})
            self.current_turn_items.append(self.item_summary(item))
            return
        if "id" in msg and method == "item/commandExecution/requestApproval":
            self.respond(msg["id"], {"decision": "accept"})
            return
        if "id" in msg and method == "item/fileChange/requestApproval":
            self.respond(msg["id"], {"decision": "accept"})

    @staticmethod
    def item_summary(item):
        item_type = item.get("type")
        entry = {"type": item_type}
        if item_type == "agentMessage":
            entry["text"] = (item.get("text") or "")[:1600]
        elif item_type == "commandExecution":
            output = item.get("aggregatedOutput") or ""
            entry["status"] = item.get("status")
            entry["command"] = item.get("command")
            entry["exitCode"] = item.get("exitCode")
            entry["outputTail"] = output[-2000:]
        return entry

    def request(self, method, params=None, timeout=600):
        rid = str(uuid.uuid4())
        obj = {"jsonrpc": "2.0", "id": rid, "method": method}
        if params is not None:
            obj["params"] = params
        self.write(obj)
        while True:
            msg = self.read_msg(timeout)
            if msg.get("id") == rid:
                if "error" in msg:
                    raise RuntimeError(f"{method} error: {msg['error']}")
                return msg.get("result")
            self.handle_msg(msg)

    def notify(self, method, params=None):
        obj = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            obj["params"] = params
        self.write(obj)

    def drain_turn(self, thread_id, turn_id, timeout=3600):
        deadline = time.time() + timeout
        while time.time() < deadline:
            remaining = max(1, int(deadline - time.time()))
            msg = self.read_msg(remaining)
            self.handle_msg(msg)
            if msg.get("method") != "turn/completed":
                continue
            params = msg.get("params", {})
            turn = params.get("turn", {})
            if params.get("threadId") == thread_id and turn.get("id") == turn_id:
                return turn
        raise TimeoutError(f"turn {turn_id} did not complete")

    def close(self):
        if self.proc.poll() is None:
            self.proc.send_signal(signal.SIGTERM)
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        self.stderr_file.close()


def load_state(path):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"threadId": None, "turnReports": [], "usageEvents": []}


def write_reports(report_dir, state, workspace, codex_home, preview_port):
    state["workspace"] = str(workspace)
    state["deepseekxHome"] = str(codex_home)
    state["previewPort"] = preview_port
    state["lineCount"] = count_lines(workspace)
    state["model"] = "deepseek-v4-pro"
    state["modelProvider"] = "deepseek"

    (report_dir / "state.json").write_text(
        json.dumps(state, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (report_dir / "report.md").write_text(markdown_report(state), encoding="utf-8")


def markdown_report(report):
    rows = []
    for turn in report.get("turnReports", []):
        usage = turn.get("usage") or {}
        input_tokens = usage.get("inputTokens") or 0
        cached = usage.get("cachedInputTokens") or 0
        rate = turn.get("cacheHitRate")
        rate_text = f"{rate:.4%}" if rate is not None else "n/a"
        rows.append(
            f"| {turn['turnIndex']} | {turn['name']} | {turn['status']} | "
            f"{turn.get('reasoningEffort', 'n/a')} | "
            f"{turn.get('modelContextWindow', 'n/a')} | "
            f"{turn.get('requestCount', 'n/a')} | "
            f"{turn['elapsedSeconds']} | {input_tokens} | {cached} | "
            f"{input_tokens - cached} | {rate_text} |"
        )
    return (
        "# DeepSeek Guided Cache Benchmark\n\n"
        f"- model: {report.get('model')}\n"
        f"- modelProvider: {report.get('modelProvider')}\n"
        f"- threadId: {report.get('threadId')}\n"
        f"- workspace: {report.get('workspace')}\n"
        f"- preview port: {report.get('previewPort')}\n"
        f"- first-party lines: {report['lineCount'].get('lineCount')}\n"
        f"- first-party files: {report['lineCount'].get('fileCount')}\n\n"
        "| turn | name | status | effort | context | requests | seconds | "
        "input | cached | miss | hit rate |\n"
        "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | "
        "---: | ---: |\n"
        + "\n".join(rows)
        + "\n"
    )


def initialize(client):
    client.request(
        "initialize",
        {
            "clientInfo": {
                "name": "deepseekx-cache-bench-guided",
                "title": "deepseekx-cache-bench-guided",
                "version": "0",
            },
            "capabilities": {
                "experimentalApi": True,
                "requestAttestation": False,
                "optOutNotificationMethods": [
                    "item/agentMessage/delta",
                    "item/reasoning/textDelta",
                    "item/reasoning/summaryTextDelta",
                    "command/exec/outputDelta",
                    "item/commandExecution/outputDelta",
                ],
            },
        },
    )
    client.notify("initialized")


def start_or_resume_thread(client, state, workspace, new_thread):
    params = {
        "model": "deepseek-v4-pro",
        "modelProvider": "deepseek",
        "cwd": str(workspace),
        "approvalPolicy": "never",
        "sandbox": "danger-full-access",
    }
    if state.get("threadId") and not new_thread:
        params["threadId"] = state["threadId"]
        return client.request("thread/resume", params)
    return client.request("thread/start", params)


def run_turn(client, thread_id, workspace, prompt, turn_index, timeout, effort):
    before_usage_count = len(client.usage_events)
    client.current_turn_index = turn_index
    client.current_turn_items.clear()
    started = time.time()
    turn = client.request(
        "turn/start",
        {
            "threadId": thread_id,
            "input": [{"type": "text", "text": prompt, "textElements": []}],
            "cwd": str(workspace),
            "approvalPolicy": "never",
            "sandboxPolicy": {"type": "dangerFullAccess"},
            "effort": effort,
        },
    )
    completed = client.drain_turn(thread_id, turn["turn"]["id"], timeout)
    new_usage = client.usage_events[before_usage_count:]
    turn_id = turn["turn"]["id"]
    current_usage = [
        event for event in new_usage if event.get("turnId") == turn_id
    ]
    final_event = current_usage[-1] if current_usage else {}
    final_token_usage = final_event.get("tokenUsage") or {}
    usage = sum_last_usage(current_usage)
    context_window = final_token_usage.get("modelContextWindow")
    return {
        "status": status_value(completed),
        "elapsedSeconds": round(time.time() - started, 3),
        "reasoningEffort": effort,
        "modelContextWindow": context_window,
        "requestCount": len(current_usage),
        "usage": usage,
        "usageScope": "sum(tokenUsage.last) for current turnId",
        "finalRequestUsage": final_token_usage.get("last") or {},
        "cumulativeUsage": final_token_usage.get("total") or {},
        "cacheHitRate": cache_rate(usage),
        "items": list(client.current_turn_items),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--deepseekx-bin", dest="codex_bin")
    parser.add_argument("--codex-bin", dest="codex_bin")
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--deepseekx-home", dest="codex_home")
    parser.add_argument("--codex-home", dest="codex_home")
    parser.add_argument("--report-dir", required=True)
    parser.add_argument("--prompt-file")
    parser.add_argument("--turn-name")
    parser.add_argument("--preview-port", type=int, default=5173)
    parser.add_argument("--effort", default=DEFAULT_REASONING_EFFORT)
    parser.add_argument("--timeout", type=int, default=3600)
    parser.add_argument("--new-thread", action="store_true")
    args = parser.parse_args()
    if not args.codex_bin:
        parser.error("pass --deepseekx-bin")
    if not args.codex_home:
        parser.error("pass --deepseekx-home")

    workspace = Path(args.workspace).resolve()
    codex_home = Path(args.codex_home).resolve()
    report_dir = Path(args.report_dir).resolve()
    report_dir.mkdir(parents=True, exist_ok=True)
    workspace.mkdir(parents=True, exist_ok=True)
    codex_home.mkdir(parents=True, exist_ok=True)

    state_path = report_dir / "state.json"
    state = load_state(state_path)
    if args.new_thread and state.get("turnReports"):
        raise SystemExit("--new-thread requires an empty report directory")
    turn_index = len(state.get("turnReports", [])) + 1
    turn_name, prompt = resolve_prompt(args)
    prompt_archive = report_dir / f"prompt-{turn_index:02d}.md"
    prompt_archive.write_text(prompt, encoding="utf-8")
    log_path = report_dir / f"jsonrpc-turn-{turn_index}.log"
    stderr_path = report_dir / f"stderr-turn-{turn_index}.log"
    log_path.write_text("", encoding="utf-8")

    env = os.environ.copy()
    env["DEEPSEEKX_HOME"] = str(codex_home)
    env.pop("CODEX_HOME", None)
    client = AppServerClient(
        args.codex_bin,
        workspace,
        env,
        log_path,
        stderr_path,
    )
    try:
        initialize(client)
        thread = start_or_resume_thread(client, state, workspace, args.new_thread)
        thread_id = thread["thread"]["id"]
        state["threadId"] = thread_id
        result = run_turn(
            client,
            thread_id,
            workspace,
            prompt,
            turn_index,
            args.timeout,
            args.effort,
        )
        result["turnIndex"] = turn_index
        result["name"] = turn_name
        state.setdefault("turnReports", []).append(result)
        state.setdefault("usageEvents", []).extend(client.usage_events)
        write_reports(report_dir, state, workspace, codex_home, args.preview_port)
        print((report_dir / "report.md").read_text(encoding="utf-8"))
    finally:
        client.close()


if __name__ == "__main__":
    main()
