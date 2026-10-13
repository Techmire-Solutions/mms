import type { AppTranslationKey } from "@mms/shared";
import type { CustomCard } from "@/lib/reports/reportMetadata";

export function areStringListsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function areCustomCardsEqual(left: CustomCard[], right: CustomCard[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export const KPI_ROLE_ATTENDANCE_ONLY_IDS: string[] = [
  "kpi-total-students",
  "kpi-avg-attendance",
  "kpi-hasanat-awarded",
  "kpi-capacity-used",
];

export const KPI_ROLE_FINANCE_ONLY_IDS: string[] = [
  "kpi-fee-collected",
  "kpi-outstanding",
  "kpi-growth-rate",
];

export const KPI_TITLE_KEYS: Partial<Record<string, AppTranslationKey>> = {
  "kpi-total-students": "reports.kpi.totalStudents",
  "kpi-avg-attendance": "reports.kpi.avgAttendance",
  "kpi-fee-collected": "reports.kpi.feeCollected",
  "kpi-outstanding": "reports.kpi.outstanding",
  "kpi-hasanat-awarded": "reports.kpi.hasanatAwarded",
  "kpi-pass-rate": "reports.kpi.passRate",
  "kpi-capacity-used": "reports.kpi.capacityUsed",
  "kpi-growth-rate": "reports.kpi.growthRate",
  "kpi-total-questions": "reports.kpi.totalQuestions",
  "kpi-generated-tests": "reports.kpi.generatedTests",
  "kpi-test-submissions": "reports.kpi.testSubmissions",
  "kpi-avg-test-score": "reports.kpi.avgTestScore",
  "kpi-total-faculty": "reports.kpi.totalFaculty",
  "kpi-on-leave": "reports.kpi.onLeave",
  "kpi-whatsapp-verified": "reports.contacts.kpi.whatsappVerified",
  "kpi-missing-contact-info": "reports.contacts.kpi.missingContactInfo",
  "kpi-active-contacts": "reports.contacts.kpi.activeContacts",
  "kpi-total-contacts": "reports.contacts.kpi.totalContacts",
};
