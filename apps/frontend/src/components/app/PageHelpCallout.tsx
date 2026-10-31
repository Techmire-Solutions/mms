import { useCallback, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

const DISMISSED_STORAGE_PREFIX = "mms.pageHelp.dismissed.";

function storageKeyFor(id: string): string {
  return `${DISMISSED_STORAGE_PREFIX}${id}`;
}

/** Reads the one-time dismissal flag; storage access can throw in private mode, so it is guarded. */
function readDismissed(id: string): boolean {
  try {
    return localStorage.getItem(storageKeyFor(id)) === "1";
  } catch {
    return false;
  }
}

function persistDismissed(id: string): void {
  try {
    localStorage.setItem(storageKeyFor(id), "1");
  } catch {
    // Dismissal is a per-viewer convenience; losing it in private mode is acceptable.
  }
}

interface PageHelpCalloutProps {
  /**
   * Stable id for this callout. Namespaces the per-viewer dismissal flag, so each page's
   * help can be dismissed independently and stays dismissed across reloads.
   */
  id: string;
  /** Translated heading, e.g. t("page.sessions.help.title"). */
  title: string;
  /** Translated step lines, each already passed through t() at the call site. */
  steps: readonly string[];
  /** Optional lead-in sentence above the steps. */
  description?: string;
  className?: string;
}

/**
 * Dismissible "how to use this page" callout for the top of a module page (the `banner`
 * slot of ModuleTierPage). Renders a short, numbered set of steps in an info-toned panel;
 * once dismissed it stays hidden for that viewer. Instructional only — never used for
 * errors or validation, which have their own surfaces.
 */
export function PageHelpCallout({
  id,
  title,
  steps,
  description,
  className,
}: PageHelpCalloutProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => readDismissed(id));

  const handleDismiss = useCallback(() => {
    persistDismissed(id);
    setDismissed(true);
  }, [id]);

  if (dismissed || steps.length === 0) return null;

  const headingId = `page-help-${id}-title`;

  return (
    <aside
      aria-labelledby={headingId}
      className={cn(
        "relative flex gap-3 rounded-xl border border-info/30 bg-info/10 ps-4 pe-14 py-4",
        className,
      )}
    >
      <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-info" aria-hidden="true" />
      <div className="min-w-0 space-y-2">
        <h2 id={headingId} className="text-sm font-semibold text-foreground">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        <ol className="ms-4 list-decimal space-y-1 text-sm text-muted-foreground marker:text-info">
          {steps.map((step, index) => (
            <li key={`${id}-step-${index}`}>{step}</li>
          ))}
        </ol>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleDismiss}
        aria-label={t("common.dismiss")}
        className="absolute end-1 top-1 h-11 w-11 min-h-11 min-w-11 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </aside>
  );
}
