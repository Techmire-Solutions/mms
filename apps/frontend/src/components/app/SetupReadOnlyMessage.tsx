import { Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { WORK_SURFACE } from "@/components/ui/formStyles";

interface SetupReadOnlyMessageProps {
  /** Translated read-only notice title (t() at the call site, per module). */
  title: string;
}

/** Read-only notice for module Setup tiers — shown when the viewer cannot edit setup. */
export function SetupReadOnlyMessage({ title }: SetupReadOnlyMessageProps): JSX.Element {
  return (
    <div className={`${WORK_SURFACE} border-border/40 p-6`}>
      <EmptyState variant="dashed" icon={Lock} title={title} />
    </div>
  );
}
