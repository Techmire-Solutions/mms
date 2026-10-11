import type { LlmTestMetrics } from "@mms/shared";

export interface SandboxMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  metrics?: LlmTestMetrics;
  error?: boolean;
}
