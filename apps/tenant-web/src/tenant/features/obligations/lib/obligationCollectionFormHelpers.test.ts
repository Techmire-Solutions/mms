import { describe, expect, it } from "vitest";
import { validateObligationCollectionForm } from "./obligationCollectionFormHelpers";
import type { ObligationCollectionFormState } from "../components/ObligationCollectionFormFields";

function validForm(
  overrides: Partial<ObligationCollectionFormState> = {},
): ObligationCollectionFormState {
  return {
    receipt_no: "",
    received_date: "2026-09-01",
    sender_id: "c-1",
    reference_id: "",
    amount: "100.00",
    currency_id: "PKR",
    payment_mode: "Cash",
    obligation_type_id: "type-1",
    mujtahid_representative_id: "rep-1",
    received_by: "u-1",
    ...overrides,
  };
}

describe("validateObligationCollectionForm receipt number", () => {
  it("does not require a receipt number when automatic numbering is on", () => {
    const errors = validateObligationCollectionForm(validForm(), false);
    expect(errors.receipt_no).toBeUndefined();
  });

  it("requires a receipt number when automatic numbering is off", () => {
    const errors = validateObligationCollectionForm(validForm({ receipt_no: "" }), true);
    expect(errors.receipt_no).toBe("obligations.form.errors.receiptRequired");
  });

  it("accepts a non-blank receipt number when automatic numbering is off", () => {
    const errors = validateObligationCollectionForm(
      validForm({ receipt_no: "OBL-2026-00001" }),
      true,
    );
    expect(errors.receipt_no).toBeUndefined();
  });
});
