---
name: we-help
description: Use when the user asks for help choosing, understanding, or
  routing project-local WE skills under .agents/skills.
---

# we-help

用于说明本仓库 WE skills 的使用方式，并根据用户请求判断应使用哪个
WE skill，或判断不建议使用 WE skill 时应采用什么普通流程。

默认行为是提供帮助（help-first）。除非用户明确要求执行具体任务，
本技能只做解释、路由建议和步骤说明，不修改文件、不提交、不推送、
不触发 CI、不发布 npm。

## 范围

- 列出 `.agents/skills/we-` 下的 WE skills。
- 解释每个 WE skill 的职责、边界和典型触发语句。
- 根据用户当前请求推荐一个或多个 WE skills。
- 当请求不适合 WE skill 时，说明应使用普通开发、问答、审查、
  调研或命令执行流程。
- 给出分步骤回答，帮助用户理解下一步怎么做。

## 非目标

- 不创建或修改 WE skill；创建和维护使用 `$we-skill-maker`。
- 不做新需求入口澄清；需求入口使用 `$we-requirement-intake`。
- 不写复杂变更设计记录；设计记录使用 `$we-design-note`。
- 不执行 feature 开发；功能开发使用 `$we-feature-dev`。
- 不检查 branch protection；分支保护使用 `$we-branch-protection`。
- 不管理 git worktree；并行 worktree 使用 `$we-worktree-dev`。
- 不维护 CI；CI 创建、调试和运行使用 `$we-ci-maintenance`。
- 不判断发布候选状态；发布前判断使用 `$we-release-readiness`。
- 不准备双仓库 release；发布准备使用 `$we-release`。
- 不检查或同步公开镜像；公开镜像使用 `$we-public-sync`。
- 不执行 npm publish；npm 发布使用 `$we-publish`。
- 不做发布后收工检查；发布收尾使用 `$we-release-cleanup`。
- 不做 WE 技能集合基准审计；技能审计使用 `$we-skill-audit`。
- 不初始化 WE 技能集合；初始化使用 `$we-skill-init`。

## Skill Map

- `$we-help`：查看 WE skills 帮助、选择技能、判断是否该用技能。
- `$we-requirement-intake`：新需求、bug、重构、workflow 或 release
  想法进入实现前，确认范围、验收标准、风险和后续技能顺序。
- `$we-design-note`：复杂或高风险变更前，记录背景、方案、取舍、
  风险、测试计划和回滚方案。
- `$we-feature-dev`：日常功能开发、修复、重构、workflow 小改动、
  分支预检、提交和 PR 卫生。
- `$we-branch-protection`：检查 GitHub `main` 分支保护、PR 门禁、
  required checks、force push、deletion 和 admin bypass。
- `$we-worktree-dev`：需要多个 worktree、多个 agent、并行分支、
  隔离写入范围和合并回主工作区时使用。
- `$we-ci-maintenance`：GitHub Actions CI、分平台运行、run/job/artifact
  查看、成本控制和 release preflight CI。
- `$we-release-readiness`：发布前候选检查，判断目标版本、CHANGELOG、
  Windows CI、GitHub Release 页面和发布阻塞项。
- `$we-release`：版本号、CHANGELOG、双仓库清洗同步、发布准备、
  GitHub Release 页面和 release artifact 策略。
- `$we-public-sync`：公开仓库清洗同步、泄漏扫描、公开 metadata
  和公开镜像发布前验证。
- `$we-publish`：npm registry 发布、`npm publish`、registry post-check
  和发布后临时安装验证。
- `$we-release-cleanup`：发布、tag、GitHub Release 或 npm publish
  之后检查双仓库、分支、tag、CI、npm latest 和本地产物是否收干净。
- `$we-skill-audit`：复制专业流程基准 DOT，重新审计当前 WE
  技能集合，输出覆盖、取舍、缺口和补强建议。
- `$we-skill-init`：从 bundled templates 初始化项目本地 WE 技能集合，
  写入一次性状态标识，保留可继承且可适配的技能基础。
- `$we-skill-maker`：创建、更新和规范化项目本地 WE skills。

## Routing Rules

按用户请求选择技能：

1. 请求是“帮我选技能、这些 WE 技能怎么用、该用哪个技能”：
   使用 `$we-help`。
2. 请求是新需求、需求不清、要判断范围、验收标准、风险或下一步：
   使用 `$we-requirement-intake`。
3. 请求是复杂方案、高风险改动、需要记录取舍、测试计划或回滚方案：
   使用 `$we-design-note`。
4. 请求是新功能、修 bug、重构、改测试或普通项目文件：
   使用 `$we-feature-dev`。
5. 请求是检查 main 保护、PR 必需、required checks 或远端门禁：
   使用 `$we-branch-protection`。
6. 请求需要多个分支、多个 agent 并行或隔离实验：
   使用 `$we-worktree-dev`。
7. 请求是 GitHub Actions、CI run、Windows/Linux 分平台验证、
   artifact 或 CI 成本控制：
   使用 `$we-ci-maintenance`。
8. 请求是发布前判断能不能发、是否要 Windows CI、是否要 GitHub
   Release 或目标版本是否合理：
   使用 `$we-release-readiness`。
9. 请求是准备 release、版本、tag、release notes 或 release 文件：
   使用 `$we-release`。
10. 请求是公开仓库同步、公开镜像、泄漏扫描或 public metadata：
   使用 `$we-public-sync`。
11. 请求是执行 npm publish、查询 npm latest、验证 registry 安装：
   使用 `$we-publish`。
12. 请求是发布完成后的收尾、清理、确认分支目录干净：
   使用 `$we-release-cleanup`。
13. 请求是审计当前 WE 技能集合、对照专业基准、重新生成审计图：
   使用 `$we-skill-audit`。
14. 请求是初始化当前仓库 WE 技能集合、复制通用 bundle 模板：
   使用 `$we-skill-init`。
15. 请求是新增或维护 WE skill：
   使用 `$we-skill-maker`。

如果请求横跨多个技能，按实际流程排序。例如：

```text
requirement-intake -> design-note -> feature-dev -> branch-protection ->
ci-maintenance
```

发布完整收尾常见顺序：

```text
requirement-intake -> design-note -> feature-dev -> branch-protection ->
ci-maintenance -> release-readiness -> release -> public-sync -> publish ->
release-cleanup
```

只有当用户明确要求并行开发时，才引入 `worktree-dev`。

WE 技能集合维护常见顺序：

```text
we-skill-init -> we-skill-audit -> we-skill-maker -> help
```

## When Not To Use WE Skills

以下情况通常不建议使用 WE skill：

- 用户只问一个代码概念、命令含义或设计取舍。
- 用户要求阅读某个文件并解释，不需要项目流程门禁。
- 用户要求做代码 review；按 review 流程给 findings。
- 用户只要求运行简单命令，例如 `date`、`git status`。
- 用户讨论产品想法或命名，不要求落地到仓库流程。
- 请求属于外部资料调研，且不涉及本仓库重复流程。

这种情况下，直接回答或执行对应轻量流程，并说明“不需要 WE skill”。

## Response Shape

回答应使用中文优先，并按步骤组织：

1. 开头先展示完整流程图式路径（full flow path）。
2. 标出本次回复建议的起点（start）和终点（end）。
3. 在流程中用实线箭头 `->` 标注硬建议（hard recommendation）。
4. 在流程中用虚线箭头 `-.->` 标注软建议（soft recommendation）。
5. 说明推荐使用哪个 WE skill，或不建议使用 WE skill。
6. 给出从起点到终点的完整步骤，必要时列出命令或检查项。
7. 展示执行完毕后的目标状态预览（target state preview）。
8. 标注风险：如果涉及发布、推送、CI、凭据、删除或成本。
9. 如果用户只是求帮助，到此停止；不要自动执行后续任务。

## Flow Display Rules

默认先展示完整流程，再展示本次建议路径。

完整流程使用一行或多行代码块：

```text
requirement-intake -.-> design-note -> feature-dev -.-> branch-protection ->
ci-maintenance -> release-readiness -> release -> public-sync -> publish ->
release-cleanup
```

含义：

- `->`：硬建议，本次目标通常需要经过。
- `-.->`：软建议，按风险、成本、协作或用户目标决定是否经过。
- `[start]`：本次建议起点。
- `[end]`：本次建议终点。
- `[skip]`：本次不建议执行，但属于完整流程的一部分。

本次路径示例：

```text
[start] feature-dev -> local validation -> commit -.-> push [end]
[skip] release-readiness -.-> release -.-> publish
```

如果请求只需要解释，不需要落地操作，起点可以是 `help`，终点可以是
`understanding`。如果请求是发布链路，终点通常是 `release-cleanup`。

## Target State Preview

每次答复末尾给出目标状态预览，说明执行完毕时应该看到什么。

示例：

```text
target:
- private repo: deepseekx/main clean, origin/deepseekx/main up to date
- public repo: untouched or synced, depending on path
- npm: unchanged unless publish path is selected
- CI: not triggered unless ci-maintenance path is selected
```

## Help Output Checklist

默认帮助答复至少包含：

- 当前可用 WE skills。
- 每个 skill 的一句话用途。
- 常见请求到 skill 的映射。
- 不该用 WE skill 的例子。
- 完整流程图式路径。
- 本次起点、终点、硬建议和软建议。
- 从起点到终点的完整步骤。
- 执行完毕后的目标状态预览。

## Validation

维护本技能后运行：

```bash
python3 - <<'PY'
from pathlib import Path
root = Path('.agents/skills/we-help')
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

- skill name 和路径。
- 是否添加 scripts、templates、data 或 references。
- 验证命令和结果。
- 是否提交。
- 保留的无关 dirty files。
