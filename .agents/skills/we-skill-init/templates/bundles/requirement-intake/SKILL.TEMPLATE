---
name: we-requirement-intake
description: Use when a new requirement, bug, refactor, workflow change, or
  release-affecting idea needs scope, acceptance criteria, risk, and WE skill
  routing before implementation starts.
---

# we-requirement-intake

用于新需求入口（requirement intake）。目标是在进入代码修改前，
先把需求范围、验收标准、风险、开发模式和下一步 WE skill 判断清楚，
避免边做边扩范围。

默认只做澄清、拆分和路由建议。除非用户明确要求执行，不修改文件、
不建分支、不提交、不推送、不触发 CI。

## 范围

- 新功能、bug、重构、文档、workflow 或 WE skill 改动的入口判断。
- 明确用户目标、非目标、验收标准和可观察结果。
- 判断是否需要轻量设计记录（design note）、测试计划或回滚计划。
- 判断是否建议创建 GitHub issue 或等价需求记录。
- 判断应使用 `$we-design-note`、`$we-feature-dev`、
  `$we-worktree-dev`、`$we-ci-maintenance`、`$we-release-readiness`
  或其他技能。
- 将大需求拆成可独立完成和验证的小需求。

## 非目标

- 不替代 `$we-feature-dev` 的分支、实现和提交流程。
- 不替代 `$we-worktree-dev` 的并行 worktree 和 agent 分派。
- 不替代 `$we-release-readiness` 的发布候选检查。
- 不维护 CI、不准备 release、不执行 npm publish。
- 不创建长期项目管理系统或外部 issue，除非用户明确要求。

## 入口检查

先收集以下事实，缺失时用合理假设继续，并标明假设：

- 需求类型：feature、bug、refactor、docs、workflow、release。
- 用户期望结果和可验收行为。
- 影响范围：CLI、provider、package、CI、release、docs、WE skill。
- 是否影响公开行为、npm 包内容、版本号、公开仓库或凭据边界。
- 是否需要多 agent 或 worktree 并行。
- 是否有时间、成本、CI 分钟数或兼容性限制。

## 风险分级

- Low：文档、注释、窄范围测试、无 runtime 行为变化。
- Medium：普通代码改动、测试改动、局部 CLI 行为变化。
- High：发布包内容、跨平台脚本、认证、网络、删除、迁移、公开镜像。
- Release：版本、CHANGELOG、tag、npm publish、GitHub Release。

风险为 High 或 Release 时，必须给出测试计划和回滚或停止条件。

## Escalation Rules

满足任一条件时，建议升级到 `$we-design-note`：

- 风险等级为 High 或 Release。
- 存在多个可行方案，且取舍影响后续维护。
- 改动影响公开 CLI 行为、npm 包内容、CI、release 或公开仓库。
- 涉及删除、迁移、凭据边界、公开镜像或不可轻易回滚的状态。
- 用户需要 PR、发布说明或演示材料中引用决策依据。

满足任一条件时，建议创建 GitHub issue 或等价需求记录：

- 需求需要跨会话、跨天或多人跟踪。
- 存在多个验收标准、子任务或外部依赖。
- 需要 PR 链接、release note 追踪或公开沟通记录。
- 用户明确要展示专业流程。

个人小任务可以不创建 issue，但最终答复要说明这是轻量取舍。

## 输出格式

回答按以下顺序：

1. 结论：建议下一步使用哪个 WE skill，或不建议使用 WE skill。
2. 需求边界：目标、非目标、验收标准。
3. 风险：影响范围、CI 成本、公开发布或凭据边界。
4. 步骤：按顺序列出 3 到 7 个可执行步骤。
5. 停止条件：哪些失败或不确定性会阻止继续。

如果用户说“开始执行”，通常切换到建议的下一个技能执行。

## 常见路由

- 普通开发：`requirement-intake -> feature-dev`。
- 复杂开发：`requirement-intake -> design-note -> feature-dev`。
- 并行开发：`requirement-intake -> worktree-dev -> feature-dev`。
- CI 调整：`requirement-intake -> feature-dev -> ci-maintenance`。
- 发布准备：
  `requirement-intake -> release-readiness -> release -> public-sync`。
- 完整发布：
  `requirement-intake -> release-readiness -> release -> public-sync ->
  publish -> release-cleanup`。
- 技能维护：`requirement-intake -> we-skill-maker`。

## Final Response

报告：

- 需求类型和风险等级。
- 目标、非目标和验收标准。
- 推荐的 WE skill 顺序。
- 必跑检查或可跳过检查。
- 是否需要用户确认后再执行。
