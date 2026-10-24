import { useState, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import type {
  PlatformAiQueryRequest,
  PlatformAiQueryResponse,
  PlatformAiSuggestion,
  PlatformAiContext,
} from "@mms/shared";
import { ROUTES } from "@/lib/config/routes";

export interface PlatformChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions?: PlatformAiSuggestion[];
  latencyMs?: number;
  timestamp: number;
}

export function usePlatformAiDiagnostics(): {
  messages: PlatformChatMessage[];
  isAnalyzing: boolean;
  error: string | null;
  askCopilot: (prompt: string, contextOverride?: Partial<PlatformAiContext>) => Promise<void>;
  quickPrompts: string[];
  clearHistory: () => void;
} {
  const location = useLocation();
  const [messages, setMessages] = useState<PlatformChatMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const quickPrompts = useMemo(() => {
    const path = location.pathname;
    if (path.includes(ROUTES.platformSystem)) {
      return [
        "Explain connection pool saturation",
        "Analyze database round-trip latency",
        "Inspect Node.js memory footprint",
      ];
    }
    if (path.includes(ROUTES.platformWorkspaces)) {
      return [
        "Identify inactive workspaces",
        "Analyze workspace growth rate",
        "Check tenant RLS isolation status",
      ];
    }
    if (path.includes(ROUTES.platformActivityLogs)) {
      return [
        "Highlight recent security events",
        "Summarize administrative actions",
        "Explain recent system audit entries",
      ];
    }
    return [
      "Explain database pool metrics",
      "Summarize active workspaces",
      "Check BullMQ queue health",
      "Inspect platform audit log",
    ];
  }, [location.pathname]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const askCopilot = useCallback(
    async (prompt: string, contextOverride?: Partial<PlatformAiContext>) => {
      const trimmed = prompt.trim();
      if (!trimmed || isAnalyzing) return;

      const userMsgId = `user-${Date.now()}`;
      const assistantMsgId = `assistant-${Date.now() + 1}`;

      const userMsg: PlatformChatMessage = {
        id: userMsgId,
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsAnalyzing(true);
      setError(null);

      const requestPayload: PlatformAiQueryRequest = {
        prompt: trimmed,
        context: {
          currentRoute: location.pathname,
          ...contextOverride,
        },
      };

      try {
        const result = await apiContract.platform.aiQuery({ body: requestPayload });
        if (result.status !== 200) {
          const errorBody = result.body as { message?: string; type?: string } | undefined;
          throw new ApiError(
            result.status,
            errorBody?.message ?? "Diagnostics request failed",
            errorBody?.type,
          );
        }
        const response = result.body as PlatformAiQueryResponse;

        const assistantMsg: PlatformChatMessage = {
          id: assistantMsgId,
          role: "assistant",
          content: response.analysis,
          suggestions: response.suggestions,
          latencyMs: response.latencyMs,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Telemetry request failed");
      } finally {
        setIsAnalyzing(false);
      }
    },
    [isAnalyzing, location.pathname],
  );

  return {
    messages,
    isAnalyzing,
    error,
    askCopilot,
    quickPrompts,
    clearHistory,
  };
}
