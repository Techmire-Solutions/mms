import React from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { type CheckResult } from "@/lib/data/enrollmentData";

const ICONS: Record<string, React.ReactElement> = {
  pass: <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" aria-hidden="true" />,
  fail: <XCircle className="w-4 h-4 text-destructive flex-shrink-0" aria-hidden="true" />,
  warn: <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" aria-hidden="true" />,
};

const ROW_BG: Record<string, string> = {
  pass: "bg-success/10 border-success/30",
  fail: "bg-destructive/10 border-destructive/30",
  warn: "bg-warning/10 border-warning/30",
};

const LABEL_COL: Record<string, string> = {
  pass: "text-success",
  fail: "text-destructive",
  warn: "text-warning",
};

/**
 * Renders an eligibility check list (icon + label + detail per row). Shared by the standalone
 * `EligibilityCheck` directory view and the enrollment wizard's `Step3Eligibility`.
 */
export function EligibilityCheckRows({
  checks,
  ariaLabel,
}: {
  checks: CheckResult[];
  ariaLabel: string;
}): React.JSX.Element {
  return (
    <div className="space-y-2" role="list" aria-label={ariaLabel}>
      {checks.map((check) => (
        <div
          key={check.id}
          className={`flex items-start gap-3 p-3 rounded-xl border ${ROW_BG[check.status]}`}
          role="listitem"
        >
          <div className="mt-0.5">{ICONS[check.status]}</div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold ${LABEL_COL[check.status]}`}>{check.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
