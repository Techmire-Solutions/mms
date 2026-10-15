import React, { useState, useCallback } from "react";
import { SendHorizontal, Sparkles, Loader2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@shared/ui";
import { Input } from "@shared/ui";
import { cn } from "@/lib/utils";

export interface PlatformAiPromptBarProps {
  onSend: (prompt: string) => void;
  isAnalyzing?: boolean;
  quickPrompts?: string[];
  placeholder?: string;
  className?: string;
}

export function PlatformAiPromptBar({
  onSend,
  isAnalyzing = false,
  quickPrompts = [],
  placeholder,
  className,
}: PlatformAiPromptBarProps): React.JSX.Element {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = prompt.trim();
      if (!trimmed || isAnalyzing) return;
      onSend(trimmed);
      setPrompt("");
    },
    [prompt, isAnalyzing, onSend],
  );

  const handleChipClick = useCallback(
    (chipText: string) => {
      if (isAnalyzing) return;
      onSend(chipText);
    },
    [isAnalyzing, onSend],
  );

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {quickPrompts.length > 0 ? (
        <div
          role="region"
          aria-label="AI quick suggestions"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none"
        >
          {quickPrompts.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="outline"
              size="sm"
              disabled={isAnalyzing}
              onClick={() => handleChipClick(suggestion)}
              className="shrink-0 h-9 min-h-9 px-3 rounded-full text-xs font-medium border-border/80 bg-background hover:bg-muted/80 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <Sparkles className="h-3 w-3 me-1.5 text-primary shrink-0" aria-hidden />
              <span>{suggestion}</span>
            </Button>
          ))}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="relative flex items-center w-full">
        <Input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder ?? t("platform.aiAskPlaceholder")}
          disabled={isAnalyzing}
          className="w-full min-h-11 h-11 ps-4 pe-14 text-xs sm:text-sm rounded-xl border-border bg-background focus:ring-2 focus:ring-primary/30"
          aria-label={t("platform.aiAskPlaceholder")}
        />
        <div className="absolute end-1.5 top-1/2 -translate-y-1/2 flex items-center">
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            disabled={!prompt.trim() || isAnalyzing}
            aria-label={t("common.send")}
            className="min-h-9 min-w-9 h-9 w-9 rounded-lg text-primary hover:bg-primary/10 disabled:opacity-40 cursor-pointer"
          >
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <SendHorizontal className="h-4 w-4 rtl:rotate-180" aria-hidden />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
