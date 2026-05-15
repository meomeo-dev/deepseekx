---
name: we-deepseekx-nightly-artifacts
description: Use when planning, triggering, or debugging the manual DeepSeekX
  unsigned platform artifact workflow.
---

# we-deepseekx-nightly-artifacts

用于 DeepSeekX 手动 nightly artifact 构建。该 workflow 消耗 GitHub
Actions runner 资源，默认把用户请求理解为咨询，不自动触发。

## 范围

- 使用 `.github/workflows/deepseekx-nightly-artifacts.yml`。
- 目标包括 `mac-x64`、`mac-arm64`、`mac-universal`、`win-x64`、
  `win-arm64`、`win-bundle` 和 `all`。
- 查询最近 workflow runs 和 GitHub Actions billing usage。
- 在用户明确确认后触发 workflow。
- 调试失败 job、下载 logs 或给出下一步修复建议。

## 非目标

- 不做签名（code signing）或 notarization。
- 不创建 release；release 使用 `$we-release`。
- 不把 nightly workflow 加到普通 push 或 pull_request。
- 不自动运行 `all`，除非用户明确确认。
- 不触碰 `.env`、API key、证书、签名密钥或 billing 凭据。

## 触发前确认

每次准备触发 workflow 前，先用简短中文复述：

- 要构建的目标。
- 使用的分支或 ref。
- 是否会消耗 Actions minutes。
- artifact retention days。
- 失败后如何调试。

只有用户明确确认后，才运行触发命令。确认文本必须包含目标，例如：

```text
确认：在 deepseekx/nightly 跑 mac-x64
```

## 预检

```bash
.agents/skills/we-deepseekx-nightly-artifacts/scripts/preflight.sh
```

检查：

- 当前分支、remote 和 dirty 状态。
- workflow 是否存在。
- `gh` 是否登录。
- 最近 nightly runs。
- Actions 用量是否可读。

## 触发命令

```bash
.agents/skills/we-deepseekx-nightly-artifacts/scripts/trigger.sh \
  --ref deepseekx/nightly \
  --target mac-x64 \
  --retention-days 7 \
  --confirm RUN_NIGHTLY
```

全量构建必须二次确认：

```bash
.agents/skills/we-deepseekx-nightly-artifacts/scripts/trigger.sh \
  --ref deepseekx/nightly \
  --target all \
  --retention-days 7 \
  --confirm RUN_NIGHTLY
```

## 失败调试

```bash
gh run list \
  --repo meomeo-dev/deepseekx \
  --workflow deepseekx-nightly-artifacts.yml \
  --limit 10
gh run view <run-id> \
  --repo meomeo-dev/deepseekx \
  --json status,conclusion,url,headBranch,headSha,jobs
gh run view <run-id> --repo meomeo-dev/deepseekx --log-failed
```

先判断失败是代码、依赖、runner、网络还是 workflow 配置。每次远端
重跑前，先说明本地已完成哪些验证。

## Validation

维护本技能后运行：

```bash
bash -n .agents/skills/we-deepseekx-nightly-artifacts/scripts/*.sh
python3 - <<'PY'
from pathlib import Path
root = Path('.agents/skills/we-deepseekx-nightly-artifacts')
for path in root.rglob('*'):
    if not path.is_file():
        continue
    for i, line in enumerate(path.read_text(errors='ignore').splitlines(), 1):
        if len(line) > 88:
            print(f'{path}:{i}:{len(line)}')
PY
```

## Final Response

报告：

- 是否触发 workflow。
- 目标、ref、run URL。
- 是否查询到 Actions 用量。
- 若未触发，说明等待哪项用户确认。
- 若失败，给出失败 job、关键日志和下一步修复建议。
