---
name: we-skill-audit
description: Use when auditing the current project-local WE skill set against
  the professional workflow baseline, by copying the baseline DOT and
  producing a fresh, non-adversarial coverage audit.
---

# we-skill-audit

用于审计当前 WE 技能集合（WE skill set audit）。目标是从专业流程基准
重新开始，而不是沿用旧审计结论；先复制基准文件，再阅读当前
`.agents/skills/we-` 下的技能，重新判断覆盖、取舍、缺口和后续建议。

审计语气应务实，不为了挑刺而挑刺。只报告对流程质量、风险控制、
成本控制或可展示性有帮助的结论。

## 范围

- 复制专业流程基准 DOT，生成本轮审计 DOT 草稿。
- 阅读当前 WE skill 集合和相关 helper scripts。
- 按专业流程节点逐项判断：covered、partial、missing、not needed。
- 输出审计结论、当前合理取舍、需要补强的技能和不建议补强的点。
- 更新或生成 `.agents/skills/we-skill-audit/data/` 下的审计文件。

## 非目标

- 不直接创建或修改其他 WE skill；创建和维护使用 `$we-skill-maker`。
- 不执行 release、publish、CI、branch protection 配置或 public sync。
- 不把个人项目为了省成本的合理取舍一律判为缺陷。
- 不要求每个专业流程节点都拆成独立技能。

## Baseline Files

基准文件：

```text
.agents/skills/we-skill-audit/data/professional-dev-to-release-baseline.dot
```

默认审计输出：

```text
.agents/skills/we-skill-audit/data/we-skill-audit-YYYY-MM-DD.dot
```

如果用户要求覆盖当前审计图，可以另外更新：

```text
.agents/skills/we-skill-audit/data/we-dev-to-release-flow-audit.dot
```

## Copy Helper

用脚本复制基准文件，避免从旧审计图开始：

```bash
.agents/skills/we-skill-audit/scripts/copy_baseline_for_audit.sh
```

可用环境变量覆盖输出路径：

```bash
WE_SKILL_AUDIT_OUTPUT=.agents/skills/we-skill-audit/data/custom.dot \
  .agents/skills/we-skill-audit/scripts/copy_baseline_for_audit.sh
```

脚本只复制基准文件，不读取 secrets，不修改其他技能。

## Audit Method

1. 运行 copy helper，得到本轮审计 DOT 草稿。
2. 列出当前 WE skills：

   ```bash
   find .agents/skills -maxdepth 2 -name SKILL.md | sort
   ```

3. 只阅读审计需要的 `SKILL.md` 和相关 scripts。
4. 按基准节点逐项判断：
   - covered：已有技能清晰负责，且边界合理。
   - partial：已有技能覆盖一部分，剩余依赖人工纪律或外部配置。
   - missing：缺少技能、脚本或明确流程，且缺口有实际风险。
   - not needed：专业流程有该节点，但当前项目规模下不值得新增。
5. 更新审计 DOT，保留专业基准，并新增当前覆盖和 findings。
6. 最终答复给出高信号结论，不列无意义问题。

## Judgment Rules

- 对个人项目，省 CI 分钟数、手动 Windows、solo mode 可以是合理取舍。
- 对 release、public sync、branch protection、credentials，要更严格。
- 如果问题已由技能覆盖，只标注剩余执行纪律或外部配置，不重复挑刺。
- 如果新增技能会让流程变重且收益低，明确写“不建议新增”。
- 审计结论必须能指导下一步行动。

## Validation

维护本技能后运行：

```bash
bash -n .agents/skills/we-skill-audit/scripts/*.sh
python3 - <<'PY'
from pathlib import Path
root = Path('.agents/skills/we-skill-audit')
for path in root.rglob('*'):
    if not path.is_file():
        continue
    for i, line in enumerate(path.read_text(errors='ignore').splitlines(), 1):
        if len(line) > 88:
            print(f'{path}:{i}:{len(line)}')
PY
```

如果 DOT 文件被更新，也运行：

```bash
dot -Tsvg <audit-dot-file> -o /tmp/we-skill-audit.svg
```

## Final Response

报告：

- 基准文件路径。
- 生成或更新的审计 DOT 路径。
- 审计结论：covered、partial、missing、not needed 的重点。
- 不建议新增的技能及原因。
- 验证命令和结果。
- 是否提交，以及保留的 dirty files。
