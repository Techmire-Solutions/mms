import React from "react";
import { Sparkles, ArrowRight, Activity, Terminal } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@shared/ui";
import { Badge } from "@shared/ui";
import type { PlatformChatMessage } from "@/platform/hooks/usePlatformAiDiagnostics";
import type { PlatformAiSuggestion } from "@mms/shared";
import { cn } from "@/lib/utils";

export interface PlatformAiMessageListProps {
  messages: PlatformChatMessage[];
  isAnalyzing: boolean;
  onSuggestionClick: (suggestion: PlatformAiSuggestion) => void;
  className?: string;
}

export function PlatformAiMessageList({
  messages,
  isAnalyzing,
  onSuggestionClick,
  className,
}: PlatformAiMessageListProps): React.JSX.Element {
  const { t } = useTranslation();

  if (messages.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-1 flex-col items-center justify-center p-6 text-center text-muted-foreground",
          className,
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
          <Sparkles className="h-6 w-6" aria-hidden />
        </div>
        <h3 className="text-sm font-bold text-foreground mb-1">{t("platform.aiCopilotTitle")}</h3>
        <p className="text-xs text-muted-foreground max-w-xs mb-4">
          {t("platform.aiCopilotSubtitle")}
        </p>
        <div className="flex items-center gap-2 text-2xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border/60">
          <Activity className="h-3 w-3 text-success animate-pulse" aria-hidden />
          <span>{t("platform.banner.realtimePulse")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4 p-4 overflow-y-auto", className)}>
      {messages.map((msg) => {
        const isUser = msg.role === "user";
        return (
          <div
            key={msg.id}
            className={cn(
              "flex flex-col gap-1.5 max-w-5/6",
              isUser ? "ms-auto items-end" : "me-auto items-start",
            )}
          >
            <div
              className={cn(
                "rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs",
                isUser
                  ? "bg-primary text-primary-foreground rounded-tr-xs"
                  : "bg-muted/70 text-foreground border border-border/80 rounded-tl-xs",
              )}
            >
              {!isUser && (
                <div className="flex items-center gap-1.5 mb-1.5 text-2xs font-semibold text-primary">
                  <Terminal className="h-3 w-3" aria-hidden />
                  <span>{t("platform.aiCopilotTitle")}</span>
                  {msg.latencyMs !== undefined && (
                    <Badge
                      as="span"
                      tone="muted"
                      size="sm"
                      className="ms-auto text-3xs font-mono py-0 px-1"
                    >
                      {msg.latencyMs}ms
                    </Badge>
                  )}
                </div>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>

            {!isUser && msg.suggestions && msg.suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1 ps-1">
                {msg.suggestions.map((sug) => (
                  <Button
                    key={sug.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onSuggestionClick(sug)}
                    className="min-h-9 h-9 text-xs rounded-xl border-primary/30 hover:border-primary bg-background hover:bg-primary/5 text-foreground cursor-pointer transition-colors"
                  >
                    <span>{sug.label}</span>
                    <ArrowRight className="h-3 w-3 ms-1 text-primary rtl:rotate-180" aria-hidden />
                  </Button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {isAnalyzing && (
        <div className="flex items-center gap-2 me-auto bg-muted/60 text-muted-foreground border border-border/80 rounded-2xl rounded-tl-xs px-3.5 py-2.5 text-xs shadow-xs animate-pulse">
          <Sparkles className="h-3.5 w-3.5 text-primary animate-spin" aria-hidden />
          <span>{t("platform.aiAnalyzing")}</span>
        </div>
      )}
    </div>
  );
}
