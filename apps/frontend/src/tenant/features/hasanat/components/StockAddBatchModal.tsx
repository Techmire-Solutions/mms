import React, { useState } from "react";
import { Package } from "lucide-react";
import { type Denomination, type StockBatch } from "@/lib/data/hasanatData";
import { DatePicker } from "@/components/app/DatePicker";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { UserActorSelect } from "@/tenant/components/selectors/UserActorSelect";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { FormSelectWithQuickCreate } from "@/components/app/FormPrimitives";
import { generateClientEntityId, todayISO } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { DenominationModal } from "./DenominationModal";

interface StockAddBatchModalProps {
  open: boolean;
  denoms: Denomination[];
  onClose: () => void;
  onSave: (batch: StockBatch) => void | Promise<void>;
  onDenomsChange?: (denoms: Denomination[]) => void | Promise<void>;
}

export function StockAddBatchModal({
  open,
  denoms,
  onClose,
  onSave,
  onDenomsChange,
}: StockAddBatchModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [createDenomOpen, setCreateDenomOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [data, setData] = useState<Partial<StockBatch>>({
    denominationId: denoms[0]?.id || "",
    quantity: 0,
    addedDate: todayISO(),
    addedByUserId: "",
    note: "",
  });

  const updateField = <K extends keyof StockBatch>(field: K, value: StockBatch[K]) => {
    setData((previousData: Partial<StockBatch>) => ({ ...previousData, [field]: value }));
    if (errors[field as string]) {
      setErrors((previousErrors) => {
        const next = { ...previousErrors };
        delete next[field as string];
        return next;
      });
    }
  };

  const selectedDenomination = denoms.find(
    (denomination) => denomination.id === data.denominationId,
  );

  React.useEffect(() => {
    if (open) {
      setData({
        denominationId: denoms[0]?.id || "",
        quantity: 0,
        addedDate: todayISO(),
        addedByUserId: "",
        note: "",
      });
      setErrors({});
      setSubmitError(null);
    }
  }, [open, denoms]);

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!data.denominationId) {
      newErrors.denominationId = t("common.required");
    }
    if (!data.quantity || Number(data.quantity) < 1) {
      newErrors.quantity = t("common.required");
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSubmitError(t("common.formPleaseFixErrors"));
      return;
    }

    setSubmitError(null);
    const denomination = denoms.find((candidate) => candidate.id === data.denominationId);
    setSubmitting(true);
    try {
      await onSave({
        ...data,
        id: generateClientEntityId("bat"),
        quantity: Number(data.quantity),
        remaining: Number(data.quantity),
        denominationName: denomination?.name || "",
      } as StockBatch);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={t("hasanat.stock.addBatchTitle")}
      icon={Package}
      cancelLabel={t("common.cancel")}
      saveLabel={t("hasanat.stock.addBatchAction")}
      saving={submitting}
      error={submitError || undefined}
      onSave={handleSave}
      saveDisabled={denoms.length === 0 || submitting}
      formId="stock-add-batch-modal-form"
    >
      <form
        id="stock-add-batch-modal-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (denoms.length > 0 && !submitting) void handleSave();
        }}
        className="space-y-3"
      >
        <Field
          id="batch-denom"
          label={t("hasanat.form.denomination")}
          required
          error={errors.denominationId}
        >
          <FormSelectWithQuickCreate
            id="batch-denom"
            name="denominationId"
            value={data.denominationId || ""}
            onChange={(value) => updateField("denominationId", value)}
            options={denoms
              .filter((denomination) => denomination.active)
              .map((denomination) => ({
                value: denomination.id,
                label: `${denomination.icon} ${denomination.name} (${t("hasanat.form.pointsShort", { points: denomination.points })})`,
              }))}
            canAdd={typeof onDenomsChange === "function"}
            onOpenAdd={() => setCreateDenomOpen(true)}
            addAriaLabel={t("hasanat.denominations.new")}
          />
        </Field>
        {selectedDenomination && (
          <div
            className="h-10 rounded-xl flex items-center gap-2 px-3 text-white text-sm font-semibold"
            style={{ background: selectedDenomination.color }}
          >
            <span aria-hidden="true">{selectedDenomination.icon}</span>
            <span>{selectedDenomination.name}</span>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field id="batch-qty" label={t("hasanat.form.quantity")} required error={errors.quantity}>
            <Input
              id="batch-qty"
              name="quantity"
              type="text"
              inputMode="numeric"
              className={FORM_INPUT}
              value={data.quantity || ""}
              onChange={(event) => {
                const sanitized = event.target.value.replace(/[^0-9]/g, "");
                updateField(
                  "quantity",
                  (sanitized ? Number(sanitized) : 0) as StockBatch["quantity"],
                );
              }}
              placeholder="0"
            />
          </Field>
          <Field id="add-date" label={t("hasanat.stock.date")}>
            <DatePicker
              id="add-date"
              name="addedDate"
              value={data.addedDate || ""}
              onChange={(value) => updateField("addedDate", value)}
            />
          </Field>
        </div>
        <UserActorSelect
          id="added-by"
          label={t("hasanat.stock.addedBy")}
          value={data.addedByUserId || ""}
          onChange={(id) => updateField("addedByUserId", id)}
          allowEmpty
        />
        <Field id="batch-note" label={t("hasanat.stock.note")}>
          <Input
            id="batch-note"
            name="note"
            className={FORM_INPUT}
            value={data.note || ""}
            onChange={(event) => updateField("note", event.target.value)}
            placeholder={t("hasanat.stock.notePlaceholder")}
          />
        </Field>
      </form>
      {typeof onDenomsChange === "function" ? (
        <DenominationModal
          open={createDenomOpen}
          denom={null}
          onClose={() => setCreateDenomOpen(false)}
          onSave={async (denom) => {
            await onDenomsChange([...denoms, denom]);
            updateField("denominationId", denom.id);
            setCreateDenomOpen(false);
          }}
        />
      ) : null}
    </FormModal>
  );
}
