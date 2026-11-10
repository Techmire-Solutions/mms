import { useRef, useState } from "react";
import { CreditCard } from "lucide-react";
import { type Denomination } from "@/lib/data/hasanatData";
import { generateClientEntityId, hasanatDenomCreateSchema } from "@mms/shared";
import { mapZodFormErrors } from "@/lib/forms/mapZodFormErrors";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { FORM_INPUT, FORM_LABEL } from "@/components/ui/formStyles";
import {
  DEFAULT_DENOMINATION_COLOR,
  getDenominationPresetColors,
} from "@/lib/ui/denominationColors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckboxField } from "@/components/ui/checkbox";
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
  /** Sibling denominations — used to reject a duplicate name (imports resolve deeds by name). */
  existingDenoms?: readonly Denomination[];
  onClose: () => void;
  onSave: (denom: Denomination) => void | Promise<void>;
}

export function DenominationModal({
  open,
  denom,
  existingDenoms = [],
  onClose,
  onSave,
}: DenominationModalProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<Denomination>(denom || { ...EMPTY });
  const [submitting, setSubmitting] = useState(false);
  /** Synchronous guard: two events in the same frame both read `submitting === false`. */
  const submittingRef = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [previousOpen, setPreviousOpen] = useState(open);
  const [previousDenom, setPreviousDenom] = useState(denom);
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

  // Re-seed the draft during render when the modal is (re)opened for a different card.
  if (previousOpen !== open || previousDenom !== denom) {
    setPreviousOpen(open);
    setPreviousDenom(denom);
    if (open) {
      setData(denom || { ...EMPTY });
      setErrors({});
      setSubmitError(null);
    }
  }

  const handleSave = async () => {
    if (submittingRef.current) return;

    const name = data.name?.trim() ?? "";
    const points = Number(data.points);
    const earlyErrors: Record<string, string> = {};
    if (!name) {
      earlyErrors.name = t("common.required");
    } else if (
      existingDenoms.some(
        (candidate) =>
          candidate.id !== (denom?.id ?? "") &&
          candidate.name.trim().toLowerCase() === name.toLowerCase(),
      )
    ) {
      earlyErrors.name = t("hasanat.denominations.duplicateName");
    }
    if (!Number.isFinite(points) || points < 1) {
      earlyErrors.points = t("common.required");
    }

    setSubmitError(null);
    // The shared write contract owns the remaining bounds (integer points, 1..100000).
    const parsed = hasanatDenomCreateSchema.safeParse({
      id: denom?.id ?? generateClientEntityId("den"),
      name,
      points,
      color: data.color,
      description: data.description,
      icon: data.icon,
      active: data.active,
    });
    if (Object.keys(earlyErrors).length > 0 || !parsed.success) {
      setErrors({
        ...earlyErrors,
        ...(parsed.success ? {} : mapZodFormErrors(parsed.error, (message) => message)),
      });
      setSubmitError(t("common.formPleaseFixErrors"));
      return;
    }

    const payload: Denomination = {
      id: parsed.data.id ?? denom?.id ?? generateClientEntityId("den"),
      name: parsed.data.name,
      points: parsed.data.points,
      color: parsed.data.color ?? DEFAULT_DENOMINATION_COLOR,
      description: parsed.data.description ?? "",
      icon: parsed.data.icon ?? "Star",
      active: parsed.data.active ?? true,
    };

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onSave(payload);
    } finally {
      submittingRef.current = false;
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
            className="w-24 h-14 rounded-xl flex items-center justify-center shadow-md text-primary-foreground text-2xl"
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
                className={`min-h-11 min-w-11 rounded-md border-2 transition-all ${data.color === color ? "border-foreground scale-110" : "border-transparent"}`}
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

        <CheckboxField
          id="denom-active"
          name="active"
          checked={data.active}
          onCheckedChange={(checked) => updateField("active", checked)}
          label={t("hasanat.status.active")}
        />
      </form>
    </FormModal>
  );
}
