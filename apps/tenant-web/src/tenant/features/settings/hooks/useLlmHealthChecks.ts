import { useState } from "react";
import type { LlmHealthStatus } from "../lib/llmSettingsControllerTypes";

export function useLlmHealthChecks() {
  const [healthStatuses, setHealthStatuses] = useState<Record<string, LlmHealthStatus>>({});

  return { healthStatuses, setHealthStatuses };
}
