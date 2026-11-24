import type { LlmTestMetrics } from "@mms/contracts";

export interface SandboxMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  metrics?: LlmTestMetrics;
  error?: boolean;
}
