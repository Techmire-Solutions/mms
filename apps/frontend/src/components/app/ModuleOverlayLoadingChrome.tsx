import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";

/** Full-screen Suspense fallback for lazy FormModal / MessageComposer overlays. */
export function ModuleOverlayLoadingFallback(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      data-overlay-backdrop
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/20"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      <span className="sr-only">{t("common.loading")}</span>
    </div>
  );
}

/** End-docked Suspense fallback for lazy profile / detail drawers. */
export function ModuleDrawerLoadingSkeleton(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      data-overlay-backdrop
      className="fixed inset-0 z-modal flex items-center justify-end bg-black/20"
    >
      <div
        className="flex h-full w-full max-w-full flex-col gap-3 border-s border-border bg-card p-5 sm:max-w-sm"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">{t("common.loading")}</span>
        <Skeleton className="h-5 w-2/3 rounded" aria-hidden />
        <Skeleton className="h-11 w-full rounded-xl" aria-hidden />
        <Skeleton className="h-24 w-full rounded-2xl" aria-hidden />
        <Skeleton className="h-32 w-full rounded-2xl" aria-hidden />
      </div>
    </div>
  );
}
