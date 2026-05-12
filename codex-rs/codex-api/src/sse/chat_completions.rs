use crate::common::ResponseEvent;
use crate::common::ResponseStream;
use crate::endpoint::ChatCompletionChunk;
use crate::endpoint::ChatToolCallDelta;
use crate::error::ApiError;
use codex_client::ByteStream;
use codex_client::StreamResponse;
use codex_protocol::models::ContentItem;
use codex_protocol::models::MessagePhase;
use codex_protocol::models::ReasoningItemContent;
use codex_protocol::models::ResponseItem;
use codex_protocol::protocol::TokenUsage;
use eventsource_stream::Eventsource;
use futures::StreamExt;
use serde_json::Value;
use std::collections::BTreeMap;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::Instant;
use tokio::time::timeout;
use tracing::debug;
use tracing::trace;

const APPLY_PATCH_CHAT_COMPLETIONS_INPUT_FIELD: &str = "input";
const APPLY_PATCH_TOOL_NAME: &str = "apply_patch";

pub fn spawn_chat_completions_stream(
    stream_response: StreamResponse,
    idle_timeout: Duration,
) -> ResponseStream {
    let upstream_request_id = stream_response
        .headers
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let (tx_event, rx_event) = mpsc::channel::<Result<ResponseEvent, ApiError>>(1600);
    tokio::spawn(process_chat_completions_sse(
        stream_response.bytes,
        tx_event,
        idle_timeout,
    ));

    ResponseStream {
        rx_event,
        upstream_request_id,
    }
}

#[derive(Debug, Default)]
struct ChatCompletionsStreamState {
    response_id: Option<String>,
    content: String,
    reasoning_content: String,
    tool_calls: BTreeMap<u32, ToolCallState>,
    usage: Option<TokenUsage>,
    message_started: bool,
    message_done: bool,
    reasoning_started: bool,
    reasoning_done: bool,
    completed: bool,
}

#[derive(Debug, Default)]
struct ToolCallState {
    id: Option<String>,
    name: Option<String>,
    arguments: String,
    added: bool,
    streamed_input_len: usize,
}

impl ChatCompletionsStreamState {
    fn process_chunk(
        &mut self,
        chunk: ChatCompletionChunk,
    ) -> Result<Vec<ResponseEvent>, ApiError> {
        let mut events = Vec::new();
        self.response_id.get_or_insert_with(|| chunk.id.clone());
        if let Some(usage) = chunk.usage {
            self.usage = Some(usage.into());
        }

        for choice in chunk.choices {
            if choice.index != 0 {
                trace!("ignoring non-primary chat completions choice");
                continue;
            }

            if let Some(reasoning) = choice.delta.reasoning_content
                && !reasoning.is_empty()
            {
                self.ensure_reasoning_started(&mut events);
                self.reasoning_content.push_str(&reasoning);
                events.push(ResponseEvent::ReasoningContentDelta {
                    delta: reasoning,
                    content_index: 0,
                });
            }
            if let Some(content) = choice.delta.content
                && !content.is_empty()
            {
                self.finish_reasoning(&mut events);
                self.ensure_message_started(&mut events);
                self.content.push_str(&content);
                events.push(ResponseEvent::OutputTextDelta(content));
            }
            if let Some(tool_calls) = choice.delta.tool_calls {
                self.finish_reasoning(&mut events);
                for tool_call in tool_calls {
                    self.process_tool_call_delta(tool_call, &mut events)?;
                }
            }
        }

        Ok(events)
    }

    fn process_done(&mut self) -> Vec<ResponseEvent> {
        let mut events = Vec::new();
        self.finish_message(&mut events);
        self.finish_reasoning(&mut events);
        for tool_call in self.tool_calls.values() {
            let call_id = tool_call.id.clone().unwrap_or_default();
            let name = tool_call.name.clone().unwrap_or_default();
            if name == APPLY_PATCH_TOOL_NAME {
                events.push(ResponseEvent::OutputItemDone(
                    ResponseItem::CustomToolCall {
                        id: None,
                        status: None,
                        call_id,
                        name,
                        input: apply_patch_input(&tool_call.arguments)
                            .unwrap_or_else(|| tool_call.arguments.clone()),
                    },
                ));
            } else {
                events.push(ResponseEvent::OutputItemDone(ResponseItem::FunctionCall {
                    id: None,
                    name,
                    namespace: None,
                    arguments: tool_call.arguments.clone(),
                    call_id,
                }));
            }
        }
        events.push(ResponseEvent::Completed {
            response_id: self
                .response_id
                .clone()
                .unwrap_or_else(|| "chatcmpl-deepseek".to_string()),
            token_usage: self.usage.clone(),
            end_turn: Some(true),
        });
        self.completed = true;
        events
    }

    fn process_tool_call_delta(
        &mut self,
        tool_call: ChatToolCallDelta,
        events: &mut Vec<ResponseEvent>,
    ) -> Result<(), ApiError> {
        let Some(index) = tool_call.index else {
            return Err(ApiError::Stream(
                "chat completion tool call delta missing index".to_string(),
            ));
        };

        let state = self.tool_calls.entry(index).or_default();
        if let Some(id) = tool_call.id {
            state.id = Some(id);
        }
        if let Some(function) = tool_call.function {
            if let Some(name) = function.name {
                state.name = Some(name);
            }
            if state.name.as_deref() == Some(APPLY_PATCH_TOOL_NAME) && !state.added {
                let call_id = state.id.clone().unwrap_or_else(|| index.to_string());
                events.push(ResponseEvent::OutputItemAdded(
                    ResponseItem::CustomToolCall {
                        id: None,
                        status: None,
                        call_id,
                        name: APPLY_PATCH_TOOL_NAME.to_string(),
                        input: String::new(),
                    },
                ));
                state.added = true;
            }
            if let Some(arguments) = function.arguments {
                state.arguments.push_str(&arguments);
                let delta = if state.name.as_deref() == Some(APPLY_PATCH_TOOL_NAME) {
                    apply_patch_delta(&state.arguments, &mut state.streamed_input_len)
                } else {
                    arguments
                };
                if !delta.is_empty() {
                    events.push(ResponseEvent::ToolCallInputDelta {
                        item_id: state.id.clone().unwrap_or_else(|| index.to_string()),
                        call_id: state.id.clone(),
                        delta,
                    });
                }
            }
        }

        Ok(())
    }

    fn ensure_message_started(&mut self, events: &mut Vec<ResponseEvent>) {
        if self.message_started {
            return;
        }
        events.push(ResponseEvent::OutputItemAdded(ResponseItem::Message {
            id: None,
            role: "assistant".to_string(),
            content: Vec::new(),
            phase: Some(MessagePhase::FinalAnswer),
        }));
        self.message_started = true;
    }

    fn ensure_reasoning_started(&mut self, events: &mut Vec<ResponseEvent>) {
        if self.reasoning_started {
            return;
        }
        events.push(ResponseEvent::OutputItemAdded(ResponseItem::Reasoning {
            id: "deepseek_reasoning".to_string(),
            summary: Vec::new(),
            content: None,
            encrypted_content: None,
        }));
        self.reasoning_started = true;
    }

    fn finish_message(&mut self, events: &mut Vec<ResponseEvent>) {
        if self.message_done || self.content.is_empty() {
            return;
        }
        events.push(ResponseEvent::OutputItemDone(ResponseItem::Message {
            id: None,
            role: "assistant".to_string(),
            content: vec![ContentItem::OutputText {
                text: self.content.clone(),
            }],
            phase: Some(MessagePhase::FinalAnswer),
        }));
        self.message_done = true;
    }

    fn finish_reasoning(&mut self, events: &mut Vec<ResponseEvent>) {
        if self.reasoning_done || self.reasoning_content.is_empty() {
            return;
        }
        events.push(ResponseEvent::OutputItemDone(ResponseItem::Reasoning {
            id: "deepseek_reasoning".to_string(),
            summary: Vec::new(),
            content: Some(vec![ReasoningItemContent::ReasoningText {
                text: self.reasoning_content.clone(),
            }]),
            encrypted_content: None,
        }));
        self.reasoning_done = true;
    }
}

fn apply_patch_delta(arguments: &str, streamed_input_len: &mut usize) -> String {
    let Some(input) = apply_patch_input(arguments) else {
        return String::new();
    };
    if input.len() <= *streamed_input_len {
        return String::new();
    }
    let delta = input[*streamed_input_len..].to_string();
    *streamed_input_len = input.len();
    delta
}

fn apply_patch_input(arguments: &str) -> Option<String> {
    let Ok(value) = serde_json::from_str::<Value>(arguments) else {
        return None;
    };

    value
        .get(APPLY_PATCH_CHAT_COMPLETIONS_INPUT_FIELD)
        .and_then(Value::as_str)
        .map(str::to_string)
}

impl From<crate::endpoint::ChatUsage> for TokenUsage {
    fn from(value: crate::endpoint::ChatUsage) -> Self {
        let input_tokens = to_i64(value.prompt_tokens);
        let cached_input_tokens = to_i64(value.prompt_cache_hit_tokens);
        let output_tokens = to_i64(value.completion_tokens);
        let reasoning_output_tokens = value
            .completion_tokens_details
            .and_then(|details| details.reasoning_tokens)
            .map(|tokens| tokens as i64)
            .unwrap_or(0);
        let total_tokens = to_i64(value.total_tokens);

        TokenUsage {
            input_tokens,
            cached_input_tokens,
            output_tokens,
            reasoning_output_tokens,
            total_tokens,
        }
    }
}

fn to_i64(value: Option<u64>) -> i64 {
    value.map(|tokens| tokens as i64).unwrap_or(0)
}

async fn process_chat_completions_sse(
    stream: ByteStream,
    tx_event: mpsc::Sender<Result<ResponseEvent, ApiError>>,
    idle_timeout: Duration,
) {
    let mut stream = stream.eventsource();
    let mut state = ChatCompletionsStreamState::default();

    loop {
        let start = Instant::now();
        let response = timeout(idle_timeout, stream.next()).await;
        trace!("chat completions SSE poll took {:?}", start.elapsed());

        let sse = match response {
            Ok(Some(Ok(sse))) => sse,
            Ok(Some(Err(error))) => {
                debug!("chat completions SSE error: {error:#}");
                let _ = tx_event
                    .send(Err(ApiError::Stream(error.to_string())))
                    .await;
                return;
            }
            Ok(None) => {
                let message = "stream closed before chat completions [DONE]";
                let error = ApiError::Stream(message.to_string());
                let _ = tx_event.send(Err(error)).await;
                return;
            }
            Err(_) => {
                let _ = tx_event
                    .send(Err(ApiError::Stream("idle timeout waiting for SSE".into())))
                    .await;
                return;
            }
        };

        trace!("chat completions SSE event: {}", &sse.data);
        let events = if sse.data.trim() == "[DONE]" {
            state.process_done()
        } else {
            match process_chat_completions_data(&mut state, &sse.data) {
                Ok(events) => events,
                Err(error) => {
                    let _ = tx_event.send(Err(error)).await;
                    return;
                }
            }
        };

        for event in events {
            let is_completed = matches!(event, ResponseEvent::Completed { .. });
            if tx_event.send(Ok(event)).await.is_err() {
                return;
            }
            if is_completed {
                return;
            }
        }
    }
}

fn process_chat_completions_data(
    state: &mut ChatCompletionsStreamState,
    data: &str,
) -> Result<Vec<ResponseEvent>, ApiError> {
    if let Some(error) = chat_error(data)? {
        return Err(error);
    }

    let chunk: ChatCompletionChunk = serde_json::from_str(data).map_err(|err| {
        let message = format!("failed to parse chat completion chunk: {err}");
        ApiError::Stream(message)
    })?;
    state.process_chunk(chunk)
}

fn chat_error(data: &str) -> Result<Option<ApiError>, ApiError> {
    let value: Value = serde_json::from_str(data).map_err(|err| {
        let message = format!("failed to parse chat completion JSON: {err}");
        ApiError::Stream(message)
    })?;
    let Some(error) = value.get("error") else {
        return Ok(None);
    };
    let message = error
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or("chat completions stream error");
    Ok(Some(ApiError::Stream(message.to_string())))
}

#[cfg(test)]
mod tests {
    use super::*;
    use assert_matches::assert_matches;
    use bytes::Bytes;
    use codex_client::TransportError;
    use futures::TryStreamExt;
    use futures::stream;
    use http::HeaderMap;
    use http::StatusCode;
    use pretty_assertions::assert_eq;
    use serde_json::json;
    use tokio_util::io::ReaderStream;

    fn idle_timeout() -> Duration {
        Duration::from_millis(1000)
    }

    async fn collect(body: String) -> Vec<Result<ResponseEvent, ApiError>> {
        let stream = ReaderStream::new(std::io::Cursor::new(body))
            .map_err(|err| TransportError::Network(err.to_string()));
        let (tx, mut rx) = mpsc::channel::<Result<ResponseEvent, ApiError>>(16);
        tokio::spawn(process_chat_completions_sse(
            Box::pin(stream),
            tx,
            idle_timeout(),
        ));

        let mut events = Vec::new();
        while let Some(event) = rx.recv().await {
            events.push(event);
        }
        events
    }

    fn sse_data(data: &str) -> String {
        format!("data: {data}\n\n")
    }

    fn chunk(delta: Value, usage: Option<Value>) -> Value {
        json!({
            "id": "chatcmpl-1",
            "choices": [{
                "delta": delta,
                "finish_reason": null,
                "index": 0,
                "logprobs": null
            }],
            "created": 1718345013,
            "model": "deepseek-v4-pro",
            "object": "chat.completion.chunk",
            "system_fingerprint": "fp_a49d71b8a1",
            "usage": usage
        })
    }

    fn assistant_delta(content: &str) -> Value {
        json!({
            "role": "assistant",
            "content": content,
        })
    }

    #[tokio::test]
    async fn maps_content_reasoning_usage_and_done() {
        let body = [
            sse_data(&chunk(assistant_delta(""), None).to_string()),
            sse_data(&chunk(json!({"reasoning_content": "think"}), None).to_string()),
            sse_data(&chunk(json!({"content": "Hello"}), None).to_string()),
            sse_data(
                &chunk(
                    json!({"content": ""}),
                    Some(json!({
                        "completion_tokens": 9,
                        "prompt_tokens": 17,
                        "prompt_cache_hit_tokens": 3,
                        "prompt_cache_miss_tokens": 14,
                        "total_tokens": 26,
                        "completion_tokens_details": {"reasoning_tokens": 4}
                    })),
                )
                .to_string(),
            ),
            sse_data("[DONE]"),
        ]
        .join("");

        let events = collect(body).await;

        assert_eq!(events.len(), 7);
        assert_matches!(
            &events[0],
            Ok(ResponseEvent::OutputItemAdded(
                ResponseItem::Reasoning { .. }
            ))
        );
        assert_matches!(
            &events[1],
            Ok(ResponseEvent::ReasoningContentDelta {
                delta,
                content_index: 0,
            }) if delta == "think"
        );
        assert_matches!(
            &events[2],
            Ok(ResponseEvent::OutputItemDone(ResponseItem::Reasoning {
                content: Some(content),
                ..
            })) if content == &vec![ReasoningItemContent::ReasoningText {
                text: "think".to_string()
            }]
        );
        assert_matches!(
            &events[3],
            Ok(ResponseEvent::OutputItemAdded(ResponseItem::Message {
                role,
                phase: Some(MessagePhase::FinalAnswer),
                ..
            })) if role == "assistant"
        );
        assert_matches!(
            &events[4],
            Ok(ResponseEvent::OutputTextDelta(text)) if text == "Hello"
        );
        assert_matches!(
            &events[5],
            Ok(ResponseEvent::OutputItemDone(ResponseItem::Message {
                role,
                content,
                phase: Some(MessagePhase::FinalAnswer),
                ..
            })) if role == "assistant"
                && content == &vec![ContentItem::OutputText {
                    text: "Hello".to_string()
                }]
        );
        assert_matches!(
            &events[6],
            Ok(ResponseEvent::Completed {
                response_id,
                token_usage: Some(usage),
                end_turn: Some(true),
            }) if response_id == "chatcmpl-1"
                && usage.input_tokens == 17
                && usage.cached_input_tokens == 3
                && usage.output_tokens == 9
                && usage.reasoning_output_tokens == 4
                && usage.total_tokens == 26
        );
    }

    #[tokio::test]
    async fn maps_fragmented_tool_call_arguments() {
        let body = [
            sse_data(
                &chunk(
                    json!({
                        "tool_calls": [{
                            "index": 0,
                            "id": "call-1",
                            "type": "function",
                            "function": {
                                "name": "get_weather",
                                "arguments": "{\"location\""
                            }
                        }]
                    }),
                    None,
                )
                .to_string(),
            ),
            sse_data(
                &chunk(
                    json!({
                        "tool_calls": [{
                            "index": 0,
                            "function": {"arguments": ":\"Hangzhou\"}"}
                        }]
                    }),
                    None,
                )
                .to_string(),
            ),
            sse_data("[DONE]"),
        ]
        .join("");

        let events = collect(body).await;

        assert_eq!(events.len(), 4);
        assert_matches!(
            &events[0],
            Ok(ResponseEvent::ToolCallInputDelta {
                item_id,
                call_id: Some(call_id),
                delta,
            }) if item_id == "call-1"
                && call_id == "call-1"
                && delta == "{\"location\""
        );
        assert_matches!(
            &events[1],
            Ok(ResponseEvent::ToolCallInputDelta {
                item_id,
                call_id: Some(call_id),
                delta,
            }) if item_id == "call-1"
                && call_id == "call-1"
                && delta == ":\"Hangzhou\"}"
        );
        assert_matches!(
            &events[2],
            Ok(ResponseEvent::OutputItemDone(ResponseItem::FunctionCall {
                name,
                arguments,
                call_id,
                ..
            })) if name == "get_weather"
                && arguments == "{\"location\":\"Hangzhou\"}"
                && call_id == "call-1"
        );
        assert_matches!(&events[3], Ok(ResponseEvent::Completed { .. }));
    }

    #[tokio::test]
    async fn maps_apply_patch_function_call_to_custom_tool_call() {
        let patch = "*** Begin Patch\n*** Add File: demo.txt\n+ok\n*** End Patch\n";
        let body = [
            sse_data(
                &chunk(
                    json!({
                        "tool_calls": [{
                            "index": 0,
                            "id": "patch-call",
                            "type": "function",
                            "function": {
                                "name": "apply_patch",
                                "arguments": serde_json::json!({
                                    "input": patch
                                }).to_string()
                            }
                        }]
                    }),
                    None,
                )
                .to_string(),
            ),
            sse_data("[DONE]"),
        ]
        .join("");

        let events = collect(body).await;

        assert_eq!(events.len(), 4);
        assert_matches!(
            &events[0],
            Ok(ResponseEvent::OutputItemAdded(ResponseItem::CustomToolCall {
                call_id,
                name,
                input,
                ..
            })) if call_id == "patch-call"
                && name == "apply_patch"
                && input.is_empty()
        );
        assert_matches!(
            &events[1],
            Ok(ResponseEvent::ToolCallInputDelta {
                item_id,
                call_id: Some(call_id),
                delta,
            }) if item_id == "patch-call"
                && call_id == "patch-call"
                && delta == patch
        );
        assert_matches!(
            &events[2],
            Ok(ResponseEvent::OutputItemDone(ResponseItem::CustomToolCall {
                call_id,
                name,
                input,
                ..
            })) if call_id == "patch-call"
                && name == "apply_patch"
                && input == patch
        );
        assert_matches!(&events[3], Ok(ResponseEvent::Completed { .. }));
    }

    #[tokio::test]
    async fn errors_when_stream_closes_without_done() {
        let body = sse_data(&chunk(json!({"content": "Hello"}), None).to_string());

        let events = collect(body).await;

        assert_eq!(events.len(), 3);
        assert_matches!(
            &events[0],
            Ok(ResponseEvent::OutputItemAdded(ResponseItem::Message { .. }))
        );
        assert_matches!(
            &events[1],
            Ok(ResponseEvent::OutputTextDelta(text)) if text == "Hello"
        );
        match &events[2] {
            Err(ApiError::Stream(message)) => {
                assert_eq!(message, "stream closed before chat completions [DONE]");
            }
            other => panic!("unexpected event: {other:?}"),
        }
    }

    #[tokio::test]
    async fn errors_on_stream_error_payload() {
        let error = json!({
            "error": {
                "message": "invalid api key",
                "type": "authentication_error"
            }
        });

        let events = collect(sse_data(&error.to_string())).await;

        assert_eq!(events.len(), 1);
        match &events[0] {
            Err(ApiError::Stream(message)) => assert_eq!(message, "invalid api key"),
            other => panic!("unexpected event: {other:?}"),
        }
    }

    #[tokio::test]
    async fn spawn_sets_upstream_request_id() {
        let bytes = stream::iter(vec![Ok(Bytes::from(sse_data("[DONE]")))]);
        let mut headers = HeaderMap::new();
        headers.insert("x-request-id", "req-1".parse().unwrap());
        let stream_response = StreamResponse {
            status: StatusCode::OK,
            headers,
            bytes: Box::pin(bytes),
        };

        let stream = spawn_chat_completions_stream(stream_response, idle_timeout());

        assert_eq!(stream.upstream_request_id.as_deref(), Some("req-1"));
    }
}
