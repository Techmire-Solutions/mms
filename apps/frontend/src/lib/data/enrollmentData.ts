import { type Student } from "@/lib/data/studentsData";


import { calcEnrollmentFee, type CalculatedFee, type Enrollment, type EnrollmentTimelineItem, type SessionDiscountItem } from '@mms/shared';
export type { CalculatedFee, SessionDiscountItem };
export type { Enrollment, EnrollmentTimelineItem };

export const ENROLLMENT_STATUSES = [
  { id: "pending",   label: "Pending",   color: "bg-warning/10 text-warning border-warning/30" },
  { id: "confirmed", label: "Confirmed", color: "bg-success/10 text-success border-success/30" },
  { id: "cancelled", label: "Cancelled", color: "bg-destructive/10 text-destructive border-destructive/30" },
  { id: "completed", label: "Completed", color: "bg-info/10 text-info border-info/30" },
];


export {
  calculateAgeFromDob,
  studentMatchesClassGender,
  suggestClass,
  runFullEligibility,
  type CheckResult,
} from "./enrollmentEligibility";

/** Fee rule lives in `@mms/shared` so server-side bulk enrollment applies the same discounts. */
export function calcFee(
  baseFee: number,
  student: Partial<Student>,
  _students: Student[],
  sessionDiscounts: SessionDiscountItem[] = []
): CalculatedFee {
  return calcEnrollmentFee(baseFee, student, sessionDiscounts);
}
