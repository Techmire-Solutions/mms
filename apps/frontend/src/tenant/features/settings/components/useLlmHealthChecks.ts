import { useState } from "react";
import type { LlmHealthStatus } from "./llmSettingsControllerTypes";

export function useLlmHealthChecks() {
  const [healthStatuses, setHealthStatuses] = useState<Record<string, LlmHealthStatus>>({});

  return { healthStatuses, setHealthStatuses };
}
