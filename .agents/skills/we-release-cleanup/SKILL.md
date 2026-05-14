---
name: we-release-cleanup
description: Use after release preparation, tag push, GitHub Release, or npm
  publish work to verify repositories, branches, tags, artifacts, and local
  workspaces are clean.
---

# we-release-cleanup

用于发布流程结束后的收工检查（post-release cleanup）。目标不是继续发布，
而是确认私有仓库、公开仓库、tag、npm registry、CI、临时产物和本地分支
都回到可继续开发的干净状态。

默认只读检查。删除文件、删除分支、切换分支、创建新分支、重新触发 CI、
创建 GitHub Release 或执行 npm publish 都必须由用户明确要求。

## 适用范围

- `$we-release` 完成后，确认双仓库同步、tag、tarball 和工作区状态。
- `$we-publish` 完成后，确认 npm latest、dist-tag、registry 安装和本地
  发布目录状态。
- GitHub Release 页面创建后，确认 tag、release 页面和附件命名一致。
- 发布中断或用户说“收尾、收工、整理一下、检查目录和分支干净”。
- 准备回到普通开发前，确认是否应留在 `deepseekx/main` 或创建下一条
  `deepseekx/<slug>` 分支。

## 非目标

- 不维护版本号；版本、changelog、tag 创建使用 `$we-release`。
- 不执行 npm publish；npm registry 发布使用 `$we-publish`。
- 不调试 CI 失败；GitHub Actions 失败使用 `$we-ci-maintenance`。
- 不自动删除 tarball、cache、临时目录或本地分支。
- 不自动切换分支或创建下一条 feature 分支。

## 收工不变量

- 私有工作区路径是 `/Users/jin/projects/deepseekx`。
- 公开工作区路径是 `/Users/jin/projects/deepseekx-public`。
- 两个工作区都应在 `deepseekx/main` 或公开镜像约定分支，除非用户明确
  要求停在 release 分支。
- 两个工作区都应没有 tracked dirty files。
- 私有远端必须是 `deepseekx`。
- 公开远端必须是 `deepseekx`。
- 本地 `deepseekx/main` 不应落后对应 `origin/deepseekx/main`。
- release tag 应存在于需要记录 release 的仓库远端。
- npm registry latest 应符合本轮发布目标；未执行 publish 时要明确说明。
- tarball、checksum、CI artifact 和临时安装目录不得被 git 跟踪。

## Workflow

1. 确认目标版本。优先读取 `codex-cli/package.json`；如用户指定版本，
   以用户版本为期望值并验证一致。
2. 运行只读检查脚本：

   ```bash
   .agents/skills/we-release-cleanup/scripts/check_release_cleanup.sh
   ```

3. 查看私有和公开仓库：
   - 当前分支；
   - dirty / untracked / ignored 摘要；
   - `origin/deepseekx/main...deepseekx/main` ahead/behind；
   - remote URL；
   - 最新 commit；
   - 本地和远端 release tag。
4. 查看 npm registry：
   - `npm view @meomeo/deepseekx version dist-tags --json`；
   - 如已发布，确认 latest 等于目标版本；
   - 如未发布，明确 npm latest 仍低于目标版本。
5. 查看 CI：
   - 只读查看最近 run；
   - 不要手动触发 workflow；
   - 说明 Linux/Windows 是否按成本策略运行或跳过。
6. 检查本地产物：
   - tarball：`deepseekx-*.tgz`；
   - checksum：`*.sha256`；
   - `dist/`、`coverage/`、`tmp/`；
   - 新闻模板 `data/`、`logs/`、`summary/`；
   - `.env`、`.npmrc` 只报告存在性，不打印内容。
7. 如发现可删除的本地产物，只列出建议删除命令；不要直接执行。
8. 如用户要求真正整理，再按确认范围执行并复查。

## Cleanup Levels

- Level 1：只读检查。默认等级，只报告状态、风险和建议。
- Level 2：建议整理。列出可以执行的删除、切分支或删本地分支命令，
  但不执行。
- Level 3：执行整理。只有用户明确说“执行清理、切回 main、
  删除这些文件或分支”时才使用，执行后必须复查。

如果用户说“本地记录不清理”，不得删除本地记录、note、任务记录或
用户保留的调查资料；只处理用户明确允许的临时产物和分支状态。

## 常见结论

- “发布准备完成，未 npm publish”：tag 和双仓库干净，但 npm latest 仍是
  旧版本；下一步是 `$we-publish`。
- “npm publish 完成”：npm latest、dist-tag、临时 registry 安装都匹配；
  下一步可以归档或开始新 feature。
- “CI 仍在跑”：停止收工结论，等 CI 完成或切到 `$we-ci-maintenance`。
- “有 ignored 本地产物”：不阻塞 git 干净，但应提醒是否清理。
- “有 untracked tarball”：不提交；如不再需要，建议删除。

## 可选整理动作

只有用户明确要求时才执行：

```bash
rm -f deepseekx-*.tgz *.sha256
rm -rf tmp coverage
git switch deepseekx/main
```

删除已合并 feature 分支前必须确认：

```bash
git branch --merged deepseekx/main
git branch -d deepseekx/<slug>
```

不要删除远端分支，除非用户明确指定远端分支名。

## Validation

维护本技能后运行：

```bash
bash -n .agents/skills/we-release-cleanup/scripts/*.sh
python3 - <<'PY'
from pathlib import Path
root = Path('.agents/skills/we-release-cleanup')
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

- 私有/公开仓库当前分支和 dirty 状态。
- 本地/远端 tag 状态。
- npm latest 与本地版本是否一致。
- 最近 CI 结论和是否有平台被跳过。
- 本地 tarball、cache、ignored 产物状态。
- 是否需要用户确认清理动作。
- 是否已经回到 `deepseekx/main`，以及下一步建议使用哪个 WE skill。
