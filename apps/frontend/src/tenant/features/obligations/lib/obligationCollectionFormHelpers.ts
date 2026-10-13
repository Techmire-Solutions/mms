import type {
  Mujtahid,
  MujtahidRep,
  ObligationCollection,
  WakalaType,
} from "@/lib/data/obligationsData";
import { generateClientEntityId, type AppTranslationKey } from "@mms/shared";
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

export function validateObligationCollectionForm(
  form: ObligationCollectionFormState,
): Partial<Record<keyof ObligationCollectionFormState, AppTranslationKey>> {
  const nextErrors: Partial<Record<keyof ObligationCollectionFormState, AppTranslationKey>> = {};
  if (!form.sender_id) nextErrors.sender_id = "obligations.form.errors.senderRequired";
  if (!form.amount || parseFloat(form.amount) <= 0)
    nextErrors.amount = "obligations.form.errors.amountRequired";
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
    amount: parseFloat(form.amount),
    reference_id: form.reference_id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as ObligationCollection;
}
