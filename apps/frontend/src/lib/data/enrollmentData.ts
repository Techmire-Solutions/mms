import { type Student } from "@/lib/data/studentsData";

import type { Enrollment, EnrollmentTimelineItem } from "@mms/shared";
export type { Enrollment, EnrollmentTimelineItem };

export const ENROLLMENT_STATUSES = [
  { id: "pending", label: "Pending", color: "bg-warning/10 text-warning border-warning/30" },
  { id: "confirmed", label: "Confirmed", color: "bg-success/10 text-success border-success/30" },
  {
    id: "cancelled",
    label: "Cancelled",
    color: "bg-destructive/10 text-destructive border-destructive/30",
  },
  { id: "completed", label: "Completed", color: "bg-info/10 text-info border-info/30" },
];

export interface CalculatedFee {
  id: string;
  label: string;
  pct: number;
  discountAmt: number;
  finalFee: number;
  reason?: string;
}

export {
  calculateAgeFromDob,
  studentMatchesClassGender,
  suggestClass,
  runFullEligibility,
  type CheckResult,
} from "./enrollmentEligibility";

export interface SessionDiscountItem {
  id?: string;
  name?: string;
  value?: number;
  percentage?: number;
  type?: string;
}

export function calcFee(
  baseFee: number,
  student: Partial<Student>,
  _students: Student[],
  sessionDiscounts: SessionDiscountItem[] = [],
): CalculatedFee {
  const discountType = student.discountType || "none";
  let pct = student.discountPct ?? 0;
  let label = "No Discount";

  const matchedSessionDiscount = sessionDiscounts.find(
    (d) => d.id === discountType || (d.name && d.name.toLowerCase() === discountType.toLowerCase()),
  );

  if (matchedSessionDiscount) {
    label = matchedSessionDiscount.name ?? discountType;
    pct = matchedSessionDiscount.value ?? matchedSessionDiscount.percentage ?? 0;
  } else if (discountType === "sibling") {
    label = "Sibling Discount";
    if (pct === 0) pct = 10;
  } else if (discountType === "financial_aid") {
    label = "Financial Aid";
    if (pct === 0) pct = 25;
  } else if (discountType === "staff") {
    label = "Staff Child";
    if (pct === 0) pct = 50;
  } else if (discountType === "scholarship") {
    label = "Full Scholarship";
    if (pct === 0) pct = 100;
  } else if (pct > 0) {
    label = "Custom Discount";
  }

  const discountAmt = Math.round((baseFee * pct) / 100);
  const finalFee = Math.max(0, baseFee - discountAmt);

  return {
    id: discountType,
    label,
    pct,
    discountAmt,
    finalFee,
    reason: pct > 0 ? `${label} of ${pct}% applied.` : undefined,
  };
}
