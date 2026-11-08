import { type Student } from "@/lib/data/studentsData";

import {
  calcEnrollmentFee,
  type CalculatedFee,
  type Enrollment,
  type EnrollmentTimelineItem,
  type SessionDiscountItem,
} from "@mms/shared";
export type { CalculatedFee, SessionDiscountItem };
export type { Enrollment, EnrollmentTimelineItem };

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
  sessionDiscounts: SessionDiscountItem[] = [],
): CalculatedFee {
  return calcEnrollmentFee(baseFee, student, sessionDiscounts);
}
