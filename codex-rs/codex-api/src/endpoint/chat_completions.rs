use crate::auth::SharedAuthProvider;
use crate::endpoint::session::EndpointSession;
use crate::error::ApiError;
use crate::provider::Provider;
use crate::requests::Compression;
use codex_client::HttpTransport;
use codex_client::RequestCompression;
use codex_client::RequestTelemetry;
use codex_client::StreamResponse;
use http::HeaderMap;
use http::HeaderValue;
use http::Method;
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use std::sync::Arc;
use tracing::instrument;

pub struct ChatCompletionsClient<T: HttpTransport> {
    session: EndpointSession<T>,
}

#[derive(Default)]
pub struct ChatCompletionsOptions {
    pub extra_headers: HeaderMap,
    pub compression: Compression,
}

impl<T: HttpTransport> ChatCompletionsClient<T> {
    pub fn new(transport: T, provider: Provider, auth: SharedAuthProvider) -> Self {
        Self {
            session: EndpointSession::new(transport, provider, auth),
        }
    }

    pub fn with_telemetry(self, request: Option<Arc<dyn RequestTelemetry>>) -> Self {
        Self {
            session: self.session.with_request_telemetry(request),
        }
    }

    #[instrument(
        name = "chat_completions.stream_request",
        level = "info",
        skip_all,
        fields(
            transport = "chat_completions_http",
            http.method = "POST",
            api.path = "chat/completions"
        )
    )]
    pub async fn stream_request(
        &self,
        request: ChatCompletionsRequest,
        options: ChatCompletionsOptions,
    ) -> Result<StreamResponse, ApiError> {
        let body = serde_json::to_value(&request).map_err(|err| {
            let message = format!("failed to encode chat completions request: {err}");
            ApiError::Stream(message)
        })?;
        let ChatCompletionsOptions {
            extra_headers,
            compression,
        } = options;
        let request_compression = match compression {
            Compression::None => RequestCompression::None,
            Compression::Zstd => RequestCompression::Zstd,
        };

        self.session
            .stream_with(
                Method::POST,
                Self::path(),
                extra_headers,
                Some(body),
                |req| {
                    req.headers.insert(
                        http::header::ACCEPT,
                        HeaderValue::from_static("text/event-stream"),
                    );
                    req.compression = request_compression;
                },
            )
            .await
    }

    fn path() -> &'static str {
        "chat/completions"
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ChatCompletionsRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tools: Vec<ChatTool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_choice: Option<ChatToolChoice>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thinking: Option<ChatThinking>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_effort: Option<ChatReasoningEffort>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_format: Option<ChatResponseFormat>,
    pub stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream_options: Option<ChatStreamOptions>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "role", rename_all = "lowercase")]
pub enum ChatMessage {
    System {
        content: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        name: Option<String>,
    },
    User {
        content: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        name: Option<String>,
    },
    Assistant {
        content: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        name: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        prefix: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        reasoning_content: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tool_calls: Option<Vec<ChatToolCall>>,
    },
    Tool {
        content: String,
        tool_call_id: String,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ChatTool {
    pub r#type: ChatToolType,
    pub function: ChatFunctionTool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatToolType {
    Function,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ChatFunctionTool {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameters: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strict: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(untagged)]
pub enum ChatToolChoice {
    Mode(ChatToolChoiceMode),
    Function(ChatNamedToolChoice),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatToolChoiceMode {
    None,
    Auto,
    Required,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ChatNamedToolChoice {
    pub r#type: ChatToolType,
    pub function: ChatNamedToolChoiceFunction,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ChatNamedToolChoiceFunction {
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ChatThinking {
    pub r#type: ChatThinkingType,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatThinkingType {
    Enabled,
    Disabled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatReasoningEffort {
    High,
    Max,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ChatResponseFormat {
    pub r#type: ChatResponseFormatType,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ChatResponseFormatType {
    Text,
    JsonObject,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ChatStreamOptions {
    pub include_usage: bool,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct ChatCompletionResponse {
    pub id: String,
    pub choices: Vec<ChatCompletionChoice>,
    pub created: i64,
    pub model: String,
    pub object: String,
    pub usage: Option<ChatUsage>,
    pub system_fingerprint: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct ChatCompletionChoice {
    pub finish_reason: Option<String>,
    pub index: u32,
    pub message: ChatAssistantMessage,
    pub logprobs: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct ChatAssistantMessage {
    pub content: Option<String>,
    pub role: String,
    pub reasoning_content: Option<String>,
    pub tool_calls: Option<Vec<ChatToolCall>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChatToolCall {
    pub id: String,
    pub r#type: ChatToolType,
    pub function: ChatFunctionCall,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChatFunctionCall {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct ChatCompletionChunk {
    pub id: String,
    pub choices: Vec<ChatCompletionChunkChoice>,
    pub created: i64,
    pub model: String,
    pub object: String,
    pub usage: Option<ChatUsage>,
    pub system_fingerprint: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct ChatCompletionChunkChoice {
    pub delta: ChatCompletionDelta,
    pub finish_reason: Option<String>,
    pub index: u32,
    pub logprobs: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct ChatCompletionDelta {
    pub content: Option<String>,
    pub role: Option<String>,
    pub reasoning_content: Option<String>,
    pub tool_calls: Option<Vec<ChatToolCallDelta>>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct ChatToolCallDelta {
    pub index: Option<u32>,
    pub id: Option<String>,
    pub r#type: Option<ChatToolType>,
    pub function: Option<ChatFunctionCallDelta>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct ChatFunctionCallDelta {
    pub name: Option<String>,
    pub arguments: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct ChatUsage {
    pub completion_tokens: Option<u64>,
    pub prompt_tokens: Option<u64>,
    pub prompt_cache_hit_tokens: Option<u64>,
    pub prompt_cache_miss_tokens: Option<u64>,
    pub total_tokens: Option<u64>,
    pub completion_tokens_details: Option<ChatCompletionTokensDetails>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct ChatCompletionTokensDetails {
    pub reasoning_tokens: Option<u64>,
}
