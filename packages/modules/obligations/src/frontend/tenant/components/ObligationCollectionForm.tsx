import { translateApiMessage } from "@mms/fe-core/forms/translateValidationMessage";
import { useRef, useState } from "react";
import { Receipt } from "lucide-react";
import {
  type ObligationCollection,
  type ObligationType,
  type WakalaType,
  type MujtahidRep,
  type Mujtahid,
} from "../lib/obligationsData";
import { todayISO, type AppTranslationKey } from "@mms/contracts";
import { FormModal } from "@mms/fe-core/components/FormModal";
import { useTranslation } from "@mms/fe-core/i18n";
import { mapApiFormError } from "@mms/fe-core/forms/serverFormErrors";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import { calculateKeyedUnitsCompleteness } from "../lib/formCompleteness";
import {
  ObligationCollectionFormFields,
  type ObligationCollectionFormState,
} from "./ObligationCollectionFormFields";
import { WakalaQuickCreateModals } from "./wakala/WakalaQuickCreateModals";
import { useObligationCollectionCatalogQuickCreate } from "../hooks/useObligationCollectionCatalogQuickCreate";
import {
  eligibleRepsForType,
  resolveMujtahidForRep,
  toObligationCollectionPayload,
  validateObligationCollectionForm,
} from "../lib/obligationCollectionFormHelpers";
import { useObligationsSettings } from "../hooks/useObligationsSettings";

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
  onChangeTypes,
  onChangeMujtahids,
  onChangeReps,
  onChangeWakala,
}: ObligationCollectionFormProps) {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const { settings } = useObligationsSettings();
  const autoGenerate = settings.autoGenerateReceipt !== false;
  const [form, setForm] = useState<ObligationCollectionFormState>({
    ...EMPTY,
    receipt_no: "",
    received_by: authUser?.id || "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof ObligationCollectionFormState, AppTranslationKey>>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  // `submitting` drives the button label but only applies on the next render, so two clicks in the
  // same tick both passed `!submitting` and could create the receipt twice. The ref is the lock.
  const inFlightRef = useRef(false);
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
    onSelectType: (obligationTypeId: any) =>
      setForm((prev: any) => ({
        ...prev,
        obligation_type_id: obligationTypeId,
        mujtahid_representative_id: "",
      })),
    onSelectRep: (repId: any) =>
      setForm((prev: any) => ({ ...prev, mujtahid_representative_id: repId })),
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
      setForm((currentForm: any) => ({ ...currentForm, mujtahid_representative_id: "" }));
    }
  }

  const handleSave = async (): Promise<void> => {
    const validationErrors = validateObligationCollectionForm(form, !autoGenerate);
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitting(true);
    setServerError(null);
    try {
      await onSave(toObligationCollectionPayload(form));
    } catch (error) {
      setServerError(
        mapApiFormError(error, (message: any) => translateApiMessage(message, t)).message ??
          t("common.formPleaseFixErrors"),
      );
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const selectedRep = reps.find((rep: any) => rep.id === form.mujtahid_representative_id);
  const selectedMujtahid = selectedRep
    ? resolveMujtahidForRep(selectedRep.id, reps, mujtahids)
    : null;
  const errorMessages = [
    ...Object.values(errors).map((key: any) => t(key)),
    ...(serverError ? [serverError] : []),
  ];

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
        saveDisabled={submitting}
        error={errorMessages}
        formId="obligation-collection-form"
      >
        <form
          id="obligation-collection-form"
          noValidate
          onSubmit={(e: any) => {
            e.preventDefault();
            // Always attempt the save so incomplete fields get their inline errors
            // instead of a permanently disabled footer Save.
            if (!submitting && !inFlightRef.current) void handleSave();
          }}
        >
          <ObligationCollectionFormFields
            form={form}
            setForm={setForm}
            errors={errors}
            autoGenerate={autoGenerate}
            obligationTypes={obligationTypes}
            eligibleReps={eligibleReps}
            getMujtahid={(repId: any) => resolveMujtahidForRep(repId, reps, mujtahids)}
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
