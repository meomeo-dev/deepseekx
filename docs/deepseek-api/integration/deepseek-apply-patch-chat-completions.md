# DeepSeek apply_patch Chat Completions 适配方案

## 范围

本文记录 DeepSeek Chat Completions 下 `apply_patch` 的适配方案。

目标链路是 Codex 的文件编辑工具：

- OpenAI Responses：`apply_patch` 使用 freeform custom tool。
- OpenAI Responses：tool format 使用 `apply_patch.lark` 约束原始 patch。
- DeepSeek Chat Completions：不支持 freeform tool 和 Lark grammar。
- DeepSeek Chat Completions：必须降级为普通 function tool。

本文只讨论 DeepSeek Chat Completions 中 `apply_patch` 的模型可见说明
（model-visible instructions）和 wire shape。真实 patch 解析、审批、
sandbox、hook、diff tracker 和文件写入语义保持不变。

## 当前实现事实

`apply_patch` 在 Codex Core 中分为四层：

- Tool spec：`create_apply_patch_freeform_tool` 从 `apply_patch.lark`
  生成 freeform tool。
- Chat Completions adapter：`chat_tool_from_apply_patch` 把 freeform
  `apply_patch` 桥接为普通 function tool。
- Tool router：DeepSeek 返回的 `apply_patch({ "input": "..." })`
  被还原为 `ToolPayload::Custom { input }`。
- Tool handler：`ApplyPatchHandler` 只接受 raw patch string，并调用
  `codex_apply_patch::parse_patch` 解析。

因此，DeepSeek 路径不需要改变内部执行模型。缺口只在模型可见
说明：Chat Completions request 不能携带 Lark grammar，现有
function tool description 不足以稳定教会模型生成 raw patch。

## 问题定义

DeepSeek Chat Completions 不支持 OpenAI Responses 的 custom/freeform
tool grammar。若仍把 `apply_patch` 暴露给模型，模型只能看到普通
function schema：

```json
{
  "name": "apply_patch",
  "parameters": {
    "type": "object",
    "properties": {
      "input": { "type": "string" }
    },
    "required": ["input"]
  }
}
```

该 schema 只能说明 `input` 是 string，不能表达：

- patch 必须以 `*** Begin Patch` 开始。
- patch 必须以 `*** End Patch` 结束。
- 每个文件操作必须使用 Add/Delete/Update header。
- 新增文件内容行必须以 `+` 开头。
- Update hunk 使用 `@@` 和 ` `、`-`、`+` 行前缀。
- 文件路径必须是相对路径。

如果不补充这些说明，DeepSeek 可能生成 JSON 包裹错误、shell command
形式、普通 unified diff，或缺失 `+` 前缀的新文件内容。

## 参考基准

DeepSeek 专用描述应以 `codex-rs/core/gpt_5_2_prompt.md` 的
`## apply_patch` 段落为改写基准。

选择该基准的原因：

- 它描述的是 `apply_patch` tool，而不是 shell command。
- 它的语义匹配 Chat Completions function tool。
- 它包含最小可用 patch envelope、文件操作 header 和示例。
- 它避免把模型引导到 `shell {"command": ...}` 调用形状。

`codex-rs/apply-patch/apply_patch_tool_instructions.md` 只作为细节参考。
该文件当前写法面向旧模型和 shell command fallback：

- 开头是 `Use the apply_patch shell command`。
- 末尾示例是 `shell {"command":["apply_patch", "..."]}`。
- 代码注释说明它是给 `gpt-4.1` 使用的详细说明。

因此不能原样插入 DeepSeek Chat Completions tool description。
可从该文件借用更完整的细节，例如 `*** Move to`、多级 `@@` context、
相对路径限制，但必须删除或改写 shell command 相关措辞。

DeepSeek v4 没有系统性训练过 Codex 的 apply_patch patch 格式，tool
description 应包含一个短 few-shot。该 few-shot 应来自
`gpt_5_2_prompt.md` 的 raw patch 示例，而不是
`apply_patch_tool_instructions.md` 末尾的 shell 调用示例。

## 设计决策

DeepSeek Chat Completions 使用专用 function tool 描述
（provider-adapted tool description）。

推荐生成位置：

- `codex-rs/core/src/chat_completions.rs`
- 函数：`chat_tool_from_apply_patch`
- 作用范围：仅 Chat Completions request adapter

该位置是最小改动点：

- Responses API 仍使用 freeform tool 和 Lark grammar。
- DeepSeek catalog 不需要塞入额外 base instructions。
- `ApplyPatchHandler` 不需要接受 function payload。
- `ToolRouter` 现有 `{ input }` 到 custom payload 的桥接保持不变。
- 普通 function tools 不受影响。

## Tool 描述形状

Chat Completions 下的 `apply_patch` function description 应包含：

- `apply_patch` 是文件编辑工具，不是 shell command。
- 函数参数对象只包含 `input`。
- `input` 是完整 raw patch text。
- 写 patch 前必须先确认目标文件上下文，避免 stale read 或 blind edit。
- raw patch 必须直接从 `*** Begin Patch` 开始。
- raw patch 必须以 `*** End Patch` 结束。
- 不要把 patch body 再包一层 JSON 字符串或 Markdown code fence。

`input` 字段 description 应明确：

```text
Complete raw apply_patch patch text. It must begin with
*** Begin Patch and end with *** End Patch.
```

函数 description 可采用以下压缩内容：

```text
Use the apply_patch tool to edit files. Call this function with an object
whose input field is the complete raw patch text.

Before editing, protect the write by confirming the target file context.
For every file you update or delete, first check whether the file exists
and read enough current content to avoid stale or blind edits: either the
full file with its total line count, or the intended edit region with at
least 50 lines before and 50 lines after. For Add File, first confirm the
target path does not already exist. Do not generate a patch from memory
alone when the file may already exist.

The patch language is a stripped-down, file-oriented diff format:

*** Begin Patch
[ one or more file sections ]
*** End Patch

Each file operation starts with one of:
*** Add File: <path>
*** Delete File: <path>
*** Update File: <path>

For Add File, every content line must start with +.
For Update File, use @@ hunks and prefix unchanged, removed, and added
lines with space, -, and + respectively.
File paths must be relative.
Do not wrap the patch in Markdown or shell syntax.

Example input value:
*** Begin Patch
*** Add File: hello.txt
+Hello world
*** Update File: src/app.py
*** Move to: src/main.py
@@ def greet():
-print("Hi")
+print("Hello, world!")
*** Delete File: obsolete.txt
*** End Patch
```

示例应展示 function `input` 内部的 raw patch，而不是 shell command。

## 不推荐方案

不推荐把 `apply_patch_tool_instructions.md` 全量追加到 DeepSeek
base instructions：

- 会污染所有 turn 的 base prompt。
- 会增加 prompt cache 负担。
- 会把 shell command 示例暴露给 DeepSeek。
- 会让 provider 适配逻辑分散到模型提示模板中。

不推荐让 DeepSeek catalog 的 `base_instructions` 直接包含专用说明：

- `apply_patch` 是否暴露取决于 feature 和 environment。
- catalog 不知道本 turn 是否有 tool。
- tool 行为应由 tool spec 或 adapter 描述，而不是模型目录静态文本。

不推荐让 `ApplyPatchHandler` 同时接受 function payload：

- router 已经完成 `{ input }` 到 custom payload 的转换。
- handler 继续只处理 raw patch string 更简单。
- hook、post-tool output 和 code mode 结果不需要改。

## 验收标准

实现完成后应满足：

- DeepSeek Chat Completions request 中 `apply_patch` 是 function tool。
- `apply_patch` function schema 仍只有必填 string 字段 `input`。
- function 或 `input` description 包含 patch envelope 和文件操作规则。
- description 不包含 `shell {"command": ...}` 示例。
- OpenAI Responses 的 freeform `apply_patch` tool 不受影响。
- 模型返回 `apply_patch({ "input": "*** Begin Patch\n..." })`
  后仍能进入 `ApplyPatchHandler`。

## 测试建议

窄测试优先：

- `chat_completions` 单元测试断言 `apply_patch` function description
  包含 patch envelope、Add/Update/Delete 和 `input` 字段说明。
- `chat_completions` 单元测试断言 description 不包含 `shell {"command"`。
- `router_tests::build_tool_call_bridges_apply_patch_args` 继续覆盖
  `{ input }` 到 `ToolPayload::Custom` 的桥接。

若只改 description，不需要 live DeepSeek API 测试。若后续发现
DeepSeek 对长 function description 有长度或内容限制，再增加真实
provider 验证。

## 回滚条件

满足任一条件应回滚或改为更短描述：

- DeepSeek 拒绝带长 description 的 tool schema。
- DeepSeek 因 description 太长明显降低 tool call 稳定性。
- Chat Completions adapter 开始支持原生 custom/freeform grammar。
- 上游 Codex 提供正式的 non-freeform `apply_patch` tool schema。
