import { useState } from "react";
import { Star } from "lucide-react";

import { FormModal } from "@/components/app/FormModal";
import { useHasanatConfig } from "@/hooks/useStandardModuleConfig";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { type Denomination, type Distribution, type StockBatch } from "@/lib/data/hasanatData";
import { generateClientEntityId, todayISO } from "@mms/shared";
import { DistributeModalFields } from "@/tenant/features/hasanat/components/DistributeModalFields";

const EMPTY_DIST: Partial<Distribution> = {
  denominationId: "",
  recipientType: "student",
  recipientStudentId: "",
  recipientFacultyId: "",
  recipientClass: "",
  quantity: 1,
  reason: "",
  issuedDate: todayISO(),
  issuedByUserId: "",
};

export interface DistributeModalProps {
  open: boolean;
  denoms: Denomination[];
  batches: StockBatch[];
  onClose: () => void;
  onSave: (dist: Distribution) => void | Promise<void>;
  onDenomsChange?: (denoms: Denomination[]) => Promise<void> | void;
}

export function DistributeModal({
  open,
  denoms,
  batches,
  onClose,
  onSave,
  onDenomsChange,
}: DistributeModalProps) {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [data, setData] = useState<Partial<Distribution>>(() => ({
    ...EMPTY_DIST,
    denominationId: denoms[0]?.id || "",
    issuedDate: todayISO(),
    issuedByUserId: authUser?.id || "",
  }));
  const [previousOpen, setPreviousOpen] = useState(open);
  const [previousDenoms, setPreviousDenoms] = useState(denoms);
  const [previousIssuedByUserId, setPreviousIssuedByUserId] = useState(authUser?.id);

  const updateField = (field: string, value: unknown) => {
    setData(
      (previousData: Partial<Distribution>) =>
        ({ ...previousData, [field]: value }) as Partial<Distribution>,
    );
    if (errors[field]) {
      setErrors((previousErrors) => {
        const next = { ...previousErrors };
        delete next[field];
        return next;
      });
    }
  };

  // Re-seed the draft during render when the modal is (re)opened or its catalog/actor inputs change.
  if (
    previousOpen !== open ||
    previousDenoms !== denoms ||
    previousIssuedByUserId !== authUser?.id
  ) {
    setPreviousOpen(open);
    setPreviousDenoms(denoms);
    setPreviousIssuedByUserId(authUser?.id);
    if (open) {
      setData({
        ...EMPTY_DIST,
        denominationId: denoms[0]?.id || "",
        issuedDate: todayISO(),
        issuedByUserId: authUser?.id || "",
      });
      setErrors({});
      setSubmitError(null);
    }
  }

  const selectedDenomination = denoms.find(
    (denomination) => denomination.id === data.denominationId,
  );
  const availableBatches = batches.filter(
    (batch) => batch.denominationId === data.denominationId && batch.remaining > 0,
  );
  const totalAvailable = availableBatches.reduce(
    (sum: number, batch: StockBatch) => sum + batch.remaining,
    0,
  );

  const { orderedFields, isFieldEnabled, isFieldRequired } = useHasanatConfig();

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!data.denominationId) {
      newErrors.denominationId = t("common.required");
    }
    const recipientId =
      data.recipientType === "faculty" ? data.recipientFacultyId : data.recipientStudentId;
    if (!recipientId) {
      newErrors.recipientName = t("common.required");
    }
    if (!data.quantity || Number(data.quantity) < 1) {
      newErrors.quantity = t("common.required");
    } else if (Number(data.quantity) > totalAvailable) {
      newErrors.quantity = t("common.required");
    }
    if (!data.issuedDate) {
      newErrors.issuedDate = t("common.required");
    }
    if (!data.reason?.trim()) {
      newErrors.reason = t("common.required");
    }

    for (const field of orderedFields) {
      if (!isFieldEnabled(field.id) || !isFieldRequired(field.id)) continue;
      if (field.id === "recipientClass" && !data.recipientClass?.trim()) {
        newErrors.recipientClass = t("common.required");
      }
      if (field.id === "issuedBy" && !data.issuedByUserId && !authUser?.id) {
        newErrors.issuedBy = t("common.required");
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSubmitError(t("common.formPleaseFixErrors"));
      return;
    }

    setSubmitError(null);
    const denomination = denoms.find((candidate) => candidate.id === data.denominationId);
    const batch = batches.find(
      (candidate) => candidate.denominationId === data.denominationId && candidate.remaining > 0,
    );
    const payload: Distribution = {
      ...data,
      id: generateClientEntityId("dist"),
      denominationName: denomination?.name || "",
      batchId: batch?.id || "",
      status: "active",
      recipientName: "",
      issuedByUserId: data.issuedByUserId || authUser?.id || "",
    } as Distribution;
    if (data.recipientType === "faculty") {
      delete payload.recipientStudentId;
    } else {
      delete payload.recipientFacultyId;
    }
    setSubmitting(true);
    try {
      await onSave(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={t("hasanat.distributeCards")}
      icon={Star}
      cancelLabel={t("common.cancel")}
      saveLabel={t("hasanat.form.distributeAction")}
      saving={submitting}
      error={submitError || undefined}
      onSave={handleSave}
      saveDisabled={totalAvailable === 0 || submitting}
      formId="distribute-modal-form"
    >
      <form
        id="distribute-modal-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (totalAvailable > 0 && !submitting) void handleSave();
        }}
      >
        <DistributeModalFields
          denoms={denoms}
          data={data}
          selectedDenomination={selectedDenomination}
          totalAvailable={totalAvailable}
          setData={setData}
          updateField={updateField}
          errors={errors}
          onDenomsChange={onDenomsChange}
        />
      </form>
    </FormModal>
  );
}
