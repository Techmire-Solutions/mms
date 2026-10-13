import { useState } from "react";
import type React from "react";
import { apiContract } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import type { LlmConfig, LlmTestResult } from "@mms/shared";
import type { SandboxMessage } from "../lib/llmSettingsTypes";

export function useLlmSettingsSandbox(configs: LlmConfig[]) {
  const { t } = useTranslation();
  const [sandboxMessages, setSandboxMessages] = useState<SandboxMessage[]>([]);
  const [sandboxInput, setSandboxInput] = useState("");
  const [sandboxConfigId, setSandboxConfigId] = useState<string>("");
  const [sandboxSystemInstruction, setSandboxSystemInstruction] = useState("");
  const [sandboxTesting, setSandboxTesting] = useState(false);

  const handleSendSandboxMessage = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    const promptText = sandboxInput.trim();
    if (!promptText || sandboxTesting) return;

    const targetConfigId =
      sandboxConfigId || configs.find((config) => config.isDefaultText)?.id || configs[0]?.id;
    if (!targetConfigId) return;

    const userMsg: SandboxMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: promptText,
    };

    setSandboxMessages((prev) => [...prev, userMsg]);
    setSandboxInput("");
    setSandboxTesting(true);

    const historyForApi = [...sandboxMessages, userMsg].map((message) => ({
      role: message.role,
      content: message.content,
    }));

    try {
      const res = await apiContract.ai.test({
        body: {
          prompt: promptText,
          systemInstruction: sandboxSystemInstruction.trim() || undefined,
          configId: targetConfigId,
          messages: historyForApi,
        },
      });
      const status = res.status;
      const body = res.body as LlmTestResult;

      if (status === 200 && body.success && body.response) {
        const responseText = body.response;
        setSandboxMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: responseText,
            metrics: body.metrics,
          },
        ]);
      } else {
        setSandboxMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: body.message || t("settings.llmTestConnectionError"),
            error: true,
          },
        ]);
      }
    } catch (err: unknown) {
      setSandboxMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: (err instanceof Error ? err.message : undefined) || t("settings.llmSendFailed"),
          error: true,
        },
      ]);
    } finally {
      setSandboxTesting(false);
    }
  };

  return {
    sandboxMessages,
    setSandboxMessages,
    sandboxInput,
    setSandboxInput,
    sandboxConfigId,
    setSandboxConfigId,
    sandboxSystemInstruction,
    setSandboxSystemInstruction,
    sandboxTesting,
    handleSendSandboxMessage,
  };
}
