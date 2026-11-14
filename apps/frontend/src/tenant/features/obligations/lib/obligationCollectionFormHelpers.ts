import type {
  Mujtahid,
  MujtahidRep,
  ObligationCollection,
  WakalaType,
} from "@/lib/data/obligationsData";
import { generateClientEntityId, roundMoneyAmount, type AppTranslationKey } from "@mms/shared";
import type { ObligationCollectionFormState } from "../components/ObligationCollectionFormFields";

export function eligibleRepsForType(
  obligationTypeId: string,
  wakalaTypes: WakalaType[],
  reps: MujtahidRep[],
): MujtahidRep[] {
  if (!obligationTypeId) return reps;
  const eligibleRepIds = new Set(
    wakalaTypes
      .filter((wakalaType) => wakalaType.obligation_type_id === obligationTypeId)
      .map((wakalaType) => wakalaType.mujtahid_representative_id),
  );
  return reps.filter((rep) => eligibleRepIds.has(rep.id));
}

export function resolveMujtahidForRep(
  repId: string,
  reps: MujtahidRep[],
  mujtahids: Mujtahid[],
): Mujtahid | null {
  const rep = reps.find((candidateRep) => candidateRep.id === repId);
  return rep ? (mujtahids.find((mujtahid) => mujtahid.id === rep.mujtahid_id) ?? null) : null;
}

/** A positive amount text with at most two decimals — the DTO and `numeric(12,2)` scale. */
const AMOUNT_TEXT_RE = /^\d{1,12}(\.\d{1,2})?$/;
/** A numeric text that carries more than two decimals (the scale error, not a missing value). */
const AMOUNT_TEXT_EXTRA_DECIMALS_RE = /^\d{1,12}\.\d{3,}$/;

/** True when the text is numerically zero, decided on the string so no float is involved. */
function isZeroAmountText(text: string): boolean {
  return text.replace(".", "").replace(/0/g, "") === "";
}

export function validateObligationCollectionForm(
  form: ObligationCollectionFormState,
): Partial<Record<keyof ObligationCollectionFormState, AppTranslationKey>> {
  const nextErrors: Partial<Record<keyof ObligationCollectionFormState, AppTranslationKey>> = {};
  if (!form.sender_id) nextErrors.sender_id = "obligations.form.errors.senderRequired";
  // The amount is judged as text: `parseFloat` on a money value is banned by check:money-safety
  // (it rounds beyond 2^53 and silently accepts "10.12abc"), and the DTO rejects an amount a
  // numeric(12,2) column would re-round, so both cases are caught here with an inline message
  // instead of letting the save fail as a 400.
  const amountText = (form.amount ?? "").trim();
  if (!amountText || isZeroAmountText(amountText)) {
    nextErrors.amount = "obligations.form.errors.amountRequired";
  } else if (AMOUNT_TEXT_EXTRA_DECIMALS_RE.test(amountText)) {
    nextErrors.amount = "obligations.form.errors.amountScale";
  } else if (!AMOUNT_TEXT_RE.test(amountText)) {
    nextErrors.amount = "obligations.form.errors.amountRequired";
  }
  if (!form.received_date) nextErrors.received_date = "obligations.form.errors.dateRequired";
  if (!form.obligation_type_id)
    nextErrors.obligation_type_id = "obligations.form.errors.typeRequired";
  if (!form.mujtahid_representative_id) {
    nextErrors.mujtahid_representative_id = "obligations.form.errors.repRequired";
  }
  if (!form.received_by) nextErrors.received_by = "obligations.form.errors.receivedByRequired";
  if (!form.currency_id) nextErrors.currency_id = "obligations.form.errors.currencyRequired";
  return nextErrors;
}

export function toObligationCollectionPayload(
  form: ObligationCollectionFormState,
): ObligationCollection {
  return {
    ...form,
    id: generateClientEntityId("oc"),
    // Exact decimal → 2 dp through the shared invariant helper; the validator has already
    // established that the text is a positive amount with at most two decimals.
    amount: roundMoneyAmount(form.amount),
    reference_id: form.reference_id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as ObligationCollection;
}
