import { useRef, useState } from "react";
import { Gift } from "lucide-react";
import { type Redemption, type Distribution } from "@/lib/data/hasanatData";
import { DatePicker } from "@/components/app/DatePicker";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { UserActorSelect } from "@/tenant/components/selectors/UserActorSelect";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { generateClientEntityId, redeemCardBodySchema, todayISO } from "@mms/shared";
import { mapZodFormErrors } from "@/lib/forms/mapZodFormErrors";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/app/FormSelect";

interface RedeemModalProps {
  open: boolean;
  distributions: Distribution[];
  onClose: () => void;
  /** `clientRequestId` lets a retried redeem replay the original ledger row instead of 409-ing. */
  onSave: (redemption: Redemption & { clientRequestId?: string }) => void | Promise<void>;
}

export function RedeemModal({ open, distributions, onClose, onSave }: RedeemModalProps) {
  const { t } = useTranslation();
  const activeDistributions = distributions.filter(
    (distribution) => distribution.status === "active",
  );
  const [approvedByName, setApprovedByName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  /** Synchronous guard: two events in the same frame both read `submitting === false`. */
  const submittingRef = useRef(false);
  const [requestId, setRequestId] = useState<string>(() => generateClientEntityId("redreq"));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [data, setData] = useState<Partial<Redemption>>({
    distributionId: activeDistributions[0]?.id || "",
    reward: "",
    // Seeded from the card's stamped value; the field stays read-only.
    pointsUsed: activeDistributions[0]?.pointsSnapshot ?? 0,
    date: todayISO(),
    approvedByUserId: "",
  });
  const [previousOpen, setPreviousOpen] = useState(open);
  const [previousDistributions, setPreviousDistributions] = useState(distributions);

  const updateField = <K extends keyof Redemption>(field: K, value: Redemption[K]) => {
    setData((previousData: Partial<Redemption>) => ({ ...previousData, [field]: value }));
    if (errors[field as string]) {
      setErrors((previousErrors) => {
        const next = { ...previousErrors };
        delete next[field as string];
        return next;
      });
    }
  };

  const selectedDistribution = activeDistributions.find(
    (distribution) => distribution.id === data.distributionId,
  );

  // Re-seed the draft during render when the modal is (re)opened or the source list changes.
  if (previousOpen !== open || previousDistributions !== distributions) {
    setPreviousOpen(open);
    setPreviousDistributions(distributions);
    if (open) {
      const active = distributions.filter((distribution) => distribution.status === "active");
      setData({
        distributionId: active[0]?.id || "",
        reward: "",
        // The card is burned at its stamped value — prefill it so the client cannot send a partial.
        pointsUsed: active[0]?.pointsSnapshot ?? 0,
        date: todayISO(),
        approvedByUserId: "",
      });
      setApprovedByName("");
      setErrors({});
      setSubmitError(null);
      // One idempotency key per opened draft: a retried redeem replays the same ledger row.
      setRequestId(generateClientEntityId("redreq"));
    }
  }

  const handleSave = async () => {
    if (submittingRef.current) return;

    const earlyErrors: Record<string, string> = {};
    if (!data.distributionId) {
      // The JSX renders `errors.distributionId`; the old handler wrote `denominationId`, so a
      // missing card selection never showed its error.
      earlyErrors.distributionId = t("common.required");
    }

    setSubmitError(null);
    const approvedBy =
      approvedByName || (data.approvedByUserId ? `User #${data.approvedByUserId}` : "");
    // The shared redeem contract owns the bounds (positive integer points, ISO date).
    const parsed = redeemCardBodySchema.safeParse({
      reward: data.reward ?? "",
      pointsUsed: Number(data.pointsUsed ?? 0),
      date: data.date ?? "",
      approvedByUserId: data.approvedByUserId || null,
      approvedBy: approvedBy || null,
      clientRequestId: requestId,
    });
    if (Object.keys(earlyErrors).length > 0 || !parsed.success) {
      setErrors({
        ...earlyErrors,
        ...(parsed.success ? {} : mapZodFormErrors(parsed.error, (message) => message)),
      });
      setSubmitError(t("common.formPleaseFixErrors"));
      return;
    }

    const payload: Redemption & { clientRequestId: string } = {
      id: generateClientEntityId("red"),
      distributionId: String(data.distributionId),
      studentId: selectedDistribution?.recipientStudentId ?? null,
      studentName: selectedDistribution?.recipientName || "",
      reward: parsed.data.reward,
      pointsUsed: parsed.data.pointsUsed,
      kind: "redeem",
      reversalOfId: null,
      date: parsed.data.date,
      approvedByUserId: parsed.data.approvedByUserId ?? null,
      approvedBy: parsed.data.approvedBy ?? (approvedBy || null),
      clientRequestId: requestId,
    };

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onSave(payload);
    } catch (error: unknown) {
      // Already redeemed / points above the card value are 409s from the atomic endpoint.
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
      title={t("hasanat.recordRedemption")}
      icon={Gift}
      cancelLabel={t("common.cancel")}
      saveLabel={t("common.save")}
      saving={submitting}
      error={submitError || undefined}
      onSave={handleSave}
      saveDisabled={activeDistributions.length === 0 || submitting}
      formId="redeem-modal-form"
    >
      <form
        id="redeem-modal-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (activeDistributions.length > 0 && !submitting) void handleSave();
        }}
        className="space-y-4"
      >
        <Field
          id="dist-sel"
          label={t("hasanat.fieldRecipient")}
          required
          error={errors.distributionId}
        >
          <FormSelect
            id="dist-sel"
            name="distributionId"
            value={data.distributionId || ""}
            onChange={(value) => {
              const card = activeDistributions.find((row) => row.id === value);
              updateField("distributionId", value);
              updateField("pointsUsed", card?.pointsSnapshot ?? 0);
            }}
            options={activeDistributions.map((distribution) => ({
              value: distribution.id,
              label: `${distribution.recipientName} — ${distribution.denominationName} × ${distribution.quantity}`,
            }))}
          />
        </Field>
        {selectedDistribution && (
          <p className="text-xs text-muted-foreground mt-1 m-0">{selectedDistribution.reason}</p>
        )}
        <Field
          id="reward-given"
          errorId="reward-error"
          label={t("hasanat.columns.redemption.reward")}
          required
          error={errors.reward}
        >
          <Input
            id="reward-given"
            name="reward"
            className={FORM_INPUT}
            value={data.reward || ""}
            onChange={(event) => updateField("reward", event.target.value)}
            placeholder={t("hasanat.rewardPlaceholder")}
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            id="pts-used"
            label={t("hasanat.columns.redemption.pointsUsed")}
            required
            error={errors.pointsUsed}
          >
            <Input
              id="pts-used"
              name="pointsUsed"
              type="text"
              inputMode="numeric"
              className={FORM_INPUT}
              value={data.pointsUsed || ""}
              readOnly
              aria-readonly="true"
              placeholder="0"
            />
          </Field>
          <Field id="red-date" label={t("hasanat.columns.redemption.date")}>
            <DatePicker
              id="red-date"
              name="date"
              value={data.date || ""}
              onChange={(value) => updateField("date", value)}
            />
          </Field>
        </div>
        <UserActorSelect
          id="approved-by"
          label={t("hasanat.columns.redemption.approvedBy")}
          value={data.approvedByUserId || ""}
          onChange={(id, name) => {
            updateField("approvedByUserId", id);
            setApprovedByName(name ?? "");
          }}
          allowEmpty
        />
      </form>
    </FormModal>
  );
}
