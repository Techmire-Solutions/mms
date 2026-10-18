import type React from "react";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { cn } from "@/lib/utils";
import type { LlmTestResult } from "@mms/shared";

interface LlmModalTestResultBannerProps {
  modalTestResult: LlmTestResult;
  formatLlmSpeed: (wordCount: number, latencyMs: number) => string;
  t: TranslationFunction;
}

export function LlmModalTestResultBanner({
  modalTestResult,
  formatLlmSpeed,
  t,
}: LlmModalTestResultBannerProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "mt-3 rounded-xl border p-4 text-xs",
        modalTestResult.success
          ? "border-success/20 bg-success/5 text-success"
          : "border-destructive/20 bg-destructive/5 text-destructive",
      )}
    >
      <p className="mb-1 font-semibold">
        {modalTestResult.success ? t("settings.llmTestSuccess") : t("settings.llmTestFailed")}
      </p>
      <p className="mb-3 whitespace-pre-wrap font-mono text-xs leading-relaxed opacity-90">
        {modalTestResult.success ? modalTestResult.response : modalTestResult.message}
      </p>
      {modalTestResult.success && modalTestResult.metrics && (
        <div className="flex items-center gap-4 border-t border-success/10 pt-2 text-xs font-semibold text-success/80">
          <span>
            {t("settings.llmLatency")}: {modalTestResult.metrics.latencyMs} ms
          </span>
          <span>
            {t("settings.llmWordCount")}: {modalTestResult.metrics.wordCount}
          </span>
          <span>
            {t("settings.llmSpeed")}:{" "}
            {formatLlmSpeed(modalTestResult.metrics.wordCount, modalTestResult.metrics.latencyMs)}
          </span>
        </div>
      )}
    </div>
  );
}
