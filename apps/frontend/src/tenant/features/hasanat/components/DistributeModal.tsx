import { useRef, useState } from "react";
import { Star } from "lucide-react";

import { FormModal } from "@/components/app/FormModal";
import { useHasanatConfig } from "@/hooks/useStandardModuleConfig";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { type Denomination, type Distribution, type StockBatch } from "@/lib/data/hasanatData";
import { generateClientEntityId, hasanatDistributionCreateSchema, todayISO } from "@mms/shared";
import { mapZodFormErrors } from "@/lib/forms/mapZodFormErrors";
import { DistributeModalFields } from "@/tenant/features/hasanat/components/DistributeModalFields";
import type { DistributionFieldUpdate } from "@/tenant/features/hasanat/components/DistributeRecipientFields";

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
  /** `clientRequestId` rides along so a replayed submit returns the original card, not a second one. */
  onSave: (dist: Distribution & { clientRequestId?: string }) => void | Promise<void>;
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
  /** Synchronous guard: two events in the same frame both read `submitting === false`. */
  const submittingRef = useRef(false);
  const [requestId, setRequestId] = useState<string>(() => generateClientEntityId("hdreq"));
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

  const updateField: DistributionFieldUpdate = (field, value) => {
    setData((previousData: Partial<Distribution>) => ({ ...previousData, [field]: value }));
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
      // One idempotency key per opened draft: a retried submit replays instead of awarding twice.
      setRequestId(generateClientEntityId("hdreq"));
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
    if (submittingRef.current) return;

    // Cheap, domain-specific rules first: they carry copy the generic write schema cannot.
    const earlyErrors: Record<string, string> = {};
    const recipientId =
      data.recipientType === "faculty" ? data.recipientFacultyId : data.recipientStudentId;
    if (!recipientId) {
      earlyErrors.recipientName = t("common.required");
    }
    if (totalAvailable === 0) {
      earlyErrors.quantity = t("hasanat.form.noStockAvailable");
    } else if (!data.quantity || Number(data.quantity) < 1) {
      earlyErrors.quantity = t("common.required");
    } else if (Number(data.quantity) > totalAvailable) {
      earlyErrors.quantity = t("hasanat.form.quantityExceedsAvailable", {
        available: totalAvailable,
      });
    }
    for (const field of orderedFields) {
      if (!isFieldEnabled(field.id) || !isFieldRequired(field.id)) continue;
      if (field.id === "recipientClass" && !data.recipientClass?.trim()) {
        earlyErrors.recipientClass = t("common.required");
      }
      if (field.id === "reason" && !data.reason?.trim()) {
        earlyErrors.reason = t("common.required");
      }
      if (field.id === "issuedBy" && !data.issuedByUserId && !authUser?.id) {
        earlyErrors.issuedBy = t("common.required");
      }
    }
    if (Object.keys(earlyErrors).length > 0) {
      setErrors(earlyErrors);
      setSubmitError(t("common.formPleaseFixErrors"));
      return;
    }

    setSubmitError(null);
    const denomination = denoms.find((candidate) => candidate.id === data.denominationId);
    const batch = batches.find(
      (candidate) => candidate.denominationId === data.denominationId && candidate.remaining > 0,
    );

    // The shared write contract is the single source of validation: types, bounds, dates and the
    // recipient exclusivity rule all come from `hasanatDistributionCreateSchema`.
    const parsed = hasanatDistributionCreateSchema.safeParse({
      id: generateClientEntityId("dist"),
      batchId: batch?.id ?? "",
      denominationId: data.denominationId ?? "",
      denominationName: denomination?.name ?? "",
      recipientType: data.recipientType ?? "student",
      recipientStudentId:
        data.recipientType === "faculty" ? null : (data.recipientStudentId ?? null),
      recipientFacultyId:
        data.recipientType === "faculty" ? (data.recipientFacultyId ?? null) : null,
      recipientName: data.recipientName ?? "",
      recipientClass: data.recipientClass ?? "",
      classId: data.classId ?? null,
      sessionId: data.sessionId ?? null,
      quantity: Number(data.quantity),
      expiresOn: data.expiresOn ?? null,
      reason: data.reason ?? "",
      issuedDate: data.issuedDate ?? "",
      issuedByUserId: data.issuedByUserId || authUser?.id || null,
      issuedBy: data.issuedBy ?? null,
      clientRequestId: requestId,
    });
    if (!parsed.success) {
      const fieldErrors = mapZodFormErrors(parsed.error, (message) => message);
      // Map contract paths onto the field ids this form renders.
      const recipientError = fieldErrors.recipientStudentId ?? fieldErrors.recipientFacultyId;
      setErrors({
        ...fieldErrors,
        ...(recipientError ? { recipientName: recipientError } : {}),
        ...(fieldErrors.batchId ? { denominationId: fieldErrors.batchId } : {}),
      });
      setSubmitError(t("common.formPleaseFixErrors"));
      return;
    }

    const payload = {
      ...parsed.data,
      id: parsed.data.id ?? generateClientEntityId("dist"),
      clientRequestId: requestId,
      status: "active" as const,
    };

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onSave(payload);
    } catch (error: unknown) {
      // The DB rejects an over-issue (`hasanat_batches_remaining_chk`) and the API answers 409;
      // show that message instead of dropping the failure.
      setSubmitError(error instanceof Error ? error.message : t("common.formPleaseFixErrors"));
    } finally {
      submittingRef.current = false;
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
