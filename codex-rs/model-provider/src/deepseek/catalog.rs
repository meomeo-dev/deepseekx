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

use super::model_messages::deepseek_v4_flash_base_instructions;
use super::model_messages::deepseek_v4_flash_model_messages;
use super::model_messages::deepseek_v4_pro_base_instructions;
use super::model_messages::deepseek_v4_pro_model_messages;

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
                DeepSeekInstructionFamily::Pro,
                /*priority*/ 0,
            ),
            deepseek_model(
                DEEPSEEK_V4_FLASH,
                "DeepSeek V4 Flash",
                "DeepSeek fast model for lower-latency coding tasks.",
                Some(ReasoningEffort::High),
                DeepSeekInstructionFamily::Flash,
                /*priority*/ 1,
            ),
        ],
    }
}

#[derive(Clone, Copy)]
enum DeepSeekInstructionFamily {
    Pro,
    Flash,
}

fn deepseek_model(
    slug: &str,
    display_name: &str,
    description: &str,
    default_reasoning_level: Option<ReasoningEffort>,
    instruction_family: DeepSeekInstructionFamily,
    priority: i32,
) -> ModelInfo {
    let (base_instructions, model_messages) = match instruction_family {
        DeepSeekInstructionFamily::Pro => (
            deepseek_v4_pro_base_instructions(),
            deepseek_v4_pro_model_messages(),
        ),
        DeepSeekInstructionFamily::Flash => (
            deepseek_v4_flash_base_instructions(),
            deepseek_v4_flash_model_messages(),
        ),
    };

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
        base_instructions,
        model_messages: Some(model_messages),
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
    use codex_protocol::config_types::Personality;
    use codex_protocol::openai_models::ModelPreset;

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

    #[test]
    fn catalog_advertises_personality_support() {
        let catalog = static_model_catalog();

        assert!(catalog.models.iter().all(ModelInfo::supports_personality));
    }

    #[test]
    fn catalog_preserves_personality_support_in_presets() {
        let catalog = static_model_catalog();
        let presets = catalog
            .models
            .into_iter()
            .map(ModelPreset::from)
            .collect::<Vec<_>>();

        assert!(presets.iter().all(|preset| preset.supports_personality));
    }

    #[test]
    fn catalog_uses_local_deepseek_base_instructions() {
        let catalog = static_model_catalog();

        for model in catalog.models {
            assert!(model.base_instructions.starts_with(
                "You are Codex, a coding agent based on GPT-5. \
                 You and the user share the same workspace"
            ));
            assert!(
                model
                    .base_instructions
                    .contains("deeply pragmatic, effective software engineer")
            );
        }
    }

    #[test]
    fn catalog_maps_pro_and_flash_to_distinct_instruction_families() {
        let catalog = static_model_catalog();
        let pro = catalog
            .models
            .iter()
            .find(|model| model.slug == DEEPSEEK_V4_PRO)
            .expect("DeepSeek catalog should include V4 Pro");
        let flash = catalog
            .models
            .iter()
            .find(|model| model.slug == DEEPSEEK_V4_FLASH)
            .expect("DeepSeek catalog should include V4 Flash");

        assert_ne!(pro.base_instructions, flash.base_instructions);
        assert!(flash.base_instructions.len() < pro.base_instructions.len());

        let pro_template = pro
            .model_messages
            .as_ref()
            .and_then(|messages| messages.instructions_template.as_ref())
            .expect("DeepSeek V4 Pro should include instructions template");
        let flash_template = flash
            .model_messages
            .as_ref()
            .and_then(|messages| messages.instructions_template.as_ref())
            .expect("DeepSeek V4 Flash should include instructions template");

        assert_ne!(pro_template, flash_template);
        assert!(flash_template.len() < pro_template.len());
        assert!(pro_template.contains("{{ personality }}"));
        assert!(flash_template.contains("{{ personality }}"));
    }

    #[test]
    fn catalog_injects_personality_into_deepseek_instructions() {
        let catalog = static_model_catalog();

        for model in catalog.models {
            let instructions = model.get_model_instructions(Some(Personality::Pragmatic));

            assert!(instructions.contains("# Personality"));
            assert!(instructions.contains("deeply pragmatic, effective software engineer"));
            assert!(!instructions.contains("{{ personality }}"));
        }
    }
}
