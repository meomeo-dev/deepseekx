pub const PRODUCT_NAME: &str = "DeepSeekX";
pub const PRIMARY_COMMAND: &str = "deepseekx";

pub fn root_usage() -> String {
    format!(
        "{PRIMARY_COMMAND} [OPTIONS] [PROMPT]\n       \
         {PRIMARY_COMMAND} [OPTIONS] <COMMAND> [ARGS]"
    )
}

pub fn exec_usage() -> String {
    format!(
        "{PRIMARY_COMMAND} exec [OPTIONS] [PROMPT]\n       \
         {PRIMARY_COMMAND} exec [OPTIONS] <COMMAND> [ARGS]"
    )
}
