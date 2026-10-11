import React, { useState } from "react";
import { CreditCard } from "lucide-react";
import { type Denomination } from "@/lib/data/hasanatData";
import { generateClientEntityId } from "@mms/shared";
import { FormModal } from "@/components/ui/FormModal";
import { Field } from "@/components/ui/FormPrimitives";
import { FORM_INPUT, FORM_LABEL } from "@/components/ui/formStyles";
import { DEFAULT_DENOMINATION_COLOR, getDenominationPresetColors } from "@/lib/denominationColors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/hooks/useTranslation";

const EMPTY: Denomination = {
  id: "",
  name: "",
  points: 100,
  color: DEFAULT_DENOMINATION_COLOR,
  description: "",
  icon: "⭐",
  active: true,
};
const PRESET_ICONS = ["⭐", "🌟", "✨", "💎", "👑", "🏆", "🎖️", "📿"];

export interface DenominationModalProps {
  open: boolean;
  denom: Denomination | null;
  onClose: () => void;
  onSave: (denom: Denomination) => void | Promise<void>;
}

export function DenominationModal({ open, denom, onClose, onSave }: DenominationModalProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<Denomination>(denom || { ...EMPTY });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const presetColors = getDenominationPresetColors();

  const updateField = <K extends keyof Denomination>(field: K, value: Denomination[K]) => {
    setData((previousData: Denomination) => ({ ...previousData, [field]: value }));
    if (errors[field as string]) {
      setErrors((previousErrors) => {
        const next = { ...previousErrors };
        delete next[field as string];
        return next;
      });
    }
  };

  React.useEffect(() => {
    if (open) {
      setData(denom || { ...EMPTY });
      setErrors({});
      setSubmitError(null);
    }
  }, [open, denom]);

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!data.name?.trim()) {
      newErrors.name = t("common.required");
    }
    if (!data.points || Number(data.points) < 1) {
      newErrors.points = t("common.required");
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSubmitError(t("common.formPleaseFixErrors"));
      return;
    }

    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSave({ ...data, id: denom?.id || generateClientEntityId("den") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={denom ? t("hasanat.denominations.edit") : t("hasanat.denominations.new")}
      icon={CreditCard}
      cancelLabel={t("common.cancel")}
      saveLabel={t("hasanat.denominations.save")}
      saving={submitting}
      saveDisabled={submitting}
      error={submitError || undefined}
      onSave={handleSave}
      formId="denomination-form-modal"
    >
      <form
        id="denomination-form-modal"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!submitting) void handleSave();
        }}
        className="space-y-4"
      >
        <div className="flex items-center justify-center" aria-hidden="true">
          <div
            className="w-24 h-14 rounded-xl flex items-center justify-center shadow-md text-white text-2xl"
            style={{ background: `linear-gradient(135deg, ${data.color}, ${data.color}99)` }}
          >
            {data.icon}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            id="denom-name"
            label={t("hasanat.denominations.cardName")}
            required
            error={errors.name}
          >
            <Input
              id="denom-name"
              name="name"
              className={FORM_INPUT}
              value={data.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder={t("hasanat.denominations.cardNamePlaceholder")}
            />
          </Field>
          <Field
            id="denom-pts"
            label={t("hasanat.denominations.pointsValue")}
            required
            error={errors.points}
          >
            <Input
              id="denom-pts"
              name="points"
              type="text"
              inputMode="numeric"
              className={FORM_INPUT}
              value={data.points}
              onChange={(event) => updateField("points", Number(event.target.value) || 0)}
              placeholder="100"
            />
          </Field>
        </div>
        <Field id="denom-desc" label={t("hasanat.denominations.description")}>
          <Input
            id="denom-desc"
            name="description"
            className={FORM_INPUT}
            value={data.description}
            onChange={(event) => updateField("description", event.target.value)}
            placeholder={t("hasanat.denominations.descriptionPlaceholder")}
          />
        </Field>

        <fieldset>
          <legend className={FORM_LABEL}>{t("hasanat.denominations.icon")}</legend>
          <div className="flex gap-2 flex-wrap">
            {PRESET_ICONS.map((icon) => (
              <Button
                type="button"
                aria-pressed={data.icon === icon}
                key={icon}
                onClick={() => updateField("icon", icon)}
                className={`min-h-11 min-w-11 rounded-lg text-lg flex items-center justify-center transition-all ${data.icon === icon ? "bg-primary/15 ring-2 ring-primary" : "bg-muted hover:bg-muted/80"}`}
              >
                {icon}
              </Button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={FORM_LABEL}>{t("hasanat.denominations.color")}</legend>
          <div className="flex gap-2 flex-wrap items-center">
            {Array.from(new Set(presetColors)).map((color) => (
              <Button
                type="button"
                aria-pressed={data.color === color}
                aria-label={t("hasanat.denominations.selectColor", { color })}
                key={color}
                onClick={() => updateField("color", color)}
                className={`min-h-11 min-w-11 rounded-full border-2 transition-all ${data.color === color ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ background: color }}
              />
            ))}
            <label className="sr-only" htmlFor="custom-color">
              {t("hasanat.denominations.customColor")}
            </label>
            <Input
              id="custom-color"
              name="customColor"
              type="color"
              value={data.color}
              onChange={(event) => updateField("color", event.target.value)}
              className="min-h-11 min-w-11 rounded cursor-pointer border-0 p-0"
              title={t("hasanat.denominations.customColor")}
            />
          </div>
        </fieldset>

        <div className="flex items-center gap-2.5">
          <Checkbox
            id="denom-active"
            name="active"
            checked={data.active}
            onCheckedChange={(checked) => updateField("active", !!checked)}
            className="cursor-pointer"
          />
          <label
            htmlFor="denom-active"
            className="cursor-pointer text-sm font-medium text-foreground select-none"
          >
            {t("hasanat.status.active")}
          </label>
        </div>
      </form>
    </FormModal>
  );
}
