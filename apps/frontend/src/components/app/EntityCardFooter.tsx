import React from "react";
import type { ReactNode } from "react";

export interface EntityCardFooterProps {
  leading?: ReactNode;
  trailing: ReactNode;
}

/** Shared Work directory card footer: optional leading (messaging) + trailing actions. */
export const EntityCardFooter = function EntityCardFooter({
  leading,
  trailing,
}: EntityCardFooterProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/40 pt-3 dark:border-border/20">
      {leading ? <div className="me-auto">{leading}</div> : null}
      <div className="flex shrink-0 items-center gap-1.5">{trailing}</div>
    </div>
  );
};
