import { getQuestionBankHost } from "../host.js";

/** Live view of the app's standard module config registry (value semantics). */
export const STANDARD_MODULES_CONFIG_REGISTRY: Record<string, unknown> = new Proxy(
  {},
  {
    get: (_t: any, key: any) =>
      (getQuestionBankHost() as any).standardModulesConfigRegistry?.[String(key)],
  },
);
