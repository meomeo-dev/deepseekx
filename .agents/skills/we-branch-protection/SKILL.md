---
name: we-branch-protection
description: Use when checking or explaining GitHub branch protection and PR
  gate requirements for deepseekx/main before professional mode, release, or
  public workflow demonstrations.
---

# we-branch-protection

用于检查和说明 GitHub branch protection（分支保护）。目标是确认
`deepseekx/main` 是否由远端规则保护，是否要求 PR、CI、review、线性历史，
以及是否允许 admin bypass。

默认只读检查。不修改仓库设置、不创建规则、不推送、不触发 CI。
如果需要修改 GitHub 设置，只给建议和命令方向，等待用户明确确认。

## 范围

- 检查公开 GitHub 仓库 `meomeo-dev/deepseekx` 的 `deepseekx/main`
  分支保护状态。
- 判断 professional mode 是否有真实远端硬门禁支撑。
- 发布前确认 release commit 和 tag 是否受合理分支策略保护。
- 给出缺失保护规则的风险和建议。

## 非目标

- 不替代 `$we-feature-dev` 的分支开发和 PR 操作。
- 不替代 `$we-ci-maintenance` 的 CI workflow 调试。
- 不替代 GitHub 管理员手动配置。
- 不打印 token、凭据或 GitHub auth 细节。

## 检查脚本

优先运行只读脚本：

```bash
.agents/skills/we-branch-protection/scripts/check_branch_protection.sh
```

脚本会检查：

- 当前 remote URL。
- `gh auth status` 是否可用。
- 公开仓库 `deepseekx/main` 的 branch protection 关键字段。
- 最近 CI workflow 名称，供 required status checks 对照。

如果 `gh` 未登录或 API 权限不足，报告阻塞项，不要继续猜测。

## 配置辅助脚本

本技能提供一个默认 dry-run 的配置辅助脚本，用于生成建议 payload：

```bash
.agents/skills/we-branch-protection/scripts/configure_branch_protection.sh
```

脚本默认只打印 payload，不修改 GitHub。只有用户明确要求配置远端规则后，
才允许执行：

```bash
WE_BRANCH_PROTECTION_APPLY=1 \
  .agents/skills/we-branch-protection/scripts/configure_branch_protection.sh
```

执行前必须再次确认目标 repo、branch、required status check 名称和
admin bypass 策略。

默认 payload 跟随当前单人项目规则：要求 PR、required checks、strict
up-to-date、linear history，禁止 force push 和删除，但 review approvals
默认是 0。需要临时恢复团队式 approval gate 时，显式设置：

```bash
WE_BRANCH_PROTECTION_REQUIRED_APPROVALS=1 \
  .agents/skills/we-branch-protection/scripts/configure_branch_protection.sh
```

required checks 默认包含当前 `deepseekx/main` 的硬门禁：

```text
build-test, Blob size policy, cargo-deny, CI results (required)
```

如果远端 required checks 变化，先运行检查脚本确认名称，再用
`WE_BRANCH_PROTECTION_REQUIRED_CHECKS` 覆盖；不要在未知 check 名称下 apply。

## Recommended Protection

专业流程建议 `deepseekx/main` 至少满足：

- Require a pull request before merging。
- Require status checks to pass before merging。
- Required checks 包含 Linux release preflight。
- Require branches to be up to date before merging，按项目成本决定。
- Restrict force pushes and deletions。
- Require linear history，适合本项目 GitHub Flow。
- Admin bypass 是否允许必须明确说明。

个人项目可以降低要求，但最终答复必须标注这是成本取舍，不是团队基准。

## 工作流程

1. 确认检查目标：private、public 或 both。
2. 运行只读脚本。
3. 对照 Recommended Protection 判断 covered、partial 或 missing。
4. 如果 professional mode 需要远端硬门禁，缺失时停止并说明风险。
5. 如用户要求配置，给出 GitHub UI 或 `gh api` 方向，但不直接修改。

## Validation

维护本技能后运行：

```bash
bash -n .agents/skills/we-branch-protection/scripts/*.sh
python3 - <<'PY'
from pathlib import Path
root = Path('.agents/skills/we-branch-protection')
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

- 检查的仓库和分支。
- branch protection 是否存在。
- PR、review、required checks、force push、deletion 和 admin bypass 状态。
- 是否满足 professional mode。
- 需要用户手动配置的规则。
