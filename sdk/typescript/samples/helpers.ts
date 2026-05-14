import path from "node:path";

export function deepseekxPathOverride() {
  return (
    process.env.DEEPSEEKX_EXECUTABLE ??
    path.join(process.cwd(), "..", "..", "codex-rs", "target", "debug", "deepseekx")
  );
}
