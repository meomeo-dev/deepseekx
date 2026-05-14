---
name: skill-frontmatter-review
description: Use this skill when you need to write or improve SKILL.md
  frontmatter so name and description reflect user-visible capability,
  trigger context, inputs, and value.
---

# Skill Frontmatter Review

使用本技能为 `SKILL.md` 编写、重写或评审 YAML frontmatter 中的
`name` 和 `description`。

## 目标

- `name` 必须按照用户可感知的能力命名，而不是工具名、项目代号、
  内部架构、CLI 参数、实现机制或特殊代码名。
- `description` 必须说明这个 skill 适合在什么使用场景触发、
  帮用户解决什么问题、处理什么输入、产出什么价值。

## 命名规则

1. 先阅读 `SKILL.md` 正文，区分用户价值能力和内部支撑能力。
2. `name` 只保留用户会主动寻找的核心能力。
3. 不把登录、会话、缓存、runtime、profile、导出、恢复、安装、配置、
   调试等内部流程写成主能力，除非它们本身就是用户目标。
4. 不堆砌参数名、命令名、类名、模块名或产品内部术语。
5. 使用短横线 kebab-case。
6. 优先使用任务词和价值词，例如 `research`、`fact-check`、
   `file-analysis`、`image-analysis`、`pdf-processing`、
   `browser-testing`、`release-audit`。
7. 名字要短，但不能抽象到看不出用途。通常 3 到 6 个词较合适。
8. 如果必须包含产品名或平台名，只把它作为限定词，不让它替代能力名。

## 描述规则

1. 使用一句话。
2. 以 `Use this skill when you need ...` 开头。
3. 描述真实触发场景，而不是复述工具实现。
4. 覆盖主要用户任务，不列内部步骤。
5. 可以写输入和输出，例如 uploaded files、screenshots、
   public web information、structured observations。
6. 避免写 `manage session`、`configure runtime`、`use CLI flags` 这类
   用户不关心的内部细节，除非这是该 skill 的核心用途。
7. 描述应足够具体，让模型仅凭 frontmatter 就知道何时加载该 skill。

## 输出

- 给出推荐的 YAML frontmatter。
- 简要说明命名依据和触发场景。
- 如果原文缺少足够上下文，列出需要用户确认的问题。
