import type React from "react";
import { AlertTriangle, CheckCircle, Sparkles } from "lucide-react";
import { SectionCard } from "@/components/app/SectionCard";
import { cn } from "@/lib/utils";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { LlmTestResult } from "@mms/shared";

interface LlmConfigTestResultPanelProps {
  testResult: LlmTestResult;
  formatLlmSpeed: (wordCount: number, latencyMs: number) => string;
  t: TranslationFunction;
}

export function LlmConfigTestResultPanel({
  testResult,
  formatLlmSpeed,
  t,
}: LlmConfigTestResultPanelProps): React.JSX.Element {
  return (
    <SectionCard
      title={t("settings.llmTestResultTitle")}
      subtitle={t("settings.llmTestResultDesc")}
      icon={Sparkles}
    >
      <div
        className={cn(
          "rounded-xl border p-4 text-sm",
          testResult.success
            ? "border-success/20 bg-success/5 text-success"
            : "border-destructive/20 bg-destructive/5 text-destructive",
        )}
      >
        <div className="flex items-start gap-3">
          {testResult.success ? (
            <CheckCircle className="mt-1 h-4 w-4 shrink-0 text-success" />
          ) : (
            <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-destructive" />
          )}
          <div className="space-y-1 w-full overflow-hidden">
            <p className="font-semibold">
              {testResult.success ? t("settings.llmTestSuccess") : t("settings.llmTestFailed")}
            </p>
            <p className="whitespace-pre-wrap leading-relaxed opacity-90 font-mono text-xs mb-3">
              {testResult.success ? testResult.response : testResult.message}
            </p>
            {testResult.success && testResult.metrics && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-success/10 pt-3 text-xs font-semibold text-success/80">
                <div>
                  <span className="block font-normal text-muted-foreground">
                    {t("settings.llmLatency")}
                  </span>
                  <span>{testResult.metrics.latencyMs} ms</span>
                </div>
                <div>
                  <span className="block font-normal text-muted-foreground">
                    {t("settings.llmWordCount")}
                  </span>
                  <span>
                    {testResult.metrics.wordCount} {t("settings.llmUnitWords")}
                  </span>
                </div>
                <div>
                  <span className="block font-normal text-muted-foreground">
                    {t("settings.llmCharCount")}
                  </span>
                  <span>
                    {testResult.metrics.characterCount} {t("settings.llmUnitChars")}
                  </span>
                </div>
                <div>
                  <span className="block font-normal text-muted-foreground">
                    {t("settings.llmSpeed")}
                  </span>
                  <span>
                    {formatLlmSpeed(testResult.metrics.wordCount, testResult.metrics.latencyMs)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
