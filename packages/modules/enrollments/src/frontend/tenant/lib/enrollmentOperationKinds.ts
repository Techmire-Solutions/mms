import { ArrowRightLeft, LogOut, PauseCircle, RotateCcw, type LucideIcon } from "lucide-react";
import type { AppTranslationKey } from "@mms/contracts";

export type EnrollmentOperationKind = "transfer" | "withdraw" | "readmit" | "suspend";

export interface EnrollmentOperationKindConfig {
  title: AppTranslationKey;
  subtitle?: AppTranslationKey;
  callout?: AppTranslationKey;
  icon: LucideIcon;
  save: AppTranslationKey;
  dateLabel: AppTranslationKey;
  /** Destination picker: required (transfer), optional prefilled (readmit) or hidden. */
  picker?: "required" | "optional";
}

/** Copy + chrome for each dated, reasoned mid-session enrollment change. */
export const ENROLLMENT_OPERATION_KINDS: Record<
  EnrollmentOperationKind,
  EnrollmentOperationKindConfig
> = {
  transfer: {
    title: "enrollments.ops.transferTitle",
    subtitle: "enrollments.ops.transferSubtitle",
    icon: ArrowRightLeft,
    save: "enrollments.ops.confirmTransfer",
    dateLabel: "enrollments.ops.effectiveOn",
    picker: "required",
  },
  withdraw: {
    title: "enrollments.ops.withdrawTitle",
    callout: "enrollments.ops.withdrawSubtitle",
    icon: LogOut,
    save: "enrollments.ops.confirmWithdraw",
    dateLabel: "enrollments.ops.lastDay",
  },
  readmit: {
    title: "enrollments.ops.readmitTitle",
    subtitle: "enrollments.ops.readmitSubtitle",
    icon: RotateCcw,
    save: "enrollments.ops.confirmReadmit",
    dateLabel: "enrollments.ops.effectiveOn",
    picker: "optional",
  },
  suspend: {
    title: "enrollments.ops.suspendTitle",
    callout: "enrollments.ops.suspendSubtitle",
    icon: PauseCircle,
    save: "enrollments.ops.confirmSuspend",
    dateLabel: "enrollments.ops.leaveFrom",
  },
};
