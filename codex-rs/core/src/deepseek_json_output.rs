use async_trait::async_trait;
use codex_api::ApiError;
use codex_api::ChatCompletionsRequest;
use codex_api::ChatMessage;
use codex_api::ChatNamedToolChoice;
use codex_api::ChatNamedToolChoiceFunction;
use codex_api::ChatStreamOptions;
use codex_api::ChatToolChoice;
use codex_api::ChatToolType;
use codex_api::ResponseEvent;
use codex_apply_patch::Hunk;
use codex_exec_server::CopyOptions;
use codex_exec_server::CreateDirectoryOptions;
use codex_exec_server::ExecutorFileSystem;
use codex_exec_server::FileMetadata;
use codex_exec_server::FileSystemResult;
use codex_exec_server::FileSystemSandboxContext;
use codex_exec_server::ReadDirectoryEntry;
use codex_exec_server::RemoveOptions;
use codex_protocol::models::ContentItem;
use codex_protocol::models::MessagePhase;
use codex_protocol::models::ResponseItem;
use codex_utils_absolute_path::AbsolutePathBuf;
use futures::StreamExt;
use serde_json::Value;
use std::io;
use std::path::Path;
use std::sync::Arc;
use std::sync::Mutex;
use tokio_util::sync::CancellationToken;

pub(crate) const RESPONSE_JSON_FILE: &str = "response.json";
pub(crate) const APPLY_JSON_OUTPUT_PATCH_TOOL: &str = "apply_json_output_patch";
pub(crate) const APPLY_JSON_OUTPUT_PATCH_INPUT_FIELD: &str = "input";
pub(crate) const MAX_REPAIR_ATTEMPTS: usize = 3;

#[derive(Debug)]
pub(crate) struct DeepSeekJsonOutputCapture {
    pub(crate) response_id: String,
    pub(crate) token_usage: Option<codex_protocol::protocol::TokenUsage>,
    pub(crate) end_turn: Option<bool>,
    pub(crate) content: String,
    pub(crate) has_tool_call: bool,
    pub(crate) buffered_events: Vec<ResponseEvent>,
}

#[derive(Debug)]
pub(crate) struct JsonRepairOutcome {
    pub(crate) content: String,
}

#[derive(Debug)]
pub(crate) struct JsonValidationFailure {
    pub(crate) content: String,
    pub(crate) error: String,
}

pub(crate) enum JsonValidationOutcome {
    Valid(JsonRepairOutcome),
    Invalid(JsonValidationFailure),
}

#[derive(Debug)]
struct CapturedCompletion {
    response_id: String,
    token_usage: Option<codex_protocol::protocol::TokenUsage>,
    end_turn: Option<bool>,
}

pub(crate) fn deepseek_json_output_instructions(schema: &Value) -> String {
    let schema_text = pretty_schema(schema);
    format!(
        "Your final response must be a JSON object. Return valid json only. \
         Do not wrap it in Markdown, \
         prose, or a code block.\n\nThe JSON object must satisfy this JSON \
         Schema:\n{schema_text}\n\nExample JSON output:\n{{}}\n\nReturn only \
         the JSON object."
    )
}

pub(crate) fn deepseek_json_repair_instructions(schema: &Value, error: &str) -> String {
    let schema_text = pretty_schema(schema);
    format!(
        "The current response.json file is invalid for the required JSON Schema. \
         Use the {APPLY_JSON_OUTPUT_PATCH_TOOL} tool to patch only \
         response.json. Do not answer the user again. Do not modify any other \
         file.\n\nThe tool input must be an apply_patch document beginning with \
         *** Begin Patch and ending with *** End Patch.\n\nValidation error:\n\
         {error}\n\nRequired JSON Schema:\n{schema_text}"
    )
}

fn pretty_schema(schema: &Value) -> String {
    serde_json::to_string_pretty(schema).unwrap_or_else(|_| schema.to_string())
}

pub(crate) fn build_deepseek_json_repair_request(
    model: &str,
    schema: &Value,
    current_content: &str,
    error: &str,
    repair_tool_strict: bool,
) -> ChatCompletionsRequest {
    ChatCompletionsRequest {
        model: model.to_string(),
        messages: vec![
            ChatMessage::System {
                content: deepseek_json_repair_instructions(schema, error),
                name: None,
            },
            ChatMessage::User {
                content: format!(
                    "Current {RESPONSE_JSON_FILE} content:\n```json\n\
                     {current_content}\n```"
                ),
                name: None,
            },
        ],
        tools: vec![repair_tool_schema(repair_tool_strict)],
        tool_choice: Some(ChatToolChoice::Function(ChatNamedToolChoice {
            r#type: ChatToolType::Function,
            function: ChatNamedToolChoiceFunction {
                name: APPLY_JSON_OUTPUT_PATCH_TOOL.to_string(),
            },
        })),
        thinking: None,
        reasoning_effort: None,
        response_format: None,
        stream: true,
        stream_options: Some(ChatStreamOptions {
            include_usage: true,
        }),
    }
}

fn repair_tool_schema(strict: bool) -> codex_api::ChatTool {
    codex_api::ChatTool {
        r#type: codex_api::ChatToolType::Function,
        function: codex_api::ChatFunctionTool {
            name: APPLY_JSON_OUTPUT_PATCH_TOOL.to_string(),
            description: Some("Patch the virtual response.json file.".to_string()),
            parameters: Some(serde_json::json!({
                "type": "object",
                "additionalProperties": false,
                "properties": {
                    APPLY_JSON_OUTPUT_PATCH_INPUT_FIELD: {
                        "type": "string",
                        "description": "Raw apply_patch input for response.json."
                    }
                },
                "required": [APPLY_JSON_OUTPUT_PATCH_INPUT_FIELD]
            })),
            strict: Some(strict),
        },
    }
}

pub(crate) async fn capture_deepseek_json_output_stream(
    mut stream: codex_api::ResponseStream,
    consumer_dropped: CancellationToken,
) -> Result<DeepSeekJsonOutputCapture, ApiError> {
    let mut buffered_events = Vec::new();
    let mut content = String::new();
    let mut has_tool_call = false;
    loop {
        let event = tokio::select! {
            _ = consumer_dropped.cancelled() => {
                return Err(ApiError::Stream(
                    "response stream dropped before provider terminal event"
                        .to_string(),
                ));
            }
            event = stream.next() => event,
        };
        let Some(event) = event else {
            return Err(ApiError::Stream(
                "stream closed before response.completed".to_string(),
            ));
        };
        let event = event?;
        match event {
            ResponseEvent::OutputTextDelta(delta) => {
                content.push_str(&delta);
                buffered_events.push(ResponseEvent::OutputTextDelta(delta));
            }
            ResponseEvent::OutputItemDone(item) => {
                match &item {
                    ResponseItem::Message {
                        role,
                        content: item_content,
                        phase,
                        ..
                    } if role == "assistant"
                        && matches!(phase, Some(MessagePhase::FinalAnswer)) =>
                    {
                        if let Some(text) = output_text(item_content) {
                            content = text;
                        }
                    }
                    ResponseItem::FunctionCall { .. } => has_tool_call = true,
                    ResponseItem::CustomToolCall { .. } => has_tool_call = true,
                    ResponseItem::Message { .. }
                    | ResponseItem::Reasoning { .. }
                    | ResponseItem::LocalShellCall { .. }
                    | ResponseItem::ToolSearchCall { .. }
                    | ResponseItem::FunctionCallOutput { .. }
                    | ResponseItem::CustomToolCallOutput { .. }
                    | ResponseItem::ToolSearchOutput { .. }
                    | ResponseItem::WebSearchCall { .. }
                    | ResponseItem::ImageGenerationCall { .. }
                    | ResponseItem::Compaction { .. }
                    | ResponseItem::ContextCompaction { .. }
                    | ResponseItem::Other => {}
                }
                buffered_events.push(ResponseEvent::OutputItemDone(item));
            }
            ResponseEvent::Completed {
                response_id,
                token_usage,
                end_turn,
            } => {
                return Ok(DeepSeekJsonOutputCapture {
                    response_id,
                    token_usage,
                    end_turn,
                    content,
                    has_tool_call,
                    buffered_events,
                });
            }
            event => buffered_events.push(event),
        }
    }
}

pub(crate) async fn capture_deepseek_json_repair_patch_stream(
    mut stream: codex_api::ResponseStream,
    consumer_dropped: CancellationToken,
) -> Result<String, ApiError> {
    let mut output_text = String::new();
    loop {
        let event = tokio::select! {
            _ = consumer_dropped.cancelled() => {
                return Err(ApiError::Stream(
                    "repair stream dropped before provider terminal event".to_string(),
                ));
            }
            event = stream.next() => event,
        };
        let Some(event) = event else {
            return Err(ApiError::Stream(
                "repair stream closed before response.completed".to_string(),
            ));
        };
        match event? {
            ResponseEvent::OutputTextDelta(delta) => output_text.push_str(&delta),
            ResponseEvent::OutputItemDone(item) => {
                if let Some(patch_input) = repair_patch_from_item(item) {
                    let patch_input = patch_input.map_err(repair_api_error)?;
                    return Ok(patch_input);
                }
            }
            ResponseEvent::Completed { .. } => {
                let suffix = if output_text.trim().is_empty() {
                    String::new()
                } else {
                    format!("; model output: {}", output_text.trim())
                };
                return Err(ApiError::Stream(format!(
                    "repair stream completed without {APPLY_JSON_OUTPUT_PATCH_TOOL} \
                     tool call{suffix}"
                )));
            }
            _ => {}
        }
    }
}

fn repair_patch_from_item(item: ResponseItem) -> Option<Result<String, String>> {
    match item {
        ResponseItem::FunctionCall {
            name, arguments, ..
        } if name == APPLY_JSON_OUTPUT_PATCH_TOOL => {
            let patch_input = repair_patch_input(&arguments);
            Some(patch_input)
        }
        ResponseItem::CustomToolCall { name, input, .. }
            if name == APPLY_JSON_OUTPUT_PATCH_TOOL =>
        {
            Some(Ok(input))
        }
        ResponseItem::Message { .. }
        | ResponseItem::Reasoning { .. }
        | ResponseItem::LocalShellCall { .. }
        | ResponseItem::FunctionCall { .. }
        | ResponseItem::ToolSearchCall { .. }
        | ResponseItem::FunctionCallOutput { .. }
        | ResponseItem::CustomToolCall { .. }
        | ResponseItem::CustomToolCallOutput { .. }
        | ResponseItem::ToolSearchOutput { .. }
        | ResponseItem::WebSearchCall { .. }
        | ResponseItem::ImageGenerationCall { .. }
        | ResponseItem::Compaction { .. }
        | ResponseItem::ContextCompaction { .. }
        | ResponseItem::Other => None,
    }
}

fn repair_api_error(error: String) -> ApiError {
    ApiError::Stream(repair_args_error(error))
}

fn repair_patch_input(arguments: &str) -> Result<String, String> {
    let value: Value = serde_json::from_str(arguments)
        .map_err(|err| format!("arguments are not valid JSON: {err}"))?;
    value
        .get(APPLY_JSON_OUTPUT_PATCH_INPUT_FIELD)
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(missing_patch_input_field)
}

fn repair_args_error(error: String) -> String {
    format!("invalid JSON repair tool arguments: {error}")
}

fn missing_patch_input_field() -> String {
    format!("missing string field `{APPLY_JSON_OUTPUT_PATCH_INPUT_FIELD}`")
}

pub(crate) fn validate_json(content: String, schema: &Value) -> JsonValidationOutcome {
    match validate_json_content(&content, schema) {
        Ok(()) => JsonValidationOutcome::Valid(JsonRepairOutcome { content }),
        Err(error) => invalid_json(content, error),
    }
}

fn invalid_json(content: String, error: String) -> JsonValidationOutcome {
    JsonValidationOutcome::Invalid(JsonValidationFailure { content, error })
}

fn validate_json_content(content: &str, schema: &Value) -> Result<(), String> {
    if content.trim().is_empty() {
        return Err("JSON output content is empty".to_string());
    }
    let value: Value = serde_json::from_str(content)
        .map_err(|err| format!("response.json is not valid JSON: {err}"))?;
    let validator = jsonschema::validator_for(schema)
        .map_err(|err| format!("response.json schema is not supported: {err}"))?;
    if let Err(err) = validator.validate(&value) {
        return Err(format!(
            "response.json failed JSON Schema validation: {err}"
        ));
    }
    Ok(())
}

pub(crate) fn release_buffered_json_events(
    capture: DeepSeekJsonOutputCapture,
) -> Vec<ResponseEvent> {
    let DeepSeekJsonOutputCapture {
        response_id,
        token_usage,
        end_turn,
        mut buffered_events,
        ..
    } = capture;
    buffered_events.push(ResponseEvent::Completed {
        response_id,
        token_usage,
        end_turn,
    });
    buffered_events
}

pub(crate) fn release_repaired_json_events(
    capture: DeepSeekJsonOutputCapture,
    content: String,
) -> Vec<ResponseEvent> {
    let completion = CapturedCompletion {
        response_id: capture.response_id,
        token_usage: capture.token_usage,
        end_turn: capture.end_turn,
    };
    vec![
        ResponseEvent::OutputItemAdded(ResponseItem::Message {
            id: None,
            role: "assistant".to_string(),
            content: Vec::new(),
            phase: Some(MessagePhase::FinalAnswer),
        }),
        ResponseEvent::OutputTextDelta(content.clone()),
        ResponseEvent::OutputItemDone(ResponseItem::Message {
            id: None,
            role: "assistant".to_string(),
            content: vec![ContentItem::OutputText { text: content }],
            phase: Some(MessagePhase::FinalAnswer),
        }),
        ResponseEvent::Completed {
            response_id: completion.response_id,
            token_usage: completion.token_usage,
            end_turn: completion.end_turn,
        },
    ]
}

fn output_text(content: &[ContentItem]) -> Option<String> {
    let text = content
        .iter()
        .filter_map(|item| match item {
            ContentItem::OutputText { text } => Some(text.as_str()),
            ContentItem::InputText { .. } | ContentItem::InputImage { .. } => None,
        })
        .collect::<Vec<_>>()
        .join("");
    (!text.is_empty()).then_some(text)
}

pub(crate) async fn patch_json(current: String, patch: &str) -> Result<String, String> {
    let parsed = codex_apply_patch::parse_patch(patch)
        .map_err(|err| format!("failed to parse repair patch: {err}"))?;
    for hunk in &parsed.hunks {
        match hunk {
            Hunk::AddFile { path, .. } | Hunk::DeleteFile { path } => {
                ensure_response_patch_path(path)?;
            }
            Hunk::UpdateFile {
                path, move_path, ..
            } => {
                ensure_response_patch_path(path)?;
                if let Some(move_path) = move_path {
                    ensure_response_patch_path(move_path)?;
                }
            }
        }
    }

    let fs = VirtualJsonFileSystem::new(current);
    let cwd = AbsolutePathBuf::from_absolute_path("/virtual")
        .map_err(|err| format!("failed to create virtual cwd: {err}"))?;
    let mut stdout = Vec::new();
    let mut stderr = Vec::new();
    match codex_apply_patch::apply_patch(
        patch,
        &cwd,
        &mut stdout,
        &mut stderr,
        &fs,
        /*sandbox*/ None,
    )
    .await
    {
        Ok(_) => fs.response_json(),
        Err(err) => {
            let stderr = String::from_utf8_lossy(&stderr);
            if stderr.trim().is_empty() {
                Err(format!("failed to apply repair patch: {err}"))
            } else {
                Err(format!("failed to apply repair patch: {}", stderr.trim()))
            }
        }
    }
}

fn ensure_response_patch_path(path: &Path) -> Result<(), String> {
    if path == Path::new(RESPONSE_JSON_FILE) {
        return Ok(());
    }
    Err(format!(
        "repair patch may only modify {RESPONSE_JSON_FILE}, got {}",
        path.display()
    ))
}

struct VirtualJsonFileSystem {
    response_json: Arc<Mutex<String>>,
}

impl VirtualJsonFileSystem {
    fn new(response_json: String) -> Self {
        Self {
            response_json: Arc::new(Mutex::new(response_json)),
        }
    }

    fn response_json(&self) -> Result<String, String> {
        self.response_json
            .lock()
            .map(|content| content.clone())
            .map_err(|err| format!("virtual response lock poisoned: {err}"))
    }

    fn is_response_path(path: &AbsolutePathBuf) -> bool {
        path.file_name()
            .is_some_and(|file_name| file_name == RESPONSE_JSON_FILE)
    }
}

#[async_trait]
impl ExecutorFileSystem for VirtualJsonFileSystem {
    async fn read_file(
        &self,
        path: &AbsolutePathBuf,
        _sandbox: Option<&FileSystemSandboxContext>,
    ) -> FileSystemResult<Vec<u8>> {
        if !Self::is_response_path(path) {
            return Err(io::Error::new(
                io::ErrorKind::NotFound,
                "virtual file not found",
            ));
        }
        Ok(self
            .response_json
            .lock()
            .map_err(|err| io::Error::other(err.to_string()))?
            .as_bytes()
            .to_vec())
    }

    async fn write_file(
        &self,
        path: &AbsolutePathBuf,
        contents: Vec<u8>,
        _sandbox: Option<&FileSystemSandboxContext>,
    ) -> FileSystemResult<()> {
        if !Self::is_response_path(path) {
            return Err(io::Error::new(
                io::ErrorKind::NotFound,
                "virtual file not found",
            ));
        }
        let content = String::from_utf8(contents)
            .map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err))?;
        *self
            .response_json
            .lock()
            .map_err(|err| io::Error::other(err.to_string()))? = content;
        Ok(())
    }

    async fn create_directory(
        &self,
        _path: &AbsolutePathBuf,
        _options: CreateDirectoryOptions,
        _sandbox: Option<&FileSystemSandboxContext>,
    ) -> FileSystemResult<()> {
        Ok(())
    }

    async fn get_metadata(
        &self,
        path: &AbsolutePathBuf,
        _sandbox: Option<&FileSystemSandboxContext>,
    ) -> FileSystemResult<FileMetadata> {
        if !Self::is_response_path(path) {
            return Err(io::Error::new(
                io::ErrorKind::NotFound,
                "virtual file not found",
            ));
        }
        Ok(FileMetadata {
            is_directory: false,
            is_file: true,
            is_symlink: false,
            created_at_ms: 0,
            modified_at_ms: 0,
        })
    }

    async fn read_directory(
        &self,
        _path: &AbsolutePathBuf,
        _sandbox: Option<&FileSystemSandboxContext>,
    ) -> FileSystemResult<Vec<ReadDirectoryEntry>> {
        Ok(vec![ReadDirectoryEntry {
            file_name: RESPONSE_JSON_FILE.to_string(),
            is_directory: false,
            is_file: true,
        }])
    }

    async fn remove(
        &self,
        path: &AbsolutePathBuf,
        _options: RemoveOptions,
        _sandbox: Option<&FileSystemSandboxContext>,
    ) -> FileSystemResult<()> {
        if !Self::is_response_path(path) {
            return Err(io::Error::new(
                io::ErrorKind::NotFound,
                "virtual file not found",
            ));
        }
        *self
            .response_json
            .lock()
            .map_err(|err| io::Error::other(err.to_string()))? = String::new();
        Ok(())
    }

    async fn copy(
        &self,
        _source_path: &AbsolutePathBuf,
        _destination_path: &AbsolutePathBuf,
        _options: CopyOptions,
        _sandbox: Option<&FileSystemSandboxContext>,
    ) -> FileSystemResult<()> {
        Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "virtual JSON repair does not support copy",
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn validates_required_properties() {
        let schema = serde_json::json!({
            "type": "object",
            "additionalProperties": false,
            "properties": {
                "answer": { "type": "string" }
            },
            "required": ["answer"]
        });
        assert!(matches!(
            validate_json("{\"answer\":\"ok\"}".to_string(), &schema),
            JsonValidationOutcome::Valid(_)
        ));
        let JsonValidationOutcome::Invalid(err) =
            validate_json("{\"extra\":1}".to_string(), &schema)
        else {
            panic!("expected invalid output");
        };
        assert!(err.error.contains("failed JSON Schema validation"));
    }

    #[test]
    fn validates_schema_keywords_with_jsonschema_crate() {
        let schema = serde_json::json!({
            "type": "object",
            "properties": {
                "answer": {
                    "type": "string",
                    "pattern": "^ok$"
                }
            },
            "required": ["answer"]
        });
        let JsonValidationOutcome::Invalid(err) =
            validate_json("{\"answer\":\"bad\"}".to_string(), &schema)
        else {
            panic!("expected pattern validation to fail");
        };
        assert!(err.error.contains("failed JSON Schema validation"));
    }

    #[tokio::test]
    async fn patches_virtual_response_json() {
        let patch = r#"*** Begin Patch
*** Update File: response.json
@@
-{"answer":1}
+{"answer":"ok"}
*** End Patch"#;
        let result = patch_json("{\"answer\":1}\n".to_string(), patch)
            .await
            .unwrap();
        assert_eq!(result, "{\"answer\":\"ok\"}\n");
    }

    #[tokio::test]
    async fn rejects_patch_for_other_file() {
        let patch = r#"*** Begin Patch
*** Update File: other.json
@@
-{}
+{"answer":"ok"}
*** End Patch"#;
        let err = patch_json("{}\n".to_string(), patch).await.unwrap_err();
        assert!(err.contains("may only modify response.json"));
    }
}
