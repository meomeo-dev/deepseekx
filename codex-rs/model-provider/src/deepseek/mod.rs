mod catalog;
mod model_messages;

use std::path::PathBuf;
use std::sync::Arc;

use codex_login::AuthManager;
use codex_login::CodexAuth;
use codex_model_provider_info::ModelProviderInfo;
use codex_models_manager::manager::SharedModelsManager;
use codex_models_manager::manager::StaticModelsManager;
use codex_protocol::openai_models::ModelsResponse;

use crate::auth::auth_manager_for_provider;
use crate::provider::ModelProvider;
use crate::provider::ProviderAccountResult;
use crate::provider::ProviderAccountState;
use crate::provider::ProviderCapabilities;
pub(crate) use catalog::static_model_catalog;

/// Runtime provider for DeepSeek's Chat Completions-compatible API.
#[derive(Clone, Debug)]
pub(crate) struct DeepSeekModelProvider {
    info: ModelProviderInfo,
    auth_manager: Option<Arc<AuthManager>>,
}

impl DeepSeekModelProvider {
    pub(crate) fn new(
        provider_info: ModelProviderInfo,
        auth_manager: Option<Arc<AuthManager>>,
    ) -> Self {
        let auth_manager = auth_manager_for_provider(auth_manager, &provider_info);
        Self {
            info: provider_info,
            auth_manager,
        }
    }
}

#[async_trait::async_trait]
impl ModelProvider for DeepSeekModelProvider {
    fn info(&self) -> &ModelProviderInfo {
        &self.info
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            namespace_tools: false,
            image_generation: false,
            web_search: false,
        }
    }

    fn auth_manager(&self) -> Option<Arc<AuthManager>> {
        self.auth_manager.clone()
    }

    async fn auth(&self) -> Option<CodexAuth> {
        match self.auth_manager.as_ref() {
            Some(auth_manager) => auth_manager.auth().await,
            None => None,
        }
    }

    fn account_state(&self) -> ProviderAccountResult {
        Ok(ProviderAccountState {
            account: None,
            requires_openai_auth: false,
        })
    }

    fn models_manager(
        &self,
        _codex_home: PathBuf,
        config_model_catalog: Option<ModelsResponse>,
    ) -> SharedModelsManager {
        Arc::new(StaticModelsManager::new(
            self.auth_manager.clone(),
            config_model_catalog.unwrap_or_else(static_model_catalog),
        ))
    }
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::*;

    #[test]
    fn capabilities_disable_unsupported_features() {
        let provider = DeepSeekModelProvider::new(
            ModelProviderInfo::create_deepseek_provider(),
            /*auth_manager*/ None,
        );

        assert_eq!(
            provider.capabilities(),
            ProviderCapabilities {
                namespace_tools: false,
                image_generation: false,
                web_search: false,
            }
        );
    }
}
