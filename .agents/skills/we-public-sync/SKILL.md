---
name: we-public-sync
description: Use when checking the public DeepSeekX repository before release,
  including stale mirror assumptions, credential leak checks, and public
  package metadata verification.
---

# we-public-sync

用于公开仓库发布安全检查（public repository release safety check）。
当前 `https://github.com/meomeo-dev/deepseekx` 本身就是公开仓库，不再
使用独立的 `deepseekx-public` 清洗镜像。本技能确认公开仓库内没有
旧的双仓库镜像假设、凭据、本地配置或未授权目录，并确认 npm package
metadata 指向公开 GitHub。

默认只读检查。真正删除、提交、推送或修改公开仓库文件前，必须由用户
明确要求。

## 范围

- 检查当前公开仓库路径、remote、visibility、branch 和 dirty 状态。
- 检查仓库是否包含旧 `deepseekx-public` 镜像假设、禁止公开目录、
  本地路径或凭据关键词。
- 检查 `codex-cli/package.json` metadata 是否指向公开 GitHub。
- 为 `$we-release` 提供公开发布前的确定性安全检查。

## 非目标

- 不维护版本号；版本、CHANGELOG、tag 使用 `$we-release`。
- 不执行 npm publish；registry 发布使用 `$we-publish`。
- 不调试 CI；CI 使用 `$we-ci-maintenance`。
- 不默认删除文件、不推送公开仓库。
- 不把 `_tasks/`、`_workflows/`、`.deep-research/`、`.env` 或 `.npmrc`
  纳入公开发布内容。
- `.deep-research/deep-research.sqlite` 是当前仓库有意跟踪的研究数据库
  例外；其他 `.deep-research/` 路径仍按禁止公开路径处理。
- `.agents/`、`.codex/`、`.deepseekx/` 是本项目允许公开的内容，但其中
  不得包含凭据、本地 cache、runtime state 或未公开任务内容。

## 检查脚本

优先运行只读脚本：

```bash
.agents/skills/we-public-sync/scripts/check_public_sync.sh
```

脚本会检查：

- 当前仓库是否存在，remote URL 和 GitHub visibility 是否符合预期。
- 当前分支、dirty 状态和 `@meomeo-dev/deepseekx` package version。
- 根 `package.json` 是否仍为 private maintenance package。
- 仓库中是否存在禁止公开目录。
- 仓库中是否出现 token、secret、credential、`.env` 等风险字符串。
- WE skills 中是否仍出现 `deepseekx-public`、`双仓库` 或 `公开镜像`
  等过期流程假设。
- `codex-cli/package.json` 的 repository 是否指向公开仓库。

## Public Allowlist

当前可公开内容包括：

- npm runtime package 白名单内文件。
- README、CHANGELOG、LICENSE、docs/assets。
- `experimental/example` 的 runtime 模板白名单。
- `docs/notes/`，前提是通过同一泄漏扫描。

禁止公开：

- `_tasks/`、`_workflows/`、`.deep-research/`，但允许已确认的
  `.deep-research/deep-research.sqlite`。
- `.env`、`.npmrc`、cache、runtime output、tmp、coverage。
- token、key、secret、credential。
- `.agents/`、`.codex/`、`.deepseekx/` 可以公开同步，但其中不得包含
  私有路径、凭据、本地 cache、runtime state 或未公开任务内容。

## 工作流程

1. 在当前公开仓库运行 `$we-release-readiness` 或 `$we-release` 前置检查。
2. 运行只读检查脚本，确认公开仓库当前状态。
3. 如发现旧镜像假设、凭据或禁止公开目录，先停止并修复。
4. 修复后再次运行脚本。
5. 需要发布时，继续运行 DeepSeekX package staging 或等价发布检查。

## Stop Conditions

遇到以下情况必须停止：

- 当前仓库 remote 不指向 `meomeo-dev/deepseekx`。
- 无法确认公开仓库 visibility，且用户要求推送或发布。
- 仓库出现禁止公开目录或凭据风险字符串。
- `codex-cli/package.json` metadata 不指向公开仓库。
- 仓库存在未解释 tracked dirty files。
- 用户未明确授权删除、提交或推送。

## Validation

维护本技能后运行：

```bash
bash -n .agents/skills/we-public-sync/scripts/*.sh
python3 - <<'PY'
from pathlib import Path
root = Path('.agents/skills/we-public-sync')
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

- 当前公开仓库路径、分支、dirty 状态。
- remote URL 是否符合预期。
- 禁止公开目录和泄漏扫描结论。
- package metadata 是否公开正确。
- 是否允许进入 `$we-release` 的公开发布步骤。
- 是否需要用户确认删除、提交或推送。
