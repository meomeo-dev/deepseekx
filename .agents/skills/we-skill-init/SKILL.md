---
name: we-skill-init
description: Use when initializing a project-local WE skill set from bundled
  generic skill templates, with a one-time state marker and adaptive project
  metadata rendering.
---

# we-skill-init

用于初始化项目本地 WE 技能集合（WE skill set initialization）。
目标是把一组可继承、可适配的 WE 技能 bundle 安装到当前仓库，
并通过状态标识文件保证默认只执行一次。

本技能不初始化自身，也不初始化 `$we-skill-maker`。这两个技能是
生成和维护初始化体系的根技能，不应由初始化流程覆盖。

## Scope

- 从 `templates/bundles/<skill>/` 复制通用 WE skill bundle。
- 根据目标仓库自动渲染项目名、包名、CLI bin、remote、路径和
  公开仓库策略。
- 识别项目类型（project type），并标记 release/publish 是否需要适配。
- 创建 `.agents/skills/.we-skill-init-state` 状态标识文件。
- 记录 template schema、manifest version、source commit 和 bundle hash。
- 跳过已经存在的技能，除非用户明确要求覆盖。
- 为新项目提供稳定继承的 WE 技能基础。

## Non-Goals

- 不覆盖 `$we-skill-init` 和 `$we-skill-maker`。
- 不安装全局技能，不发布 plugin。
- 不创建 GitHub 仓库、不配置 branch protection、不触发 CI。
- 不执行 release、publish、public sync 或 cleanup。
- 不读取或写入 secrets、`.env`、token 或凭据。

## State Marker

状态标识文件放在 WE 分组目录：

```text
.agents/skills/.we-skill-init-state
```

如果该文件存在，初始化脚本默认停止，避免二次自动触发。
只有用户明确要求重新初始化时，才使用：

```bash
WE_SKILL_INIT_FORCE=1 \
  .agents/skills/we-skill-init/scripts/init_we_skills.sh
```

覆盖已有技能还需要额外显式开启：

```bash
WE_SKILL_INIT_FORCE=1 WE_SKILL_INIT_OVERWRITE=1 \
  .agents/skills/we-skill-init/scripts/init_we_skills.sh
```

状态文件必须记录：

- `template_schema`
- `template_version`
- `source_commit`
- `bundle_manifest_hash`
- `bundle_tree_hash`
- `project_type`
- copied、skipped 和 excluded bundle

## Bundles

每个 bundle 是一个完整技能目录，可包含自己的 `SKILL.TEMPLATE`、
`scripts/`、`templates/`、`data/` 或 `references/`：

```text
.agents/skills/we-skill-init/templates/bundles/<skill>/
```

bundle 清单由 manifest 管理：

```text
.agents/skills/we-skill-init/templates/bundles.yaml
```

bundle 内容使用占位符保持通用性，例如：

- `__WE_PROJECT_NAME__`
- `__WE_PRIVATE_ROOT__`
- `__WE_PUBLIC_ROOT__`
- `__WE_PACKAGE_NAME__`
- `__WE_CLI_BIN__`
- `__WE_PRIVATE_REPO_SLUG__`
- `__WE_PUBLIC_REPO_SLUG__`
- `__WE_PACKAGE_TARBALL_GLOB__`
- `__WE_SMOKE_COMMAND_1__`

初始化脚本会按目标仓库实际情况替换这些占位符。
bundle 内不得使用 `SKILL.md` 文件名，避免 Codex 把模板目录识别为
当前仓库可用技能。初始化脚本复制 bundle 后，会把 `SKILL.TEMPLATE`
改名为目标技能目录中的 `SKILL.md`。
当前 bundle 集合包含除 `$we-skill-init` 和 `$we-skill-maker`
之外的项目本地 WE skills。每个 bundle 必须保持自包含；
如果技能依赖模板、脚本、数据或基准文件，应放在该 bundle
自己的目录下。

## Project Type Gate

脚本会识别：

- `npm-cli`
- `npm-package`
- `python`
- `rust`
- `go`
- `generic`

`release` 和 `publish` bundle 会写入 adaptation status：

- `ready:*`：可直接使用模板主流程。
- `partial:*`：部分适用，必须先改写 smoke checks 或验证方式。
- `needs-adaptation:*`：不得直接执行发布命令，先按项目生态
  改写技能。

可用 `WE_SKILL_PROJECT_TYPE` 覆盖识别结果。

## Workflow

1. 确认当前仓库需要初始化 WE 技能集合。
2. 检查 `.agents/skills/.we-skill-init-state` 是否存在。
3. 运行初始化脚本：

   ```bash
   .agents/skills/we-skill-init/scripts/init_we_skills.sh
   ```

4. 查看 copied、skipped、state file 输出。
5. 阅读生成的 WE skill，按项目实际情况微调。
6. 运行生成技能的验证命令。
7. 只 stage `.agents/skills/we-*`，再按用户要求提交。

## Adaptation Inputs

脚本会自动读取：

- `git rev-parse --show-toplevel`
- `git remote get-url origin`
- `package.json` 的 `name`、`bin`、`repository`
- `pyproject.toml`、`Cargo.toml` 或 `go.mod` 是否存在

可用环境变量覆盖：

- `WE_SKILL_INIT_ROOT`
- `WE_SKILL_PRIVATE_REPO`
- `WE_SKILL_PUBLIC_REPO`
- `WE_SKILL_PACKAGE_NAME`
- `WE_SKILL_CLI_BIN`
- `WE_SKILL_CLI_ENTRY`
- `WE_SKILL_LICENSE`
- `WE_SKILL_NPM_ACCESS`
- `WE_SKILL_PUBLIC_ROOT`
- `WE_SKILL_WORKTREE_ROOT`
- `WE_SKILL_WORKTREE_ROOT_REL`
- `WE_SKILL_ARTIFACT_PREFIX`
- `WE_SKILL_PACKAGE_TARBALL_GLOB`
- `WE_SKILL_PACKAGE_TARBALL_PATTERN`
- `WE_SKILL_PUBLIC_KNOWLEDGE_DIR`
- `WE_SKILL_EXPERIMENTAL_RUNTIME_PATH`
- `WE_SKILL_SMOKE_COMMAND_1`
- `WE_SKILL_SMOKE_COMMAND_2`
- `WE_SKILL_SMOKE_COMMAND_3`

## Scripts

- `scripts/init_we_skills.sh`：入口脚本，负责一次性门禁、复制 bundle、
  渲染后改名、写状态文件。
- `scripts/load_context.sh`：读取目标仓库 metadata，推断 project type，
  计算 manifest 和 bundle hash，并导出渲染变量。
- `scripts/export_context.sh`：集中导出渲染变量，避免上下文读取脚本
  继续膨胀。
- `scripts/render_placeholders.sh`：把 bundle 中的 `__WE_*__` 占位符
  替换为目标仓库事实。

## Validation

维护本技能后运行：

```bash
bash -n .agents/skills/we-skill-init/scripts/*.sh
python3 - <<'PY'
from pathlib import Path
root = Path('.agents/skills/we-skill-init')
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

- 初始化目标仓库。
- 状态标识文件路径。
- copied、skipped 和 excluded bundle。
- 是否使用 force 或 overwrite。
- 需要人工适配的技能。
- 验证命令和结果。
