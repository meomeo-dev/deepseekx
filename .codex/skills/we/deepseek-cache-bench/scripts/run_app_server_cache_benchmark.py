#!/usr/bin/env python3
import argparse
import json
import os
import shutil
import signal
import subprocess
import time
import uuid
from pathlib import Path


def load_prompts(path: Path, preview_port: int):
    raw = json.loads(path.read_text(encoding="utf-8"))
    prompts = []
    for item in raw:
        source = item["prompt"]
        prompt = "\n".join(source) if isinstance(source, list) else source
        prompt = prompt.replace("${preview_port}", str(preview_port))
        prompts.append({"name": item["name"], "prompt": prompt})
    return prompts


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


def count_lines(workspace: Path):
    script = Path(__file__).with_name("check_dashboard.py")
    try:
        out = subprocess.check_output(
            [
                "python3",
                str(script),
                "--workspace",
                str(workspace),
                "--min-lines",
                "10000",
            ],
            text=True,
        )
        return json.loads(out)
    except Exception as exc:
        return {"error": str(exc)}


class AppServerClient:
    def __init__(self, codex_bin, cwd, env, log_path):
        self.proc = subprocess.Popen(
            [str(codex_bin), "app-server"],
            cwd=str(cwd),
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
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
                err = self.proc.stderr.read()
                raise RuntimeError(f"codex exited {self.proc.returncode}: {err}")
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
            entry["text"] = (item.get("text") or "")[:1200]
        elif item_type == "commandExecution":
            output = item.get("aggregatedOutput") or ""
            entry["status"] = item.get("status")
            entry["command"] = item.get("command")
            entry["exitCode"] = item.get("exitCode")
            entry["outputTail"] = output[-1200:]
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

    def drain_turn(self, thread_id, turn_id, timeout=2400):
        deadline = time.time() + timeout
        while time.time() < deadline:
            msg = self.read_msg(max(1, int(deadline - time.time())))
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
        err = self.proc.stderr.read() if self.proc.stderr else ""
        return err


def status_value(turn):
    raw = turn.get("status")
    return raw.get("type") if isinstance(raw, dict) else raw


def write_config(codex_home: Path, template: Path | None):
    codex_home.mkdir(parents=True, exist_ok=True)
    if template:
        shutil.copyfile(template, codex_home / "config.toml")
        return
    (codex_home / "config.toml").write_text(
        "\n".join(
            [
                'model_provider = "deepseek"',
                'model = "deepseek-v4-pro"',
                'model_reasoning_effort = "high"',
                'approval_policy = "never"',
                'sandbox_mode = "danger-full-access"',
                "model_context_window = 384000",
                "",
            ]
        ),
        encoding="utf-8",
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--codex-bin", required=True)
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--codex-home", required=True)
    parser.add_argument("--prompts", required=True)
    parser.add_argument("--report-dir", required=True)
    parser.add_argument("--config-template")
    parser.add_argument("--preview-port", type=int, default=5173)
    parser.add_argument("--effort", default=DEFAULT_REASONING_EFFORT)
    parser.add_argument("--clean", action="store_true")
    args = parser.parse_args()

    workspace = Path(args.workspace).resolve()
    report_dir = Path(args.report_dir).resolve()
    codex_home = Path(args.codex_home).resolve()
    prompts = load_prompts(Path(args.prompts), args.preview_port)

    report_dir.mkdir(parents=True, exist_ok=True)
    workspace.mkdir(parents=True, exist_ok=True)
    if args.clean:
        for child in workspace.iterdir():
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()

    template = Path(args.config_template) if args.config_template else None
    write_config(codex_home, template)

    log_path = report_dir / "jsonrpc.log"
    log_path.write_text("", encoding="utf-8")
    report_json = report_dir / "report.json"
    report_md = report_dir / "report.md"

    env = os.environ.copy()
    env["CODEX_HOME"] = str(codex_home)
    client = AppServerClient(args.codex_bin, workspace, env, log_path)
    turn_reports = []

    try:
        started_at = time.time()
        client.request(
            "initialize",
            {
                "clientInfo": {
                    "name": "deepseek-cache-bench",
                    "title": "deepseek-cache-bench",
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
        thread = client.request(
            "thread/start",
            {
                "model": "deepseek-v4-pro",
                "modelProvider": "deepseek",
                "cwd": str(workspace),
                "approvalPolicy": "never",
                "sandbox": "danger-full-access",
            },
        )
        thread_id = thread["thread"]["id"]

        for index, item in enumerate(prompts, start=1):
            client.current_turn_index = index
            client.current_turn_items.clear()
            before_usage_count = len(client.usage_events)
            turn_start = time.time()
            turn = client.request(
                "turn/start",
                {
                    "threadId": thread_id,
                    "input": [
                        {
                            "type": "text",
                            "text": item["prompt"],
                            "textElements": [],
                        }
                    ],
                    "cwd": str(workspace),
                    "approvalPolicy": "never",
                    "sandboxPolicy": {"type": "dangerFullAccess"},
                    "effort": args.effort,
                },
            )
            completed = client.drain_turn(thread_id, turn["turn"]["id"])
            new_usage = client.usage_events[before_usage_count:]
            turn_id = turn["turn"]["id"]
            current_usage = [
                event for event in new_usage if event.get("turnId") == turn_id
            ]
            final_event = current_usage[-1] if current_usage else {}
            final_token_usage = final_event.get("tokenUsage") or {}
            usage = sum_last_usage(current_usage)
            context_window = final_token_usage.get("modelContextWindow")
            turn_reports.append(
                {
                    "turnIndex": index,
                    "name": item["name"],
                    "status": status_value(completed),
                    "elapsedSeconds": round(time.time() - turn_start, 3),
                    "reasoningEffort": args.effort,
                    "modelContextWindow": context_window,
                    "requestCount": len(current_usage),
                    "usage": usage,
                    "usageScope": "sum(tokenUsage.last) for current turnId",
                    "finalRequestUsage": final_token_usage.get("last") or {},
                    "cumulativeUsage": final_token_usage.get("total") or {},
                    "cacheHitRate": cache_rate(usage),
                    "items": list(client.current_turn_items),
                }
            )
            partial = {
                "model": "deepseek-v4-pro",
                "modelProvider": "deepseek",
                "threadId": thread_id,
                "turnReports": turn_reports,
                "usageEvents": client.usage_events,
                "lineCount": count_lines(workspace),
            }
            report_json.write_text(
                json.dumps(partial, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

        final = {
            "model": "deepseek-v4-pro",
            "modelProvider": "deepseek",
            "workspace": str(workspace),
            "codexHome": str(codex_home),
            "previewPort": args.preview_port,
            "elapsedSeconds": round(time.time() - started_at, 3),
            "turnReports": turn_reports,
            "usageEvents": client.usage_events,
            "lineCount": count_lines(workspace),
        }
        report_json.write_text(
            json.dumps(final, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        report_md.write_text(markdown_report(final), encoding="utf-8")
        print(report_md.read_text(encoding="utf-8"))
    finally:
        err = client.close()
        if err:
            (report_dir / "stderr.log").write_text(err, encoding="utf-8")


def markdown_report(report):
    rows = []
    for turn in report["turnReports"]:
        usage = turn.get("usage") or {}
        input_tokens = usage.get("inputTokens") or 0
        cached = usage.get("cachedInputTokens") or 0
        rate = turn.get("cacheHitRate")
        rate_text = f"{rate:.4%}" if rate is not None else "n/a"
        rows.append(
            f"| {turn['turnIndex']} | {turn['status']} | "
            f"{turn.get('reasoningEffort', 'n/a')} | "
            f"{turn.get('modelContextWindow', 'n/a')} | "
            f"{turn.get('requestCount', 'n/a')} | "
            f"{turn['elapsedSeconds']} | {input_tokens} | {cached} | "
            f"{input_tokens - cached} | {rate_text} |"
        )
    return (
        "# DeepSeek Cache Benchmark\n\n"
        f"- model: {report['model']}\n"
        f"- modelProvider: {report['modelProvider']}\n"
        f"- workspace: {report['workspace']}\n"
        f"- preview port: {report['previewPort']}\n"
        f"- first-party lines: {report['lineCount'].get('lineCount')}\n"
        f"- first-party files: {report['lineCount'].get('fileCount')}\n"
        f"- elapsed seconds: {report['elapsedSeconds']}\n\n"
        "| turn | status | effort | context | requests | seconds | input | "
        "cached | miss | hit rate |\n"
        "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | "
        "---: |\n"
        + "\n".join(rows)
        + "\n"
    )


if __name__ == "__main__":
    main()
