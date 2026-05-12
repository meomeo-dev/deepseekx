use codex_api::ChatCompletionsRequest;
use codex_api::ChatFunctionCall;
use codex_api::ChatFunctionTool;
use codex_api::ChatMessage;
use codex_api::ChatReasoningEffort;
use codex_api::ChatResponseFormat;
use codex_api::ChatResponseFormatType;
use codex_api::ChatStreamOptions;
use codex_api::ChatThinking;
use codex_api::ChatThinkingType;
use codex_api::ChatTool;
use codex_api::ChatToolCall;
use codex_api::ChatToolChoice;
use codex_api::ChatToolChoiceMode;
use codex_api::ChatToolType;
use codex_protocol::error::CodexErr;
use codex_protocol::error::Result;
use codex_protocol::models::ContentItem;
use codex_protocol::models::FunctionCallOutputBody;
use codex_protocol::models::ReasoningItemContent;
use codex_protocol::models::ResponseItem;
use codex_protocol::openai_models::ModelInfo;
use codex_protocol::openai_models::ReasoningEffort;
use codex_tools::AdditionalProperties;
use codex_tools::FreeformTool;
use codex_tools::JsonSchema;
use codex_tools::ResponsesApiTool;
use codex_tools::ToolSpec;
use std::collections::BTreeMap;

use crate::client_common::Prompt;

pub(crate) const APPLY_PATCH_CHAT_COMPLETIONS_INPUT_FIELD: &str = "input";
pub(crate) const APPLY_PATCH_TOOL_NAME: &str = "apply_patch";

const UNSUPPORTED_IMAGES_MESSAGE: &str = concat!(
    "Chat Completions request adapter ",
    "does not support images",
);

pub(crate) fn build_chat_completions_request(
    prompt: &Prompt,
    model_info: &ModelInfo,
    effort: Option<ReasoningEffort>,
) -> Result<ChatCompletionsRequest> {
    let mut messages = Vec::new();
    if !prompt.base_instructions.text.is_empty() {
        messages.push(ChatMessage::System {
            content: prompt.base_instructions.text.clone(),
            name: None,
        });
    }
    messages.extend(chat_messages_from_items(&prompt.get_formatted_input())?);
    let tools = chat_tools_from_specs(&prompt.tools)?;

    Ok(ChatCompletionsRequest {
        model: model_info.slug.clone(),
        messages,
        tools,
        tool_choice: Some(ChatToolChoice::Mode(ChatToolChoiceMode::Auto)),
        thinking: chat_thinking(model_info, effort),
        reasoning_effort: chat_reasoning_effort(model_info, effort),
        response_format: prompt.output_schema.as_ref().map(|_| ChatResponseFormat {
            r#type: ChatResponseFormatType::JsonObject,
        }),
        stream: true,
        stream_options: Some(ChatStreamOptions {
            include_usage: true,
        }),
    })
}

fn chat_messages_from_items(items: &[ResponseItem]) -> Result<Vec<ChatMessage>> {
    let mut messages = Vec::new();
    let mut segment_start = 0;

    for (index, item) in items.iter().enumerate() {
        if let ResponseItem::Message { role, content, .. } = item
            && role == "user"
        {
            append_chat_messages_from_segment(&items[segment_start..index], &mut messages)?;
            messages.push(chat_message_from_content(role, content, None)?);
            segment_start = index + 1;
        }
    }

    append_chat_messages_from_segment(&items[segment_start..], &mut messages)?;
    Ok(messages)
}

fn append_chat_messages_from_segment(
    items: &[ResponseItem],
    messages: &mut Vec<ChatMessage>,
) -> Result<()> {
    let has_tool_call = items.iter().any(is_supported_chat_tool_call);
    let mut pending_reasoning_content: Option<String> = None;
    let mut index = 0;

    while index < items.len() {
        let item = &items[index];
        match item {
            ResponseItem::Reasoning { content, .. } => {
                pending_reasoning_content = reasoning_content_text(content.as_deref());
                index += 1;
            }
            ResponseItem::Message { role, content, .. } if role == "assistant" => {
                let content = Some(content_text(content)?);
                let (tool_calls, next_index) = collect_chat_tool_calls(items, index + 1)?;
                messages.push(ChatMessage::Assistant {
                    content,
                    name: None,
                    prefix: None,
                    reasoning_content: has_tool_call
                        .then(|| pending_reasoning_content.take())
                        .flatten(),
                    tool_calls,
                });
                index = next_index;
            }
            ResponseItem::Message { role, content, .. } => {
                pending_reasoning_content = None;
                messages.push(chat_message_from_content(role, content, None)?);
                index += 1;
            }
            ResponseItem::FunctionCall { .. } | ResponseItem::CustomToolCall { .. } => {
                let (tool_calls, next_index) = collect_chat_tool_calls(items, index)?;
                messages.push(ChatMessage::Assistant {
                    content: None,
                    name: None,
                    prefix: None,
                    reasoning_content: pending_reasoning_content.take(),
                    tool_calls,
                });
                index = next_index;
            }
            ResponseItem::FunctionCallOutput { call_id, output } => {
                messages.push(ChatMessage::Tool {
                    content: function_output_text(output)?,
                    tool_call_id: call_id.clone(),
                });
                index += 1;
            }
            ResponseItem::CustomToolCallOutput {
                call_id, output, ..
            } => {
                messages.push(ChatMessage::Tool {
                    content: function_output_text(output)?,
                    tool_call_id: call_id.clone(),
                });
                index += 1;
            }
            ResponseItem::LocalShellCall { .. }
            | ResponseItem::ToolSearchCall { .. }
            | ResponseItem::ToolSearchOutput { .. }
            | ResponseItem::WebSearchCall { .. }
            | ResponseItem::ImageGenerationCall { .. } => {
                return Err(unsupported_item(item));
            }
            ResponseItem::Compaction { .. }
            | ResponseItem::ContextCompaction { .. }
            | ResponseItem::Other => {
                index += 1;
            }
        }
    }

    Ok(())
}

fn collect_chat_tool_calls(
    items: &[ResponseItem],
    mut index: usize,
) -> Result<(Option<Vec<ChatToolCall>>, usize)> {
    let mut tool_calls = Vec::new();

    while index < items.len() {
        let Some(tool_call) = chat_tool_call_from_item(&items[index])? else {
            break;
        };
        tool_calls.push(tool_call);
        index += 1;
    }

    Ok(((!tool_calls.is_empty()).then_some(tool_calls), index))
}

fn chat_tool_call_from_item(item: &ResponseItem) -> Result<Option<ChatToolCall>> {
    match item {
        ResponseItem::FunctionCall {
            name,
            arguments,
            call_id,
            ..
        } => Ok(Some(ChatToolCall {
            id: call_id.clone(),
            r#type: ChatToolType::Function,
            function: ChatFunctionCall {
                name: name.clone(),
                arguments: arguments.clone(),
            },
        })),
        ResponseItem::CustomToolCall {
            name,
            input,
            call_id,
            ..
        } if name == APPLY_PATCH_TOOL_NAME => Ok(Some(ChatToolCall {
            id: call_id.clone(),
            r#type: ChatToolType::Function,
            function: ChatFunctionCall {
                name: name.clone(),
                arguments: apply_patch_chat_arguments(input)?,
            },
        })),
        ResponseItem::CustomToolCall { .. } => Err(unsupported_item(item)),
        _ => Ok(None),
    }
}

fn is_supported_chat_tool_call(item: &ResponseItem) -> bool {
    match item {
        ResponseItem::FunctionCall { .. } => true,
        ResponseItem::CustomToolCall { name, .. } => name == APPLY_PATCH_TOOL_NAME,
        _ => false,
    }
}

fn chat_message_from_content(
    role: &str,
    content: &[ContentItem],
    reasoning_content: Option<String>,
) -> Result<ChatMessage> {
    let text = content_text(content)?;
    match role {
        "system" | "developer" => Ok(ChatMessage::System {
            content: text,
            name: None,
        }),
        "user" => Ok(ChatMessage::User {
            content: text,
            name: None,
        }),
        "assistant" => Ok(ChatMessage::Assistant {
            content: Some(text),
            name: None,
            prefix: None,
            reasoning_content,
            tool_calls: None,
        }),
        _ => Err(CodexErr::UnsupportedOperation(format!(
            "Chat Completions does not support message role `{role}`"
        ))),
    }
}

fn content_text(content: &[ContentItem]) -> Result<String> {
    let mut parts = Vec::new();
    for item in content {
        match item {
            ContentItem::InputText { text } | ContentItem::OutputText { text } => {
                parts.push(text.clone());
            }
            ContentItem::InputImage { .. } => {
                return Err(CodexErr::UnsupportedOperation(
                    UNSUPPORTED_IMAGES_MESSAGE.to_string(),
                ));
            }
        }
    }
    Ok(parts.join("\n"))
}

fn reasoning_content_text(content: Option<&[ReasoningItemContent]>) -> Option<String> {
    let parts = content?.iter().map(reasoning_item_text).collect::<Vec<_>>();
    (!parts.is_empty()).then(|| parts.join("\n"))
}

fn reasoning_item_text(item: &ReasoningItemContent) -> &str {
    match item {
        ReasoningItemContent::ReasoningText { text } => text.as_str(),
        ReasoningItemContent::Text { text } => text.as_str(),
    }
}

fn function_output_text(
    output: &codex_protocol::models::FunctionCallOutputPayload,
) -> Result<String> {
    match &output.body {
        FunctionCallOutputBody::Text(text) => Ok(text.clone()),
        FunctionCallOutputBody::ContentItems(_) => {
            let message = "Chat Completions request adapter does not support \
                structured tool output";
            Err(CodexErr::UnsupportedOperation(message.to_string()))
        }
    }
}

fn chat_tools_from_specs(tools: &[ToolSpec]) -> Result<Vec<ChatTool>> {
    tools
        .iter()
        .map(|tool| match tool {
            ToolSpec::Function(function) => Ok(chat_tool_from_function(function)),
            ToolSpec::Freeform(freeform) if freeform.name == APPLY_PATCH_TOOL_NAME => {
                Ok(chat_tool_from_apply_patch(freeform))
            }
            ToolSpec::Namespace(_)
            | ToolSpec::ToolSearch { .. }
            | ToolSpec::LocalShell {}
            | ToolSpec::ImageGeneration { .. }
            | ToolSpec::WebSearch { .. }
            | ToolSpec::Freeform(_) => Err(CodexErr::UnsupportedOperation(format!(
                "Chat Completions request adapter does not support `{}` tools",
                tool.name()
            ))),
        })
        .collect()
}

fn chat_tool_from_apply_patch(freeform: &FreeformTool) -> ChatTool {
    let mut properties = BTreeMap::new();
    properties.insert(
        APPLY_PATCH_CHAT_COMPLETIONS_INPUT_FIELD.to_string(),
        JsonSchema::string(Some(
            "Raw apply_patch input beginning with *** Begin Patch.".to_string(),
        )),
    );
    let parameters = JsonSchema::object(
        properties,
        Some(vec![APPLY_PATCH_CHAT_COMPLETIONS_INPUT_FIELD.to_string()]),
        Some(AdditionalProperties::Boolean(false)),
    );

    ChatTool {
        r#type: ChatToolType::Function,
        function: ChatFunctionTool {
            name: freeform.name.clone(),
            description: Some(freeform.description.clone()),
            parameters: serde_json::to_value(parameters).ok(),
            strict: Some(true),
        },
    }
}

fn chat_tool_from_function(function: &ResponsesApiTool) -> ChatTool {
    let parameters = serde_json::to_value(&function.parameters).unwrap_or_default();
    ChatTool {
        r#type: ChatToolType::Function,
        function: ChatFunctionTool {
            name: function.name.clone(),
            description: Some(function.description.clone()),
            parameters: Some(parameters),
            strict: Some(function.strict),
        },
    }
}

fn apply_patch_chat_arguments(input: &str) -> Result<String> {
    serde_json::to_string(&serde_json::json!({
        APPLY_PATCH_CHAT_COMPLETIONS_INPUT_FIELD: input,
    }))
    .map_err(|err| {
        let message = format!("failed to encode apply_patch arguments: {err}");
        CodexErr::UnsupportedOperation(message)
    })
}

fn chat_thinking(model_info: &ModelInfo, effort: Option<ReasoningEffort>) -> Option<ChatThinking> {
    if !model_info.supports_reasoning_summaries {
        return None;
    }

    let r#type = match effort.or(model_info.default_reasoning_level) {
        Some(ReasoningEffort::None | ReasoningEffort::Minimal) => ChatThinkingType::Disabled,
        Some(_) => ChatThinkingType::Enabled,
        None => return None,
    };
    Some(ChatThinking { r#type })
}

fn chat_reasoning_effort(
    model_info: &ModelInfo,
    effort: Option<ReasoningEffort>,
) -> Option<ChatReasoningEffort> {
    if !model_info.supports_reasoning_summaries {
        return None;
    }
    match effort.or(model_info.default_reasoning_level) {
        Some(ReasoningEffort::XHigh) => Some(ChatReasoningEffort::Max),
        Some(ReasoningEffort::High) => Some(ChatReasoningEffort::High),
        Some(ReasoningEffort::Medium) => Some(ChatReasoningEffort::High),
        Some(ReasoningEffort::Low) => Some(ChatReasoningEffort::High),
        Some(ReasoningEffort::None | ReasoningEffort::Minimal) | None => None,
    }
}

fn unsupported_item(item: &ResponseItem) -> CodexErr {
    let name = match item {
        ResponseItem::LocalShellCall { .. } => "local shell call",
        ResponseItem::ToolSearchCall { .. } => "tool search call",
        ResponseItem::CustomToolCall { .. } => "custom tool call",
        ResponseItem::CustomToolCallOutput { .. } => "custom tool call output",
        ResponseItem::ToolSearchOutput { .. } => "tool search output",
        ResponseItem::WebSearchCall { .. } => "web search call",
        ResponseItem::ImageGenerationCall { .. } => "image generation call",
        ResponseItem::Message { .. }
        | ResponseItem::Reasoning { .. }
        | ResponseItem::FunctionCall { .. }
        | ResponseItem::FunctionCallOutput { .. }
        | ResponseItem::Compaction { .. }
        | ResponseItem::ContextCompaction { .. }
        | ResponseItem::Other => "unknown item",
    };
    CodexErr::UnsupportedOperation(format!(
        "Chat Completions request adapter does not support {name}"
    ))
}

#[cfg(test)]
mod tests {
    use codex_api::ChatMessage;
    use codex_api::ChatReasoningEffort;
    use codex_api::ChatResponseFormatType;
    use codex_api::ChatThinkingType;
    use codex_api::ChatToolType;
    use codex_protocol::models::BaseInstructions;
    use codex_protocol::models::ContentItem;
    use codex_protocol::models::FunctionCallOutputPayload;
    use codex_protocol::models::ReasoningItemContent;
    use codex_protocol::models::ReasoningItemReasoningSummary;
    use codex_protocol::models::ResponseItem;
    use codex_protocol::openai_models::ModelInfo;
    use codex_protocol::openai_models::ReasoningEffort;
    use codex_tools::JsonSchema;
    use codex_tools::ResponsesApiTool;
    use codex_tools::ToolSpec;
    use pretty_assertions::assert_eq;

    use super::*;

    #[test]
    fn builds_basic_chat_request_with_json_output() {
        let prompt = Prompt {
            base_instructions: BaseInstructions {
                text: "You are concise.".to_string(),
            },
            input: vec![
                text_message("user", "Hi"),
                text_message("assistant", "Hello"),
                text_message("user", "Return JSON"),
            ],
            output_schema: Some(serde_json::json!({
                "type": "object",
                "properties": { "answer": { "type": "string" } }
            })),
            ..Prompt::default()
        };

        let effort = Some(ReasoningEffort::XHigh);
        let model = model_info();
        let request = build_chat_completions_request(&prompt, &model, effort).unwrap();

        assert_eq!(request.model, "deepseek-v4-pro");
        assert_eq!(request.messages.len(), 4);
        assert!(matches!(&request.messages[0], ChatMessage::System { .. }));
        assert_eq!(
            request.response_format.unwrap().r#type,
            ChatResponseFormatType::JsonObject
        );
        assert_eq!(request.reasoning_effort, Some(ChatReasoningEffort::Max));
        assert_eq!(request.thinking.unwrap().r#type, ChatThinkingType::Enabled);
        assert!(request.stream_options.unwrap().include_usage);
    }

    #[test]
    fn builds_request_with_resolved_model_slug() {
        let prompt = Prompt {
            input: vec![text_message("user", "Hi")],
            ..Prompt::default()
        };
        let mut model = model_info();
        model.slug = "deepseek-v4-flash".to_string();
        model.context_window = Some(1_000_000);

        let request = build_chat_completions_request(&prompt, &model, None).unwrap();

        assert_eq!(request.model, "deepseek-v4-flash");
    }

    #[test]
    fn preserves_reasoning_content_for_tool_call_history() {
        let prompt = Prompt {
            input: vec![
                text_message("user", "Need weather"),
                ResponseItem::Reasoning {
                    id: "rs_1".to_string(),
                    summary: vec![ReasoningItemReasoningSummary::SummaryText {
                        text: "summary".to_string(),
                    }],
                    content: Some(vec![ReasoningItemContent::ReasoningText {
                        text: "raw reasoning".to_string(),
                    }]),
                    encrypted_content: None,
                },
                ResponseItem::FunctionCall {
                    id: None,
                    name: "get_weather".to_string(),
                    namespace: None,
                    arguments: "{\"location\":\"Hangzhou\"}".to_string(),
                    call_id: "call_1".to_string(),
                },
                ResponseItem::FunctionCallOutput {
                    call_id: "call_1".to_string(),
                    output: FunctionCallOutputPayload::from_text("24C".to_string()),
                },
            ],
            tools: vec![weather_tool()],
            ..Prompt::default()
        };

        let model = model_info();
        let request = build_chat_completions_request(&prompt, &model, None).unwrap();

        let ChatMessage::Assistant {
            reasoning_content,
            tool_calls,
            ..
        } = &request.messages[2]
        else {
            panic!("expected assistant tool call message");
        };
        assert_eq!(reasoning_content.as_deref(), Some("raw reasoning"));
        assert_eq!(tool_calls.as_ref().unwrap()[0].id, "call_1");
        assert_eq!(request.tools[0].function.name, "get_weather");
        assert!(matches!(&request.messages[3], ChatMessage::Tool { .. }));
    }

    #[test]
    fn drops_reasoning_content_for_non_tool_history() {
        let prompt = Prompt {
            input: vec![
                text_message("user", "Compare 9.11 and 9.8"),
                reasoning_item("ignored reasoning"),
                text_message("assistant", "9.8 is greater."),
                text_message("user", "Now call a tool"),
                reasoning_item("tool reasoning"),
                ResponseItem::FunctionCall {
                    id: None,
                    name: "get_weather".to_string(),
                    namespace: None,
                    arguments: "{\"location\":\"Hangzhou\"}".to_string(),
                    call_id: "call_1".to_string(),
                },
            ],
            tools: vec![weather_tool()],
            ..Prompt::default()
        };

        let request = build_chat_completions_request(&prompt, &model_info(), None).unwrap();

        let ChatMessage::Assistant {
            reasoning_content,
            tool_calls,
            ..
        } = &request.messages[2]
        else {
            panic!("expected assistant answer message");
        };
        assert_eq!(reasoning_content, &None);
        assert_eq!(tool_calls, &None);

        let ChatMessage::Assistant {
            reasoning_content,
            tool_calls,
            ..
        } = &request.messages[4]
        else {
            panic!("expected assistant tool call message");
        };
        assert_eq!(reasoning_content.as_deref(), Some("tool reasoning"));
        assert_eq!(tool_calls.as_ref().unwrap()[0].id, "call_1");
    }

    #[test]
    fn preserves_final_answer_reasoning_for_tool_turn_history() {
        let prompt = Prompt {
            input: vec![
                text_message("user", "Need weather"),
                reasoning_item("tool reasoning"),
                ResponseItem::FunctionCall {
                    id: None,
                    name: "get_weather".to_string(),
                    namespace: None,
                    arguments: "{\"location\":\"Hangzhou\"}".to_string(),
                    call_id: "call_1".to_string(),
                },
                ResponseItem::FunctionCallOutput {
                    call_id: "call_1".to_string(),
                    output: FunctionCallOutputPayload::from_text("24C".to_string()),
                },
                reasoning_item("final reasoning"),
                text_message("assistant", "It is 24C."),
            ],
            tools: vec![weather_tool()],
            ..Prompt::default()
        };

        let request = build_chat_completions_request(&prompt, &model_info(), None).unwrap();

        let ChatMessage::Assistant {
            reasoning_content,
            tool_calls,
            ..
        } = &request.messages[2]
        else {
            panic!("expected assistant tool call message");
        };
        assert_eq!(reasoning_content.as_deref(), Some("tool reasoning"));
        assert_eq!(tool_calls.as_ref().unwrap()[0].id, "call_1");

        let ChatMessage::Assistant {
            content,
            reasoning_content,
            tool_calls,
            ..
        } = &request.messages[4]
        else {
            panic!("expected assistant final message");
        };
        assert_eq!(content.as_deref(), Some("It is 24C."));
        assert_eq!(reasoning_content.as_deref(), Some("final reasoning"));
        assert_eq!(tool_calls, &None);
    }

    #[test]
    fn can_disable_deepseek_thinking_with_none_reasoning_effort() {
        let request = build_chat_completions_request(
            &Prompt::default(),
            &model_info(),
            Some(ReasoningEffort::None),
        )
        .unwrap();

        assert_eq!(request.thinking.unwrap().r#type, ChatThinkingType::Disabled);
        assert_eq!(request.reasoning_effort, None);
    }

    #[test]
    fn bridges_apply_patch_custom_tool_to_chat_function_tool() {
        let patch = "*** Begin Patch\n*** Add File: demo.txt\n+ok\n*** End Patch\n";
        let prompt = Prompt {
            input: vec![
                text_message("user", "Create a file"),
                ResponseItem::CustomToolCall {
                    id: None,
                    status: None,
                    call_id: "patch-call".to_string(),
                    name: "apply_patch".to_string(),
                    input: patch.to_string(),
                },
                ResponseItem::CustomToolCallOutput {
                    call_id: "patch-call".to_string(),
                    name: Some("apply_patch".to_string()),
                    output: FunctionCallOutputPayload::from_text("Done".to_string()),
                },
            ],
            tools: vec![apply_patch_tool()],
            ..Prompt::default()
        };

        let model = model_info();
        let request = build_chat_completions_request(&prompt, &model, None).unwrap();

        assert_eq!(request.tools.len(), 1);
        assert_eq!(request.tools[0].r#type, ChatToolType::Function);
        assert_eq!(request.tools[0].function.name, "apply_patch");
        let ChatMessage::Assistant { tool_calls, .. } = &request.messages[2] else {
            panic!("expected assistant tool call message");
        };
        let function = &tool_calls.as_ref().unwrap()[0].function;
        assert_eq!(function.name, "apply_patch");
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&function.arguments).unwrap(),
            serde_json::json!({ "input": patch })
        );
        assert!(matches!(&request.messages[3], ChatMessage::Tool { .. }));
    }

    #[test]
    fn rejects_unsupported_hosted_tools() {
        let prompt = Prompt {
            tools: vec![ToolSpec::WebSearch {
                external_web_access: Some(true),
                filters: None,
                user_location: None,
                search_context_size: None,
                search_content_types: None,
            }],
            ..Prompt::default()
        };

        let err = build_chat_completions_request(&prompt, &model_info(), None)
            .unwrap_err()
            .to_string();

        assert!(err.contains("web_search"));
    }

    fn text_message(role: &str, text: &str) -> ResponseItem {
        ResponseItem::Message {
            id: None,
            role: role.to_string(),
            content: vec![ContentItem::InputText {
                text: text.to_string(),
            }],
            phase: None,
        }
    }

    fn reasoning_item(text: &str) -> ResponseItem {
        ResponseItem::Reasoning {
            id: "rs_1".to_string(),
            summary: vec![ReasoningItemReasoningSummary::SummaryText {
                text: "summary".to_string(),
            }],
            content: Some(vec![ReasoningItemContent::ReasoningText {
                text: text.to_string(),
            }]),
            encrypted_content: None,
        }
    }

    fn weather_tool() -> ToolSpec {
        ToolSpec::Function(ResponsesApiTool {
            name: "get_weather".to_string(),
            description: "Get weather.".to_string(),
            strict: false,
            defer_loading: None,
            parameters: JsonSchema::default(),
            output_schema: None,
        })
    }

    fn apply_patch_tool() -> ToolSpec {
        crate::tools::handlers::apply_patch_spec::create_apply_patch_freeform_tool()
    }

    fn model_info() -> ModelInfo {
        serde_json::from_value(serde_json::json!({
            "slug": "deepseek-v4-pro",
            "display_name": "DeepSeek V4 Pro",
            "description": null,
            "default_reasoning_level": "high",
            "supported_reasoning_levels": [],
            "shell_type": "shell_command",
            "visibility": "list",
            "supported_in_api": true,
            "priority": 0,
            "availability_nux": null,
            "upgrade": null,
            "base_instructions": "",
            "supports_reasoning_summaries": true,
            "support_verbosity": false,
            "default_verbosity": null,
            "apply_patch_tool_type": null,
            "truncation_policy": {"mode": "bytes", "limit": 10000},
            "supports_parallel_tool_calls": true,
            "supports_image_detail_original": false,
            "context_window": 128000,
            "auto_compact_token_limit": null,
            "experimental_supported_tools": []
        }))
        .unwrap()
    }
}
