# Changelog

## 0.131.0-deepseekx.3

- 为 DeepSeek Chat Completions 的 `apply_patch` 工具描述加入紧凑
  few-shot 示例和写入前上下文校验约束。
- 明确 MCP resource 工具只读取已配置 MCP server 暴露的 resource，
  避免把普通本地路径误当作 MCP resource。

## 0.131.0-deepseekx.1

- 发布 DeepSeekX npm 包 `@meomeo-dev/deepseekx`。
- 保留上游 OpenAI Codex README 为 `CODEX_README.md`，新增 DeepSeekX
  根 README。
- 记录 `DEEPSEEKX_HOME`、`.deepseekx/config.toml` 和 DeepSeek provider
  配置示例。

## Upstream Codex

OpenAI Codex 的上游变更记录见
[releases page](https://github.com/openai/codex/releases)。
