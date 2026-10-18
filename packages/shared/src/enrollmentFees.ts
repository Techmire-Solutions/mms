/** Fee breakdown applied to an enrollment (shared by the enrollment wizard and server-side bulk enrollment). */
export interface CalculatedFee {
  id: string;
  label: string;
  pct: number;
  discountAmt: number;
  finalFee: number;
  reason?: string;
}

/** Session-level discount definition (id or name matched against the student's discount type). */
export interface SessionDiscountItem {
  id?: string;
  name?: string;
  value?: number;
  percentage?: number;
  type?: string;
}

/** Built-in discount types and their default percentages when the student has none set. */
const BUILT_IN_DISCOUNTS: Record<string, { label: string; pct: number }> = {
  sibling: { label: 'Sibling Discount', pct: 10 },
  financial_aid: { label: 'Financial Aid', pct: 25 },
  staff: { label: 'Staff Child', pct: 50 },
  scholarship: { label: 'Full Scholarship', pct: 100 },
};

/**
 * Enrollment fee: session discount matching the student's discount type wins, then built-in
 * discount types, then a custom student percentage. Amounts are rounded to whole currency units.
 */
export function calcEnrollmentFee(
  baseFee: number,
  student: { discountType?: string | null; discountPct?: number | null },
  sessionDiscounts: readonly SessionDiscountItem[] = [],
): CalculatedFee {
  const discountType = student.discountType || 'none';
  let pct = student.discountPct ?? 0;
  let label = 'No Discount';

  const matched = sessionDiscounts.find(
    (d) => d.id === discountType || (d.name && d.name.toLowerCase() === discountType.toLowerCase()),
  );
  const builtIn = BUILT_IN_DISCOUNTS[discountType];
  if (matched) {
    label = matched.name ?? discountType;
    pct = matched.value ?? matched.percentage ?? 0;
  } else if (builtIn) {
    label = builtIn.label;
    if (pct === 0) pct = builtIn.pct;
  } else if (pct > 0) {
    label = 'Custom Discount';
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
