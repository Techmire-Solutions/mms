import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

/**
 * Structural skeleton fallback for lazy module Setup tiers and preference panels.
 * Eliminates spinner artifacts and layout shift during tab/panel chunk resolution.
 */
export function ModulePanelSuspenseFallback({
  className,
}: {
  className?: string;
  spinnerClassName?: string;
}): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      className={cn("space-y-4 py-2 animate-pulse", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{t("common.loading")}</span>
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1.5 min-w-0">
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="h-3.5 w-64 rounded-md" />
          </div>
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
        <div className="space-y-3 pt-2">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
