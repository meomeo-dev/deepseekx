---
name: we:deepseekx-nightly-artifacts
description: Use when discussing, planning, triggering, or debugging the
  manual unsigned six-platform DeepSeekX nightly artifact workflow.
---

# DeepSeekX Nightly Artifacts

## 适用范围

用于 DeepSeekX 的手动 nightly 构建（nightly artifact build）：

- macOS x64
- macOS arm64
- macOS universal
- Windows x64
- Windows arm64
- Windows architecture bundle

该技能默认把用户请求理解为咨询（question），不是执行指令。除非用户已经
明确确认目标、分支、费用风险和触发动作，否则不要启动 GitHub Actions。

## 硬性边界

- 只使用 `.github/workflows/deepseekx-nightly-artifacts.yml`。
- 该 workflow 只允许 `workflow_dispatch` 手动触发。
- 不做签名（code signing），不做 notarization，不创建 release。
- 不把 nightly workflow 加到普通 `push` 或 `pull_request`。
- 不自动运行 `all`，除非用户明确确认。
- 不触碰 `.env`、API key、证书、签名密钥或 billing 凭据。
- 不使用 destructive git 命令。
- 不在 dirty worktree 或未确认的功能分支上触发。需要提交、推送、
  合并或整理分支时，先使用 `$we:deepseekx-github-flow`。

## 默认沟通规则

用户可能不了解 CI、runner、分支或费用。每次准备触发 workflow 前，先用
简短中文复述：

- 要构建的目标。
- 将使用的分支或 ref。
- 是否会消耗 Actions minutes。
- 是否只跑单目标，还是全量 `all`。
- artifact 保留天数。
- 失败后将如何调试。

然后要求用户明确回复确认。确认文案必须包含目标，例如：

```text
确认：在 deepseekx/nightly 跑 mac-x64
```

仅当用户已明确确认时，才运行触发命令。

## 分支策略

推荐分支：

- `deepseekx/main`：下游集成主干，应等于最新已同步 Codex 版本加
  DeepSeekX 自有补丁。
- `deepseekx/<feature-slug>`：普通功能开发分支。
- `deepseekx/nightly`：手动 nightly artifact 构建分支。

推荐流程：

1. 先用 `$we:deepseek-branch-sync` 完成需要的 Codex 版本同步。
2. 功能先合并到 `deepseekx/main`。
3. 快进或重建 `deepseekx/nightly` 到要发布验证的提交。
4. 在 `deepseekx/nightly` 手动触发 nightly workflow。
5. 先跑单目标，修复后再跑 `all`。

首次使用前，`deepseekx-nightly-artifacts.yml` 需要先进入仓库默认分支。
GitHub 识别到 workflow 后，后续才用 `--ref deepseekx/nightly` 指定源码 ref。

如果用户要求在功能分支直接跑，先说明这会按该分支源码产物构建。用户确认后
可以执行，但不要把它描述为正式 nightly。

触发前的 ref 应来自已完成 GitHub Flow 收口的稳定分支，或来自用户明确
确认的临时分支。

## 目标选择

优先省钱：

- 本地可复现的问题先本地修。
- 先跑一个失败目标，不跑 `all`。
- macOS 问题优先 `mac-x64`，因为本地 macOS x64 可做第一轮验证。
- Windows 问题先跑对应架构的单目标。
- 只有单目标都通过后，才跑 `all`。

workflow 支持的目标：

```text
mac-x64
mac-arm64
mac-universal
win-x64
win-arm64
win-bundle
all
```

## 预检

触发或调试前先运行：

```bash
.codex/skills/we/deepseekx-nightly-artifacts/scripts/preflight.sh
```

检查输出：

- 当前分支。
- dirty worktree。
- nightly workflow 是否存在。
- `gh` 是否登录。
- 最近 workflow runs。
- 是否能读取 Actions 用量。

如果有未跟踪密钥文件，例如 `DEEPSEEK_API_KEY.env`，不要暂存或提交。
如果当前 ref 还需要提交、推送、PR、合并或删分支，先路由到
`$we:deepseekx-github-flow`。

## 余额与用量查询

优先运行：

```bash
.codex/skills/we/deepseekx-nightly-artifacts/scripts/actions_usage.sh
```

该脚本只读查询 GitHub Actions billing API。可能因为账号、组织权限或
GitHub 计费模型而失败。失败时说明无法读取，不要猜余额。

也可以手动查看：

```bash
gh api "/orgs/<owner>/settings/billing/actions"
gh api "/users/<owner>/settings/billing/actions"
```

## 触发命令

确认后用脚本触发，避免手写参数出错：

```bash
.codex/skills/we/deepseekx-nightly-artifacts/scripts/trigger.sh \
  --ref deepseekx/nightly \
  --target mac-x64 \
  --retention-days 7 \
  --confirm RUN_NIGHTLY
```

全量构建必须二次确认：

```bash
.codex/skills/we/deepseekx-nightly-artifacts/scripts/trigger.sh \
  --ref deepseekx/nightly \
  --target all \
  --retention-days 7 \
  --confirm RUN_NIGHTLY
```

脚本会调用：

```bash
gh workflow run deepseekx-nightly-artifacts.yml \
  --ref <ref> \
  -f target=<target> \
  -f confirm_run=RUN_NIGHTLY \
  -f artifact_retention_days=<days>
```

## 失败调试

先抓失败日志：

```bash
gh run list --workflow deepseekx-nightly-artifacts.yml --limit 10
gh run view <run-id> --json status,conclusion,url,headBranch,headSha,jobs
gh run view <run-id> --log-failed
```

调试顺序：

1. 判断失败是代码、依赖、runner、网络，还是 workflow 配置。
2. 本地 macOS x64 可复现的问题先本地修。
3. 远端专属问题只重跑对应单目标。
4. 改完提交并 push 到同一 ref。
5. 手动重跑同一失败目标。
6. 单目标通过后再考虑 `all`。

不要用 CI 反复试错。每次远端重跑前先说明本地已完成哪些验证。

## 本地验证

如果改了 workflow 或脚本，优先运行：

```bash
bash -n .codex/skills/we/deepseekx-nightly-artifacts/scripts/*.sh
python3 - <<'PY'
from pathlib import Path
paths = [
    Path('.codex/skills/we/deepseekx-nightly-artifacts'),
    Path('.github/workflows/deepseekx-nightly-artifacts.yml'),
]
for root in paths:
    files = [root] if root.is_file() else root.rglob('*')
    for path in files:
        if not path.is_file():
            continue
        for i, line in enumerate(path.read_text(errors='ignore').splitlines(), 1):
            if len(line) > 88:
                print(f'{path}:{i}:{len(line)}')
PY
```

如本地有 `actionlint`，也运行：

```bash
actionlint .github/workflows/deepseekx-nightly-artifacts.yml
```

## 最终回复

汇报：

- 是否触发了 workflow。
- 目标、ref、run URL。
- 是否查询到 Actions 用量。
- 若未触发，说明等待哪项用户确认。
- 若失败，给出失败 job、关键日志和下一步修复建议。
