import type React from "react";
import { Check, Edit2, Globe, Loader2, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CARD_STRIPE_BASE, CARD_STRIPE_INSET } from "@/lib/ui/semanticTone";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { LlmConfig } from "@mms/shared";

type LlmHealthStatus = "verified" | "failed" | "testing" | "untested";

interface LlmConfigCardProps {
  config: LlmConfig;
  status: LlmHealthStatus;
  testingId: string | null;
  isGlobalDirty: boolean;
  t: TranslationFunction;
  openEditModal: (config: LlmConfig) => void;
  handleDeleteConfig: (configId: string) => void;
  handleTestConnection: (configId: string) => Promise<void>;
}

export function LlmConfigCard({
  config,
  status,
  testingId,
  isGlobalDirty,
  t,
  openEditModal,
  handleDeleteConfig,
  handleTestConnection,
}: LlmConfigCardProps): React.JSX.Element {
  return (
    <motion.div
      layout
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "relative overflow-hidden group/card flex flex-col justify-between rounded-2xl border p-4 shadow-sm transition-all",
        CARD_STRIPE_INSET,
        config.isDefaultText
          ? "border-primary/40 bg-primary/5 dark:bg-primary/10 ring-1 ring-primary/20"
          : "border-border/70 bg-card",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          CARD_STRIPE_BASE,
          "transition-colors duration-150 ease-out",
          config.isDefaultText
            ? "bg-primary/80 group-hover/card:bg-primary"
            : "bg-primary/45 group-hover/card:bg-primary",
        )}
      />
      <div>
        <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className="flex shrink-0 items-center justify-center"
              role="status"
              aria-label={
                status === "testing"
                  ? t("settings.llmThinking")
                  : status === "verified"
                    ? t("settings.llmTestSuccess")
                    : status === "failed"
                      ? t("settings.llmTestFailed")
                      : t("settings.llmTestResultDesc")
              }
            >
              {status === "testing" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" aria-hidden />
              ) : status === "verified" ? (
                <span
                  className="h-2.5 w-2.5 rounded-full bg-success ring-2 ring-success/20 shrink-0"
                  title={t("settings.llmTestSuccess")}
                />
              ) : status === "failed" ? (
                <span
                  className="h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-destructive/20 shrink-0"
                  title={t("settings.llmTestFailed")}
                />
              ) : (
                <span
                  className="h-2.5 w-2.5 rounded-full bg-warning ring-2 ring-warning/20 shrink-0"
                  title={t("settings.llmTestResultDesc")}
                />
              )}
            </span>
            <h4 title={config.name} className="min-w-0 truncate text-sm font-bold">{config.name}</h4>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {config.isDefaultText && (
              <Badge pill tone="primary" className="gap-1 px-2.5 py-1 text-3xs font-semibold">
                <Check className="h-3 w-3" /> {t("settings.llmTextDefault")}
              </Badge>
            )}
          </div>
        </div>
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 font-medium text-foreground">
              {t("settings.llmModelToken")}
            </span>
            <span className="min-w-0 truncate rounded-md border border-border/50 bg-muted px-2 py-0.5 font-mono text-3xs font-medium leading-normal">
              {config.model}
            </span>
          </div>
          {config.baseUrl && (
            <div className="flex min-w-0 items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" aria-hidden />
              <span className="min-w-0 truncate font-mono text-3xs">{config.baseUrl}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-border/50 pt-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleTestConnection(config.id)}
          disabled={testingId !== null || isGlobalDirty}
          className="min-h-11 text-xs px-3"
        >
          {testingId === config.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin me-1" aria-hidden />
          ) : null}
          <span>{t("settings.llmTestApi")}</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => openEditModal(config)}
          className="min-h-11 min-w-11 px-3 text-xs"
          aria-label={t("common.edit")}
        >
          <Edit2 className="h-3.5 w-3.5" aria-hidden />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleDeleteConfig(config.id)}
          className="min-h-11 min-w-11 px-3 text-xs text-destructive hover:bg-destructive/10 hover:border-destructive/30"
          aria-label={t("common.delete")}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </motion.div>
  );
}
