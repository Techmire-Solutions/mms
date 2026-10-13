import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WarningCallout } from "@/components/app/WarningCallout";
import { cn } from "@/lib/utils";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

export interface ModuleSetupSaveFooterProps {
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  /** Shown above the footer when `dirty` is true. */
  unsavedWarning?: string;
  saveLabel: string;
  savedLabel: string;
  onSave: () => void | Promise<void>;
  /** Optional layout override (e.g. sticky Contacts chrome). */
  footerClassName?: string;
  buttonClassName?: string;
  /**
   * Confirmation dialog message shown when the user navigates away with
   * unsaved changes (P2-5 — unsaved-changes guard). Defaults to a generic prompt.
   */
  navigationBlockMessage?: string;
  /** When true, skips registering the window beforeunload handler (useful for section-level footers). */
  disableUnsavedGuard?: boolean;
}

/** Shared Setup Fields/Preferences unsaved warning + Save footer. */
export function ModuleSetupSaveFooter({
  dirty,
  saving,
  saved,
  unsavedWarning,
  saveLabel,
  savedLabel,
  onSave,
  footerClassName,
  buttonClassName,
  navigationBlockMessage,
  disableUnsavedGuard,
}: ModuleSetupSaveFooterProps): React.JSX.Element {
  // Intercepts browser unload / tab close when dirty (P2-5).
  useUnsavedChangesGuard({
    isDirty: disableUnsavedGuard ? false : dirty,
    message: navigationBlockMessage,
  });

  return (
    <>
      {dirty && unsavedWarning ? (
        <WarningCallout role="alert" density="banner" description={unsavedWarning} />
      ) : null}

      <footer
        className={cn(
          "flex w-full items-center justify-end gap-3 border-t border-border/40 mt-6 pt-4",
          footerClassName,
        )}
      >
        <Button
          type="button"
          onClick={() => {
            void onSave();
          }}
          disabled={saving || !dirty}
          aria-busy={saving}
          className={cn(
            saved ? "bg-success hover:bg-success/90 text-success-foreground ms-auto" : "ms-auto",
            buttonClassName,
          )}
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
          )}{" "}
          {saved ? savedLabel : saveLabel}
        </Button>
      </footer>
    </>
  );
}
