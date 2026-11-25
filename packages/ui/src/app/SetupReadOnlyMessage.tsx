import type React from "react";
import { Lock } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { WORK_SURFACE } from "@mms/ui";

interface SetupReadOnlyMessageProps {
  /** Translated read-only notice title (t() at the call site, per module). */
  title: string;
}

/** Read-only notice for module Setup tiers — shown when the viewer cannot edit setup. */
export function SetupReadOnlyMessage({ title }: SetupReadOnlyMessageProps): React.JSX.Element {
  return (
    <div className={`${WORK_SURFACE} border-border/40 p-6`}>
      <EmptyState variant="dashed" icon={Lock} title={title} />
    </div>
  );
}
