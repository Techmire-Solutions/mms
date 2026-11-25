import type { AttendanceLeave } from "@mms/contracts";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { ConfirmAlertDialog } from "@mms/fe-core/components/ConfirmAlertDialog";

export interface AttendanceDecisionTarget {
  leave: AttendanceLeave;
  decision: "approve" | "reject";
}

export interface AttendanceAlertTarget {
  id: string;
  status: "resolved" | "dismissed";
}

interface AttendanceLifecycleDialogsProps {
  t: TranslationFunction;
  decision: AttendanceDecisionTarget | null;
  cancelTarget: AttendanceLeave | null;
  alertTarget: AttendanceAlertTarget | null;
  onDecisionOpenChange: (open: boolean) => void;
  onCancelOpenChange: (open: boolean) => void;
  onAlertOpenChange: (open: boolean) => void;
  /** Resolves after the write; `false` keeps the dialog (and typed note) open. */
  onReview: (target: AttendanceDecisionTarget, note?: string) => Promise<boolean>;
  onCancelLeave: (target: AttendanceLeave, reason?: string) => Promise<boolean>;
  onResolveAlert: (target: AttendanceAlertTarget, note?: string) => Promise<boolean>;
  onReasonRequired: () => void;
}

/**
 * The three lifecycle confirms. Extracted from `AttendanceLifecyclePanel` so the panel
 * stays under the 300-line ceiling; each handler awaits its mutation before closing.
 */
export function AttendanceLifecycleDialogs({
  t,
  decision,
  cancelTarget,
  alertTarget,
  onDecisionOpenChange,
  onCancelOpenChange,
  onAlertOpenChange,
  onReview,
  onCancelLeave,
  onResolveAlert,
  onReasonRequired,
}: AttendanceLifecycleDialogsProps): React.JSX.Element {
  return (
    <>
      <ConfirmAlertDialog
        open={decision !== null}
        onOpenChange={onDecisionOpenChange}
        title={
          decision?.decision === "reject"
            ? t("attendance.excuses.rejectTitle")
            : t("attendance.excuses.approveTitle")
        }
        description={
          decision?.decision === "reject"
            ? t("attendance.excuses.rejectBody")
            : t("attendance.excuses.approveBody")
        }
        confirmLabel={
          decision?.decision === "reject"
            ? t("attendance.excuses.reject")
            : t("attendance.excuses.approve")
        }
        destructive={decision?.decision === "reject"}
        optionalReason={{
          label: t("attendance.excuses.decideNoteLabel"),
          placeholder: t("attendance.excuses.decideNotePlaceholder"),
        }}
        onConfirm={async (note) => {
          if (!decision) return false;
          return onReview(decision, note);
        }}
      />

      <ConfirmAlertDialog
        open={cancelTarget !== null}
        onOpenChange={onCancelOpenChange}
        title={t("attendance.excuses.cancelTitle")}
        description={t("attendance.excuses.cancelBody")}
        confirmLabel={t("attendance.excuses.cancel")}
        destructive
        optionalReason={{
          label: t("attendance.excuses.cancelReasonLabel"),
          placeholder: t("attendance.excuses.cancelReasonPlaceholder"),
        }}
        onConfirm={async (reason) => {
          if (!cancelTarget) return false;
          if (!reason?.trim()) {
            onReasonRequired();
            return false;
          }
          return onCancelLeave(cancelTarget, reason);
        }}
      />

      <ConfirmAlertDialog
        open={alertTarget !== null}
        onOpenChange={onAlertOpenChange}
        title={t("attendance.alerts.resolveTitle")}
        description={t("attendance.alerts.resolveBody")}
        confirmLabel={t("attendance.alerts.resolve")}
        optionalReason={{
          label: t("attendance.alerts.resolveNoteLabel"),
          placeholder: t("attendance.alerts.resolveNotePlaceholder"),
        }}
        onConfirm={async (note) => {
          if (!alertTarget) return false;
          return onResolveAlert(alertTarget, note);
        }}
      />
    </>
  );
}
