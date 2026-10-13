import React, { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, X, Trash2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { usePlatformAiDiagnostics } from "@/platform/hooks/usePlatformAiDiagnostics";
import { PlatformAiMessageList } from "@/platform/components/intelligence/PlatformAiMessageList";
import { PlatformAiPromptBar } from "@/platform/components/intelligence/PlatformAiPromptBar";
import type { PlatformAiSuggestion } from "@mms/shared";
import { cn } from "@/lib/utils";

export interface PlatformAiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function PlatformAiDrawer({
  isOpen,
  onClose,
  className,
}: PlatformAiDrawerProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { messages, isAnalyzing, askCopilot, quickPrompts, clearHistory } =
    usePlatformAiDiagnostics();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSuggestionClick = useCallback(
    (suggestion: PlatformAiSuggestion) => {
      if (suggestion.target) {
        navigate(suggestion.target);
        onClose();
      } else if (suggestion.actionType === "refresh") {
        askCopilot("Refresh telemetry metrics");
      }
    },
    [navigate, onClose, askCopilot],
  );

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="platform-copilot-title"
      className="fixed inset-0 z-modal flex justify-end"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-xs transition-opacity cursor-pointer"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer Container */}
      <div
        className={cn(
          "relative z-modal flex h-full w-full sm:w-120 max-w-full flex-col bg-card border-s border-border shadow-2xl animate-in slide-in-from-right duration-200",
          className,
        )}
      >
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 id="platform-copilot-title" className="text-sm font-bold text-foreground">
                {t("platform.aiCopilotTitle")}
              </h2>
              <p className="text-2xs text-muted-foreground">{t("platform.aiCopilotSubtitle")}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={clearHistory}
                aria-label={t("common.delete")}
                className="min-h-11 min-w-11 h-11 w-11 rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={t("common.close")}
              className="min-h-11 min-w-11 h-11 w-11 rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-5 w-5" aria-hidden />
            </Button>
          </div>
        </header>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto">
          <PlatformAiMessageList
            messages={messages}
            isAnalyzing={isAnalyzing}
            onSuggestionClick={handleSuggestionClick}
          />
        </div>

        {/* Prompt Input Footer */}
        <footer className="shrink-0 border-t border-border p-4 bg-muted/20">
          <PlatformAiPromptBar
            onSend={askCopilot}
            isAnalyzing={isAnalyzing}
            quickPrompts={messages.length === 0 ? quickPrompts : []}
          />
        </footer>
      </div>
    </div>
  );
}
