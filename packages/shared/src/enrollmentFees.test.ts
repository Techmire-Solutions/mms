import { describe, expect, it } from 'vitest';
import { calcEnrollmentFee } from './enrollmentFees.js';

describe('calcEnrollmentFee', () => {
  it('given a session discount matching the student type, should apply its percentage over built-ins', () => {
    // Arrange
    const student = { discountType: 'sibling', discountPct: 0 };

    // Act
    const fee = calcEnrollmentFee(1000, student, [{ id: 'sibling', name: 'Sibling', percentage: 30 }]);

    // Assert
    expect(fee).toMatchObject({ id: 'sibling', label: 'Sibling', pct: 30, discountAmt: 300, finalFee: 700 });
  });

  it('given a built-in type without a percentage, should use the default and never go below zero', () => {
    // Arrange
    const scholarship = { discountType: 'scholarship' };
    const custom = { discountType: 'other', discountPct: 150 };

    // Act
    const full = calcEnrollmentFee(800, scholarship);
    const over = calcEnrollmentFee(800, custom);

    // Assert
    expect(full).toMatchObject({ pct: 100, discountAmt: 800, finalFee: 0, label: 'Full Scholarship' });
    expect(over).toMatchObject({ label: 'Custom Discount', finalFee: 0 });
  });

  it('given no discount, should charge the base fee with no reason', () => {
    // Arrange / Act
    const fee = calcEnrollmentFee(500, {});

    // Assert
    expect(fee).toEqual({ id: 'none', label: 'No Discount', pct: 0, discountAmt: 0, finalFee: 500, reason: undefined });
  });
});
