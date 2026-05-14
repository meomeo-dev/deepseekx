---
name: we-design-note
description: Use before complex or high-risk changes to create a lightweight,
  reviewable design note covering context, options, decisions, risks, tests,
  rollback, and follow-up WE skill routing.
---

# we-design-note

用于复杂变更前的轻量设计记录（design note）。目标是在进入实现前，
把背景、方案、取舍、风险、测试计划和回滚方案写成可审查、可归档的
短文档，避免只靠聊天上下文记住关键决策。

默认写入仓库内的结构化文档。除非用户明确要求，不提交、不推送、
不触发 CI、不修改业务代码。

## 范围

- 高风险 feature、重构、CI、release、公开镜像、数据迁移或删除操作。
- 记录背景、目标、非目标、约束、候选方案和最终决策。
- 记录测试计划、回滚方案、停止条件和后续 WE skill 顺序。
- 为 PR、release readiness 或后续维护提供可引用依据。

## 非目标

- 不替代 `$we-requirement-intake` 的需求入口澄清。
- 不替代 `$we-feature-dev` 的实现、测试、提交或 PR。
- 不替代 `$we-release-readiness` 的发布候选检查。
- 不创建长篇架构文档，除非用户明确要求。

## 何时使用

满足任一条件时，建议先写 design note：

- 风险等级为 High 或 Release。
- 方案不止一个，且取舍会影响后续维护。
- 改动影响公开 CLI 行为、npm 包内容、CI、release 或公开仓库。
- 改动涉及删除、迁移、凭据边界、公开镜像或不可轻易回滚的状态。
- 用户要把流程展示给别人，或需要 PR 中引用设计依据。

## 文档位置

默认写入：

```text
docs/design/YYYY-MM-DD-<slug>.md
```

如果变更只影响 WE skills，也可以写入：

```text
.agents/skills/we-skill-maker/data/YYYY-MM-DD-<slug>-design.md
```

文件名使用小写 kebab-case。不要放在根目录。

## 文档结构

使用以下结构，保持短而完整：

```markdown
# <Title>

## Context

## Goals

## Non-Goals

## Options

## Decision

## Risks

## Test Plan

## Rollback Plan

## Follow-Up
```

## 工作流程

1. 确认需求来源和风险等级，必要时先使用 `$we-requirement-intake`。
2. 选择文档路径，避免根目录散落文件。
3. 写出 1 到 3 个可行方案，不为凑数添加虚假方案。
4. 记录最终选择和放弃其他方案的原因。
5. 写清楚测试计划、回滚计划和停止条件。
6. 标注下一步 WE skill，例如 `$we-feature-dev` 或
   `$we-release-readiness`。

## Validation

维护本技能后运行：

```bash
python3 - <<'PY'
from pathlib import Path
root = Path('.agents/skills/we-design-note')
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

- design note 路径。
- 记录的决策摘要。
- 测试计划和回滚计划。
- 下一步建议使用的 WE skill。
- 是否提交，以及保留的 dirty files。
