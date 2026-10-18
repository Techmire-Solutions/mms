import React from "react";
import { WORK_SURFACE } from "@/components/ui/formStyles";

export interface Step6ConfirmationRowProps {
  label: string;
  value: React.ReactNode;
}

export function Step6ConfirmationRow({
  label,
  value,
}: Step6ConfirmationRowProps): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold text-foreground text-end">{value || "—"}</span>
    </div>
  );
}

export interface Step6ConfirmationSectionProps {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  title: string;
  children: React.ReactNode;
}

export function Step6ConfirmationSection({
  icon: Icon,
  title,
  children,
}: Step6ConfirmationSectionProps): React.JSX.Element {
  return (
    <section className={`${WORK_SURFACE} overflow-hidden`} aria-label={title}>
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
        <Icon className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
        <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">{title}</h4>
      </div>
      <div className="px-4">{children}</div>
    </section>
  );
}
