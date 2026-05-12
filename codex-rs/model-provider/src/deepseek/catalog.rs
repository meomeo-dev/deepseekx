use codex_models_manager::model_info::BASE_INSTRUCTIONS;
use codex_protocol::config_types::ReasoningSummary;
use codex_protocol::openai_models::ConfigShellToolType;
use codex_protocol::openai_models::InputModality;
use codex_protocol::openai_models::ModelInfo;
use codex_protocol::openai_models::ModelVisibility;
use codex_protocol::openai_models::ModelsResponse;
use codex_protocol::openai_models::ReasoningEffort;
use codex_protocol::openai_models::ReasoningEffortPreset;
use codex_protocol::openai_models::TruncationPolicyConfig;
use codex_protocol::openai_models::WebSearchToolType;

const DEEPSEEK_V4_PRO: &str = "deepseek-v4-pro";
const DEEPSEEK_V4_FLASH: &str = "deepseek-v4-flash";
const DEFAULT_CONTEXT_WINDOW: i64 = 384_000;
const MAX_CONTEXT_WINDOW: i64 = 1_000_000;

pub(crate) fn static_model_catalog() -> ModelsResponse {
    ModelsResponse {
        models: vec![
            deepseek_model(
                DEEPSEEK_V4_PRO,
                "DeepSeek V4 Pro",
                "DeepSeek reasoning model for complex coding tasks.",
                Some(ReasoningEffort::High),
                /*priority*/ 0,
            ),
            deepseek_model(
                DEEPSEEK_V4_FLASH,
                "DeepSeek V4 Flash",
                "DeepSeek fast model for lower-latency coding tasks.",
                Some(ReasoningEffort::High),
                /*priority*/ 1,
            ),
        ],
    }
}

fn deepseek_model(
    slug: &str,
    display_name: &str,
    description: &str,
    default_reasoning_level: Option<ReasoningEffort>,
    priority: i32,
) -> ModelInfo {
    ModelInfo {
        slug: slug.to_string(),
        display_name: display_name.to_string(),
        description: Some(description.to_string()),
        default_reasoning_level,
        supported_reasoning_levels: vec![
            reasoning_effort_preset(ReasoningEffort::None),
            reasoning_effort_preset(ReasoningEffort::High),
            reasoning_effort_preset(ReasoningEffort::XHigh),
        ],
        shell_type: ConfigShellToolType::ShellCommand,
        visibility: ModelVisibility::List,
        supported_in_api: true,
        priority,
        additional_speed_tiers: Vec::new(),
        service_tiers: Vec::new(),
        availability_nux: None,
        upgrade: None,
        base_instructions: BASE_INSTRUCTIONS.to_string(),
        model_messages: None,
        supports_reasoning_summaries: true,
        default_reasoning_summary: ReasoningSummary::None,
        support_verbosity: false,
        default_verbosity: None,
        apply_patch_tool_type: None,
        web_search_tool_type: WebSearchToolType::Text,
        truncation_policy: TruncationPolicyConfig::tokens(/*limit*/ 10_000),
        supports_parallel_tool_calls: false,
        supports_image_detail_original: false,
        context_window: Some(DEFAULT_CONTEXT_WINDOW),
        max_context_window: Some(MAX_CONTEXT_WINDOW),
        auto_compact_token_limit: None,
        effective_context_window_percent: 95,
        experimental_supported_tools: Vec::new(),
        input_modalities: vec![InputModality::Text],
        used_fallback_model_metadata: false,
        supports_search_tool: false,
    }
}

fn reasoning_effort_preset(effort: ReasoningEffort) -> ReasoningEffortPreset {
    ReasoningEffortPreset {
        effort,
        description: match effort {
            ReasoningEffort::None => "No reasoning",
            ReasoningEffort::Minimal => "Minimal reasoning",
            ReasoningEffort::Low => "Fast responses with lighter reasoning",
            ReasoningEffort::Medium => "Balances speed and reasoning depth for everyday tasks",
            ReasoningEffort::High => "Greater reasoning depth for complex problems",
            ReasoningEffort::XHigh => "Extra high reasoning depth for complex problems",
        }
        .to_string(),
    }
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::*;

    #[test]
    fn catalog_uses_deepseek_model_ids_as_slugs() {
        let catalog = static_model_catalog();
        let model_ids = catalog
            .models
            .iter()
            .map(|model| model.slug.as_str())
            .collect::<Vec<_>>();

        assert_eq!(model_ids, vec![DEEPSEEK_V4_PRO, DEEPSEEK_V4_FLASH]);
    }

    #[test]
    fn catalog_defaults_to_384k_context_with_1m_max() {
        let catalog = static_model_catalog();

        assert!(catalog.models.iter().all(|model| {
            model.context_window == Some(DEFAULT_CONTEXT_WINDOW)
                && model.max_context_window == Some(MAX_CONTEXT_WINDOW)
        }));
    }

    #[test]
    fn catalog_does_not_advertise_unsupported_search_or_image_features() {
        let catalog = static_model_catalog();

        for model in catalog.models {
            assert!(!model.supports_search_tool);
            assert!(!model.supports_image_detail_original);
            assert_eq!(model.input_modalities, vec![InputModality::Text]);
        }
    }

    #[test]
    fn catalog_advertises_non_thinking_mode() {
        let catalog = static_model_catalog();

        for model in catalog.models {
            let efforts = model
                .supported_reasoning_levels
                .iter()
                .map(|preset| preset.effort)
                .collect::<Vec<_>>();
            assert_eq!(
                efforts,
                vec![
                    ReasoningEffort::None,
                    ReasoningEffort::High,
                    ReasoningEffort::XHigh,
                ]
            );
        }
    }
}
