use clap::Parser;
use codex_utils_cli::PRODUCT_NAME;
use std::path::PathBuf;

#[derive(Debug, Parser)]
pub struct AppCommand {
    /// Workspace path for future DeepSeekX desktop integration.
    #[arg(value_name = "PATH", default_value = ".")]
    pub path: PathBuf,

    /// Override the app installer download URL (reserved).
    #[arg(long = "download-url")]
    pub download_url_override: Option<String>,
}

pub async fn run_app(cmd: AppCommand) -> anyhow::Result<()> {
    let _ = cmd;
    anyhow::bail!(
        "{PRODUCT_NAME} desktop integration is not configured. This build will not open or install external desktop apps."
    )
}
