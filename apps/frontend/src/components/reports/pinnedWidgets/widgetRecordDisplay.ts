import { formatMoney } from "@mms/shared";
import { type useTranslation } from "@/hooks/useTranslation";
import { getFieldLabel } from "@/lib/reports/reportMetadata";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";

export interface WidgetRecordFields {
  id?: string;
  name?: string;
  studentName?: string;
  invoiceNo?: string;
  age?: number | string;
  gender?: string;
  studentId?: string;
  finalAmt?: number;
  date?: string;
  className?: string;
  quantity?: number;
  denominationName?: string;
  points?: number;
  isActive?: boolean;
  email?: string;
  room?: string;
  type?: string;
  status?: string;
}

export interface WidgetRecordDisplay {
  recordId: string;
  name: string;
  detailText: string;
  status: string;
  hasAction: boolean;
}

export function getWidgetRecordDisplay(
  recordSource: unknown,
  index: number,
  widget: CustomWidget,
  studentNameMap: Map<string, string>,
  t: ReturnType<typeof useTranslation>["t"],
): WidgetRecordDisplay {
  const displayRecord = recordSource as WidgetRecordFields;
  const recordId = String(displayRecord.id || index);

  let name = String(
    displayRecord.name || displayRecord.studentName || displayRecord.invoiceNo || displayRecord.id,
  );
  let detailText = "";
  let status = String(displayRecord.status || "active");
  let hasAction = true;

  if (widget.collection === "students") {
    name = String(displayRecord.name || "");
    detailText = t("reports.widgets.ageText", {
      age: String(displayRecord.age || t("common.notAvailable")),
      gender: displayRecord.gender
        ? getFieldLabel(displayRecord.gender, displayRecord.gender, t)
        : t("reports.widgets.any"),
    });
  } else if (widget.collection === "finance_invoices") {
    name = t("reports.widgets.invoiceText", {
      invoiceNo: displayRecord.invoiceNo || String(displayRecord.id || ""),
    });
    const studentId = String(displayRecord.studentId || "");
    const studentName =
      studentNameMap.get(studentId) || t("reports.widgets.studentHash", { id: studentId });
    detailText = `${studentName} • ${formatMoney(displayRecord.finalAmt || 0)}`;
  } else if (widget.collection === "attendance_records") {
    const studentId = String(displayRecord.studentId || "");
    name = studentNameMap.get(studentId) || t("reports.widgets.studentHash", { id: studentId });
    detailText = t("reports.widgets.classText", {
      date: displayRecord.date || "",
      className: displayRecord.className || t("reports.widgets.class"),
    });
  } else if (widget.collection === "hasanat_distributions") {
    const studentId = String(displayRecord.studentId || "");
    name = studentNameMap.get(studentId) || t("reports.widgets.studentHash", { id: studentId });
    detailText = t("reports.widgets.qtyText", {
      denomination: displayRecord.denominationName || t("reports.widgets.defaultDenomination"),
      qty: displayRecord.quantity || 1,
    });
    status = t("reports.widgets.pointsText", { points: displayRecord.points || 50 });
    hasAction = false;
  } else if (widget.collection === "contacts") {
    const genderLabel = displayRecord.gender
      ? getFieldLabel(displayRecord.gender, displayRecord.gender, t)
      : t("contacts.gender.unspecified");
    detailText = `${displayRecord.email || t("reports.widgets.noEmail")} • ${genderLabel}`;
    // Contacts roster is soft-delete filtered; form never writes `isActive`.
    status = "active";
  } else if (widget.collection === "sessions") {
    name = String(displayRecord.name || "");
    detailText = t("reports.widgets.roomText", {
      type: displayRecord.type || t("reports.widgets.defaultSessionType"),
      room: displayRecord.room || t("common.notAvailable"),
    });
  }

  return { recordId, name, detailText, status, hasAction };
}
