import React, { useState } from "react";
import { Gift } from "lucide-react";
import { type Redemption, type Distribution } from "@/lib/data/hasanatData";
import { DatePicker } from "@/components/app/DatePicker";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { UserActorSelect } from "@/tenant/components/selectors/UserActorSelect";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { generateClientEntityId, todayISO } from "@mms/shared";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/app/FormSelect";

interface RedeemModalProps {
  open: boolean;
  distributions: Distribution[];
  onClose: () => void;
  onSave: (redemption: Redemption) => void | Promise<void>;
}

export function RedeemModal({ open, distributions, onClose, onSave }: RedeemModalProps) {
  const { t } = useTranslation();
  const activeDistributions = distributions.filter(
    (distribution) => distribution.status === "active",
  );
  const [approvedByName, setApprovedByName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [data, setData] = useState<Partial<Redemption>>({
    distributionId: activeDistributions[0]?.id || "",
    reward: "",
    pointsUsed: 0,
    date: todayISO(),
    approvedByUserId: "",
  });

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

  React.useEffect(() => {
    if (open) {
      const active = distributions.filter((distribution) => distribution.status === "active");
      setData({
        distributionId: active[0]?.id || "",
        reward: "",
        pointsUsed: 0,
        date: todayISO(),
        approvedByUserId: "",
      });
      setApprovedByName("");
      setErrors({});
      setSubmitError(null);
    }
  }, [open, distributions]);

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!data.distributionId) {
      newErrors.denominationId = t("common.required");
    }
    if (!data.reward?.trim()) {
      newErrors.reward = t("common.required");
    }
    if (!data.pointsUsed || Number(data.pointsUsed) < 1) {
      newErrors.pointsUsed = t("common.required");
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSubmitError(t("common.formPleaseFixErrors"));
      return;
    }

    setSubmitError(null);
    const approvedBy =
      approvedByName || (data.approvedByUserId ? `User #${data.approvedByUserId}` : "");
    setSubmitting(true);
    try {
      await onSave({
        ...data,
        id: generateClientEntityId("red"),
        pointsUsed: Number(data.pointsUsed),
        studentName: selectedDistribution?.recipientName || "",
        approvedBy,
      } as Redemption);
    } finally {
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
            onChange={(value) => updateField("distributionId", value)}
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
              onChange={(event) => {
                const sanitized = event.target.value.replace(/[^0-9]/g, "");
                updateField(
                  "pointsUsed",
                  (sanitized ? Number(sanitized) : 0) as Redemption["pointsUsed"],
                );
              }}
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
