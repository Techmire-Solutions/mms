import { useState } from "react";
import { Receipt } from "lucide-react";
import {
  generateReceiptNo,
  type ObligationCollection,
  type ObligationType,
  type WakalaType,
  type MujtahidRep,
  type Mujtahid,
} from "@/lib/data/obligationsData";
import { todayISO, type AppTranslationKey } from "@mms/shared";
import { FormModal } from "@/components/app/FormModal";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { calculateKeyedUnitsCompleteness } from "@/lib/formCompleteness";
import {
  ObligationCollectionFormFields,
  type ObligationCollectionFormState,
} from "@/tenant/features/obligations/components/ObligationCollectionFormFields";
import { WakalaQuickCreateModals } from "@/tenant/features/obligations/components/wakala/WakalaQuickCreateModals";
import { useObligationCollectionCatalogQuickCreate } from "@/tenant/features/obligations/hooks/useObligationCollectionCatalogQuickCreate";
import {
  eligibleRepsForType,
  resolveMujtahidForRep,
  toObligationCollectionPayload,
  validateObligationCollectionForm,
} from "@/tenant/features/obligations/lib/obligationCollectionFormHelpers";
import { useObligationsSettings } from "@/tenant/features/obligations/hooks/useObligationsSettings";

const EMPTY: ObligationCollectionFormState = {
  receipt_no: "",
  received_date: todayISO(),
  sender_id: "",
  reference_id: "",
  amount: "",
  currency_id: "cur1",
  payment_mode: "Cash",
  obligation_type_id: "",
  mujtahid_representative_id: "",
  received_by: "",
};

export interface ObligationCollectionFormProps {
  onClose: () => void;
  onSave: (collection: ObligationCollection) => void | Promise<void>;
  obligationTypes: ObligationType[];
  wakalaTypes: WakalaType[];
  reps: MujtahidRep[];
  mujtahids: Mujtahid[];
  existingCollections: ObligationCollection[];
  onChangeTypes?: (types: ObligationType[]) => Promise<void> | void;
  onChangeMujtahids?: (mujtahids: Mujtahid[]) => Promise<void> | void;
  onChangeReps?: (reps: MujtahidRep[]) => Promise<void> | void;
  onChangeWakala?: (wakala: WakalaType[]) => Promise<void> | void;
}

export function ObligationCollectionForm({
  onClose,
  onSave,
  obligationTypes,
  wakalaTypes,
  reps,
  mujtahids,
  existingCollections,
  onChangeTypes,
  onChangeMujtahids,
  onChangeReps,
  onChangeWakala,
}: ObligationCollectionFormProps) {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const { settings } = useObligationsSettings();
  const [form, setForm] = useState<ObligationCollectionFormState>({
    ...EMPTY,
    receipt_no: generateReceiptNo(existingCollections, settings),
    received_by: authUser?.id || "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof ObligationCollectionFormState, AppTranslationKey>>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [previousObligationTypeId, setPreviousObligationTypeId] = useState(form.obligation_type_id);

  const catalogCreate = useObligationCollectionCatalogQuickCreate({
    obligationTypes,
    mujtahids,
    reps,
    wakalaTypes,
    selectedObligationTypeId: form.obligation_type_id,
    onChangeTypes,
    onChangeMujtahids,
    onChangeReps,
    onChangeWakala,
    onSelectType: (obligationTypeId) =>
      setForm((prev) => ({
        ...prev,
        obligation_type_id: obligationTypeId,
        mujtahid_representative_id: "",
      })),
    onSelectRep: (repId) => setForm((prev) => ({ ...prev, mujtahid_representative_id: repId })),
  });

  const completeness = (() =>
    calculateKeyedUnitsCompleteness(form, [
      { key: "received_date" },
      { key: "sender_id" },
      { key: "amount" },
      { key: "payment_mode" },
      { key: "obligation_type_id" },
      { key: "mujtahid_representative_id" },
      { key: "received_by" },
    ]))();

  const eligibleReps = eligibleRepsForType(form.obligation_type_id, wakalaTypes, reps);

  // A new obligation type invalidates the chosen representative - clear it during render.
  if (previousObligationTypeId !== form.obligation_type_id) {
    setPreviousObligationTypeId(form.obligation_type_id);
    if (form.obligation_type_id) {
      setForm((currentForm) => ({ ...currentForm, mujtahid_representative_id: "" }));
    }
  }

  const handleSave = async (): Promise<void> => {
    const validationErrors = validateObligationCollectionForm(form);
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }
    setSubmitting(true);
    try {
      await onSave(toObligationCollectionPayload(form));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedRep = reps.find((rep) => rep.id === form.mujtahid_representative_id);
  const selectedMujtahid = selectedRep
    ? resolveMujtahidForRep(selectedRep.id, reps, mujtahids)
    : null;
  const errorMessages = Object.values(errors).map((key) => t(key));
  const validationErrors = validateObligationCollectionForm(form);

  return (
    <>
      <FormModal
        open={!catalogCreate.isChildModalOpen}
        onClose={onClose}
        title={t("obligations.newCollection")}
        icon={Receipt}
        progress={completeness}
        progressLabel={t("common.formProgress")}
        cancelLabel={t("common.cancel")}
        saveLabel={t("obligations.form.save")}
        onSave={handleSave}
        saving={submitting}
        saveDisabled={Object.keys(validationErrors).length > 0}
        error={errorMessages}
        formId="obligation-collection-form"
      >
        <form
          id="obligation-collection-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (Object.keys(validationErrors).length === 0 && !submitting) {
              void handleSave();
            }
          }}
        >
          <ObligationCollectionFormFields
            form={form}
            setForm={setForm}
            errors={errors}
            obligationTypes={obligationTypes}
            eligibleReps={eligibleReps}
            getMujtahid={(repId) => resolveMujtahidForRep(repId, reps, mujtahids)}
            selectedMujtahid={selectedMujtahid}
            canAddType={catalogCreate.canAddType}
            canAddRep={catalogCreate.canAddRep}
            onOpenAddType={catalogCreate.openAddType}
            onOpenAddRep={catalogCreate.openAddRep}
          />
        </form>
      </FormModal>

      <WakalaQuickCreateModals
        isAddMujtahidOpen={catalogCreate.isAddMujtahidOpen}
        onCloseAddMujtahid={catalogCreate.closeAddMujtahid}
        onSaveMujtahid={catalogCreate.handleSaveMujtahid}
        isAddRepOpen={catalogCreate.isAddRepOpen}
        onCloseAddRep={catalogCreate.closeAddRep}
        onSaveRep={catalogCreate.handleSaveRep}
        isAddObTypeOpen={catalogCreate.isAddObTypeOpen}
        onCloseAddObType={catalogCreate.closeAddObType}
        onSaveObType={catalogCreate.handleSaveObType}
      />
    </>
  );
}
