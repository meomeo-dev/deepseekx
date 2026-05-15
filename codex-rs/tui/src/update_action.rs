#[cfg(any(not(debug_assertions), test))]
use codex_install_context::InstallContext;
#[cfg(any(not(debug_assertions), test))]
use codex_install_context::StandalonePlatform;

/// Update action the CLI should perform after the TUI exits.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UpdateAction {
    /// Update via `npm install -g @meomeo-dev/deepseekx@latest`.
    NpmGlobalLatest,
    /// Update via `bun install -g @meomeo-dev/deepseekx@latest`.
    BunGlobalLatest,
    /// Update via a Homebrew DeepSeekX package.
    BrewUpgrade,
    /// Standalone DeepSeekX updates are disabled until a DeepSeekX updater exists.
    StandaloneUnix,
    /// Standalone DeepSeekX updates are disabled until a DeepSeekX updater exists.
    StandaloneWindows,
}

impl UpdateAction {
    #[cfg(any(not(debug_assertions), test))]
    pub(crate) fn from_install_context(context: &InstallContext) -> Option<Self> {
        match context {
            InstallContext::Npm => Some(UpdateAction::NpmGlobalLatest),
            InstallContext::Bun => Some(UpdateAction::BunGlobalLatest),
            InstallContext::Brew => Some(UpdateAction::BrewUpgrade),
            InstallContext::Standalone { platform, .. } => Some(match platform {
                StandalonePlatform::Unix => UpdateAction::StandaloneUnix,
                StandalonePlatform::Windows => UpdateAction::StandaloneWindows,
            }),
            InstallContext::Other => None,
        }
    }

    /// Returns the list of command-line arguments for invoking the update.
    pub fn command_args(self) -> (&'static str, &'static [&'static str]) {
        match self {
            UpdateAction::NpmGlobalLatest => ("npm", &["install", "-g", "@meomeo-dev/deepseekx"]),
            UpdateAction::BunGlobalLatest => ("bun", &["install", "-g", "@meomeo-dev/deepseekx"]),
            UpdateAction::BrewUpgrade => ("brew", &["upgrade", "--cask", "deepseekx"]),
            UpdateAction::StandaloneUnix => (
                "sh",
                &[
                    "-c",
                    "echo 'DeepSeekX standalone auto-update is not configured.'",
                ],
            ),
            UpdateAction::StandaloneWindows => (
                "powershell",
                &[
                    "-c",
                    "Write-Error 'DeepSeekX standalone auto-update is not configured.'",
                ],
            ),
        }
    }

    /// Returns string representation of the command-line arguments for invoking the update.
    pub fn command_str(self) -> String {
        let (command, args) = self.command_args();
        shlex::try_join(std::iter::once(command).chain(args.iter().copied()))
            .unwrap_or_else(|_| format!("{command} {}", args.join(" ")))
    }
}

#[cfg(not(debug_assertions))]
pub fn get_update_action() -> Option<UpdateAction> {
    UpdateAction::from_install_context(InstallContext::current())
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;
    use std::path::PathBuf;

    #[test]
    fn maps_install_context_to_update_action() {
        let native_release_dir = PathBuf::from("/tmp/native-release");

        assert_eq!(
            UpdateAction::from_install_context(&InstallContext::Other),
            None
        );
        assert_eq!(
            UpdateAction::from_install_context(&InstallContext::Npm),
            Some(UpdateAction::NpmGlobalLatest)
        );
        assert_eq!(
            UpdateAction::from_install_context(&InstallContext::Bun),
            Some(UpdateAction::BunGlobalLatest)
        );
        assert_eq!(
            UpdateAction::from_install_context(&InstallContext::Brew),
            Some(UpdateAction::BrewUpgrade)
        );
        assert_eq!(
            UpdateAction::from_install_context(&InstallContext::Standalone {
                platform: StandalonePlatform::Unix,
                release_dir: native_release_dir.clone(),
                resources_dir: Some(native_release_dir.join("codex-resources")),
            }),
            Some(UpdateAction::StandaloneUnix)
        );
        assert_eq!(
            UpdateAction::from_install_context(&InstallContext::Standalone {
                platform: StandalonePlatform::Windows,
                release_dir: native_release_dir.clone(),
                resources_dir: Some(native_release_dir.join("codex-resources")),
            }),
            Some(UpdateAction::StandaloneWindows)
        );
    }

    #[test]
    fn standalone_update_commands_do_not_run_openai_installer() {
        assert_eq!(
            UpdateAction::StandaloneUnix.command_args(),
            (
                "sh",
                &[
                    "-c",
                    "echo 'DeepSeekX standalone auto-update is not configured.'"
                ][..],
            )
        );
        assert_eq!(
            UpdateAction::StandaloneWindows.command_args(),
            (
                "powershell",
                &[
                    "-c",
                    "Write-Error 'DeepSeekX standalone auto-update is not configured.'"
                ][..],
            )
        );
    }

    #[test]
    fn npm_and_bun_update_commands_use_deepseekx_package() {
        assert_eq!(
            UpdateAction::NpmGlobalLatest.command_args(),
            ("npm", &["install", "-g", "@meomeo-dev/deepseekx"][..])
        );
        assert_eq!(
            UpdateAction::BunGlobalLatest.command_args(),
            ("bun", &["install", "-g", "@meomeo-dev/deepseekx"][..])
        );
    }
}
