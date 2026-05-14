#!/usr/bin/env python3
import argparse
import json
import re
from html import escape
from pathlib import Path


def fmt_num(value):
    return f"{value:,}"


def fmt_pct(value):
    return f"{value:.4f}%"


def read_validation(path):
    if not path or not path.exists():
        return {"passed": None, "total": None, "failed": None, "utc": ""}
    text = path.read_text(encoding="utf-8", errors="ignore")
    utc = ""
    for line in text.splitlines():
        if line.startswith("validationUtc="):
            utc = line.split("=", 1)[1]
            break
    matches = re.findall(r"=== Results: (\d+)/(\d+) passed, (\d+) failed ===", text)
    if not matches:
        return {"passed": None, "total": None, "failed": None, "utc": utc}
    passed = sum(int(item[0]) for item in matches)
    total = sum(int(item[1]) for item in matches)
    failed = sum(int(item[2]) for item in matches)
    return {"passed": passed, "total": total, "failed": failed, "utc": utc}


def turn_rows(turns):
    rows = []
    for turn in turns:
        usage = turn.get("usage") or {}
        input_tokens = usage.get("inputTokens") or 0
        cached = usage.get("cachedInputTokens") or 0
        miss = input_tokens - cached
        rate = turn.get("cacheHitRate")
        rate_text = fmt_pct(rate * 100) if rate is not None else "n/a"
        rows.append(
            "<tr>"
            f"<td>{turn.get('turnIndex')}</td>"
            f"<td>{escape(turn.get('name', ''))}</td>"
            f"<td>{escape(str(turn.get('reasoningEffort', 'n/a')))}</td>"
            f"<td>{fmt_num(turn.get('modelContextWindow') or 0)}</td>"
            f"<td>{fmt_num(turn.get('requestCount') or 0)}</td>"
            f"<td>{fmt_num(input_tokens)}</td>"
            f"<td>{fmt_num(cached)}</td>"
            f"<td>{fmt_num(miss)}</td>"
            f"<td>{rate_text}</td>"
            "</tr>"
        )
    return "\n".join(rows)


def top_file_rows(top_files):
    rows = []
    for lines, path in top_files[:12]:
        rows.append(
            "<tr>"
            f"<td>{escape(path)}</td>"
            f"<td>{fmt_num(lines)}</td>"
            "</tr>"
        )
    return "\n".join(rows)


def build_html(state, validation, args):
    turns = state.get("turnReports", [])
    line_info = state.get("lineCount") or {}
    line_count = line_info.get("lineCount", 0)
    file_count = line_info.get("fileCount", 0)
    total_input = 0
    total_cached = 0
    for turn in turns:
        usage = turn.get("usage") or {}
        total_input += usage.get("inputTokens") or 0
        total_cached += usage.get("cachedInputTokens") or 0
    hit = (total_cached / total_input * 100) if total_input else 0
    total_miss = total_input - total_cached
    passed = validation["passed"]
    total = validation["total"]
    failed = validation["failed"]
    efforts = sorted(
        {
            str(turn.get("reasoningEffort"))
            for turn in turns
            if turn.get("reasoningEffort")
        }
    )
    effort_text = ", ".join(efforts) if efforts else "not recorded"
    context_values = [
        turn.get("modelContextWindow")
        for turn in turns
        if turn.get("modelContextWindow")
    ]
    context_text = "not recorded"
    if context_values:
        context_text = fmt_num(context_values[-1])
    validation_text = "not recorded"
    if total is not None:
        validation_text = f"{fmt_num(passed)}/{fmt_num(total)} passed"
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(args.title)}</title>
<style>
:root {{
  --ink: #17202a;
  --muted: #5d6773;
  --line: #d7dde5;
  --paper: #f7f9fc;
  --panel: #ffffff;
  --brand: #0f766e;
  --accent: #b45309;
}}
* {{ box-sizing: border-box; }}
body {{
  margin: 0;
  color: var(--ink);
  background: var(--paper);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;
}}
section {{
  min-height: 100vh;
  padding: 48px clamp(24px, 6vw, 76px);
  display: grid;
  align-content: center;
  gap: 24px;
  border-bottom: 1px solid var(--line);
}}
h1, h2 {{ margin: 0; letter-spacing: 0; line-height: 1.04; }}
h1 {{ font-size: clamp(42px, 7vw, 84px); max-width: 980px; }}
h2 {{ font-size: clamp(32px, 5vw, 54px); }}
p, li {{ color: var(--muted); font-size: 20px; }}
.kicker {{
  color: var(--brand);
  font-size: 14px;
  font-weight: 760;
  letter-spacing: .08em;
  text-transform: uppercase;
}}
.grid {{ display: grid; gap: 18px; }}
.cols-4 {{ grid-template-columns: repeat(4, minmax(0, 1fr)); }}
.cols-2 {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }}
.card {{
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, .06);
}}
.metric b {{ display: block; font-size: clamp(32px, 4vw, 54px); }}
.metric span {{ color: var(--muted); }}
table {{ width: 100%; border-collapse: collapse; background: #fff; }}
th, td {{ border-bottom: 1px solid var(--line); padding: 10px; }}
th, td {{ text-align: right; }}
th:first-child, td:first-child, th:nth-child(2), td:nth-child(2) {{
  text-align: left;
}}
th {{ color: var(--muted); background: #f8fafc; }}
.note {{
  border-left: 4px solid var(--accent);
  background: #fff8ed;
  color: #5f3b12;
  padding: 16px 18px;
}}
@media (max-width: 860px) {{
  .cols-4, .cols-2 {{ grid-template-columns: 1fr; }}
  section {{ padding: 32px 18px; }}
}}
</style>
</head>
<body>
<section>
  <div class="kicker">DeepSeek Cache Benchmark</div>
  <h1>{escape(args.title)}</h1>
  <p>{escape(args.subtitle)}</p>
  <div class="grid cols-4">
    <div class="card metric"><b>{len(turns)}</b><span>turns</span></div>
    <div class="card metric"><b>{fmt_num(line_count)}</b><span>lines</span></div>
    <div class="card metric"><b>{fmt_num(file_count)}</b><span>files</span></div>
    <div class="card metric"><b>{fmt_pct(hit)}</b><span>cache hit</span></div>
  </div>
  <div class="grid cols-2">
    <div class="card metric"><b>{escape(effort_text)}</b><span>think effort</span></div>
    <div class="card metric">
      <b>{escape(context_text)}</b><span>context window</span>
    </div>
  </div>
  <div class="note">目标为 10,000+ first-party lines，且必须完整可运行。</div>
</section>
<section>
  <div class="kicker">Method</div>
  <h2>动态监督式执行</h2>
  <div class="grid cols-2">
    <div class="card">
      <h3>执行约束</h3>
      <ul>
        <li>Docker 隔离环境，项目 checkout 只读挂载。</li>
        <li>DeepSeekX app-server server mode 驱动 deepseek-v4-pro。</li>
        <li>每轮由监督者验收当前产物后再写下一轮 prompt。</li>
        <li>逐轮记录 think effort 和 modelContextWindow。</li>
        <li>禁止用固定 prompt pack 或生成器替代真实产品开发。</li>
      </ul>
    </div>
    <div class="card">
      <h3>报告口径</h3>
      <ul>
        <li>统计 thread/tokenUsage/updated 中的 cachedInputTokens。</li>
        <li>first-party 行数排除 node_modules、dist、build、coverage。</li>
        <li>最终产物必须包含启动命令、源码、实验日志和 HTML 报告。</li>
      </ul>
    </div>
  </div>
</section>
<section>
  <div class="kicker">Cache</div>
  <h2>逐轮缓存统计</h2>
  <div class="grid cols-4">
    <div class="card metric"><b>{fmt_num(total_input)}</b><span>input</span></div>
    <div class="card metric"><b>{fmt_num(total_cached)}</b><span>cached</span></div>
    <div class="card metric"><b>{fmt_num(total_miss)}</b><span>miss</span></div>
    <div class="card metric"><b>{validation_text}</b><span>validation</span></div>
  </div>
  <div class="card">
    <table>
      <thead>
        <tr>
          <th>Turn</th><th>Name</th><th>Effort</th><th>Context</th>
          <th>Requests</th><th>Input</th><th>Cached</th>
          <th>Miss</th><th>Hit rate</th>
        </tr>
      </thead>
      <tbody>
{turn_rows(turns)}
      </tbody>
    </table>
  </div>
</section>
<section>
  <div class="kicker">Artifact</div>
  <h2>产物与边界</h2>
  <div class="grid cols-2">
    <div class="card">
      <h3>最大文件</h3>
      <table>
        <thead><tr><th>File</th><th>Lines</th></tr></thead>
        <tbody>
{top_file_rows(line_info.get("topFiles") or [])}
        </tbody>
      </table>
    </div>
    <div class="card">
      <h3>复现信息</h3>
      <ul>
        <li>model: {escape(state.get("model", ""))}</li>
        <li>modelProvider: {escape(state.get("modelProvider", ""))}</li>
        <li>threadId: {escape(str(state.get("threadId", "")))}</li>
        <li>previewPort: {escape(str(state.get("previewPort", "")))}</li>
        <li>think effort: {escape(effort_text)}</li>
        <li>modelContextWindow: {escape(context_text)}</li>
        <li>validationUtc: {escape(validation["utc"])}</li>
        <li>failed assertions: {fmt_num(failed) if failed is not None else "n/a"}</li>
      </ul>
    </div>
  </div>
</section>
</body>
</html>
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--state", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--validation-log")
    parser.add_argument("--title", default="DeepSeek 缓存命中基准测试")
    parser.add_argument(
        "--subtitle",
        default="Docker 隔离、动态监督、真实 dashboard 开发的实测结果。",
    )
    args = parser.parse_args()

    state = json.loads(Path(args.state).read_text(encoding="utf-8"))
    validation_path = Path(args.validation_log) if args.validation_log else None
    validation = read_validation(validation_path)
    output = Path(args.output)
    output.write_text(build_html(state, validation, args), encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
