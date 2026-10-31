import type React from "react";
import { Loader2, MessageSquare, RotateCcw, Send, Sparkles } from "lucide-react";
import { FormSelect } from "@/components/app/FormSelect";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/app/SectionCard";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { LlmConfig } from "@mms/shared";
import type { SandboxMessage } from "../lib/llmSettingsTypes";

import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/app/EmptyState";

interface LlmSandboxPanelProps {
  configs: LlmConfig[];
  sandboxMessages: SandboxMessage[];
  setSandboxMessages: React.Dispatch<React.SetStateAction<SandboxMessage[]>>;
  sandboxInput: string;
  setSandboxInput: (input: string) => void;
  sandboxConfigId: string;
  setSandboxConfigId: (configId: string) => void;
  sandboxSystemInstruction: string;
  setSandboxSystemInstruction: (instruction: string) => void;
  sandboxTesting: boolean;
  handleSendSandboxMessage: (event?: React.FormEvent) => Promise<void>;
  formatLlmSpeed: (wordCount: number, latencyMs: number) => string;
  t: TranslationFunction;
}

export function LlmSandboxPanel({
  configs,
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
  formatLlmSpeed,
  t,
}: LlmSandboxPanelProps): React.JSX.Element | null {
  if (configs.length === 0) {
    return null;
  }

  return (
    <SectionCard
      title={t("settings.llmSandboxTitle")}
      subtitle={t("settings.llmSandboxSubtitle")}
      icon={MessageSquare}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sandboxConfig">{t("settings.llmActiveConfig")}</Label>
            <FormSelect
              id="sandboxConfig"
              value={
                sandboxConfigId ||
                configs.find((config) => config.isDefaultText)?.id ||
                configs[0]?.id ||
                ""
              }
              onChange={(configId) => setSandboxConfigId(configId)}
              options={configs.map((config) => ({
                value: config.id,
                label:
                  `${config.name} (${config.provider} - ${config.model})` +
                  (config.isDefaultText ? ` (${t("settings.llmDefaultBadge")})` : ""),
              }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sandboxSystem">{t("settings.llmSystemInstruction")}</Label>
            <Input
              id="sandboxSystem"
              value={sandboxSystemInstruction}
              onChange={(event) => setSandboxSystemInstruction(event.target.value)}
              placeholder={t("settings.llmSystemInstructionPlaceholder")}
            />
          </div>
        </div>

        {/* Chat Session Window */}
        <div className="border border-border/70 bg-card/40 rounded-2xl flex flex-col overflow-hidden shadow-inner">
          {/* Chat Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-border/60 bg-muted/20 shrink-0">
            <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 truncate">{t("settings.llmSandboxHistory")}</span>
            </div>
            {sandboxMessages.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSandboxMessages([])}
                className="shrink-0 text-xs px-2 text-muted-foreground hover:text-foreground gap-1.5"
              >
                <RotateCcw className="h-3 w-3" aria-hidden />
                <span>{t("settings.llmClearHistory")}</span>
              </Button>
            )}
          </div>

          {/* Messages Panel */}
          <div
            className="flex-1 min-h-panel-sm max-h-chat-scroll overflow-y-auto p-4 space-y-4 scroll-smooth"
            role="log"
            aria-live="polite"
            aria-label={t("settings.llmSandboxHistory")}
          >
            {sandboxMessages.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title={t("settings.llmSandboxReady")}
                description={t("settings.llmSandboxReadyDesc")}
                compact
                className="my-4 py-6"
              />
            ) : (
              sandboxMessages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={cn("flex flex-col", isUser ? "items-end" : "items-start")}
                  >
                    <div
                      className={cn(
                        "max-w-bubble rounded-2xl px-4 py-2.5 text-xs shadow-sm leading-relaxed",
                        isUser
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : msg.error
                            ? "bg-destructive/10 text-destructive border border-destructive/20 rounded-tl-none font-mono text-xs"
                            : "bg-card text-foreground border border-border rounded-tl-none",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    {!isUser && msg.metrics && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-2 text-xs font-semibold text-muted-foreground">
                        <span>
                          {t("settings.llmLatency")}: {msg.metrics.latencyMs}ms
                        </span>
                        <span className="hidden sm:inline" aria-hidden="true">
                          •
                        </span>
                        <span>
                          {t("settings.llmWordCount")}: {msg.metrics.wordCount}
                        </span>
                        <span className="hidden sm:inline" aria-hidden="true">
                          •
                        </span>
                        <span>
                          {t("settings.llmSpeed")}:{" "}
                          {formatLlmSpeed(msg.metrics.wordCount, msg.metrics.latencyMs)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {sandboxTesting && (
              <div className="flex items-center gap-2 text-muted-foreground px-2 py-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                <span className="text-xs font-medium animate-pulse">
                  {t("settings.llmThinking")}
                </span>
              </div>
            )}
          </div>

          {/* Chat Input Footer */}
          <form
            onSubmit={(event) => {
              void handleSendSandboxMessage(event);
            }}
            className="flex items-center gap-2 border-t border-border p-3 bg-card shrink-0"
          >
            <Input
              type="text"
              placeholder={t("settings.llmSandboxInputPlaceholder")}
              aria-label={t("settings.llmSandboxInputPlaceholder")}
              value={sandboxInput}
              onChange={(event) => setSandboxInput(event.target.value)}
              disabled={sandboxTesting}
              className="flex-1 min-h-11 text-xs"
            />
            <Button
              type="submit"
              size="sm"
              disabled={sandboxTesting || !sandboxInput.trim()}
              className="min-h-11 px-3 gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("common.send")}</span>
            </Button>
          </form>
        </div>
      </div>
    </SectionCard>
  );
}
