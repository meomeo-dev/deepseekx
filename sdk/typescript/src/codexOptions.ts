export type DeepSeekXConfigValue =
  | string
  | number
  | boolean
  | DeepSeekXConfigValue[]
  | DeepSeekXConfigObject;

export type DeepSeekXConfigObject = { [key: string]: DeepSeekXConfigValue };

export type DeepSeekXOptions = {
  deepseekxPathOverride?: string;
  baseUrl?: string;
  apiKey?: string;
  /**
   * Additional `--config key=value` overrides to pass to the DeepSeekX CLI.
   *
   * Provide a JSON object and the SDK will flatten it into dotted paths and
   * serialize values as TOML literals so they are compatible with the CLI's
   * `--config` parsing.
   */
  config?: DeepSeekXConfigObject;
  /**
   * Environment variables passed to the DeepSeekX CLI process. When provided, the SDK
   * will not inherit variables from `process.env`.
   */
  env?: Record<string, string>;
};
