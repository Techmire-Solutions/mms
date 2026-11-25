import type { Student } from "@mms/contracts";

import {
  calcEnrollmentFee,
  type CalculatedFee,
  type Enrollment,
  type EnrollmentTimelineItem,
  type SessionDiscountItem,
} from "@mms/contracts";
export type { CalculatedFee, SessionDiscountItem };
export type { Enrollment, EnrollmentTimelineItem };

export {
  calculateAgeFromDob,
  studentMatchesClassGender,
  suggestClass,
  runFullEligibility,
  type CheckResult,
} from "./enrollmentEligibility.js";

/** Fee rule lives in `@mms/contracts` so server-side bulk enrollment applies the same discounts. */
export function calcFee(
  baseFee: number,
  student: Partial<Student>,
  _students: Student[],
  sessionDiscounts: SessionDiscountItem[] = [],
): CalculatedFee {
  return calcEnrollmentFee(baseFee, student, sessionDiscounts);
}
