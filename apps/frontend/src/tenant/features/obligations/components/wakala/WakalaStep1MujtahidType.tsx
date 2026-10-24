import React from "react";
import { Field, FormSelectWithQuickCreate } from "@/components/app/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import type { Mujtahid, ObligationType } from "@/lib/data/obligationsData";

interface WakalaStep1MujtahidTypeProps {
  selectedMujtahidId: string;
  selectedObTypeId: string;
  mujtahids: Mujtahid[];
  obligationTypes: ObligationType[];
  errors: Record<string, string>;
  onSelectMujtahid: (id: string) => void;
  onSelectObType: (id: string) => void;
  canAddMujtahid: boolean;
  canAddObType: boolean;
  onOpenAddMujtahid: () => void;
  onOpenAddObType: () => void;
}

export function WakalaStep1MujtahidType({
  selectedMujtahidId,
  selectedObTypeId,
  mujtahids,
  obligationTypes,
  errors,
  onSelectMujtahid,
  onSelectObType,
  canAddMujtahid,
  canAddObType,
  onOpenAddMujtahid,
  onOpenAddObType,
}: WakalaStep1MujtahidTypeProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-200">
      <Field
        id="wakala-mujtahid"
        label={t("obligations.form.mujtahidLabel")}
        required
        error={errors.mujtahid}
      >
        <FormSelectWithQuickCreate
          id="wakala-mujtahid"
          name="mujtahid_id"
          value={selectedMujtahidId}
          onChange={onSelectMujtahid}
          placeholder={t("obligations.wakala.selectMujtahid")}
          options={mujtahids.map((m) => ({ value: m.id, label: m.name }))}
          canAdd={canAddMujtahid}
          onOpenAdd={onOpenAddMujtahid}
          addAriaLabel={t("obligations.mujtahids.add")}
        />
      </Field>

      <Field
        id="wakala-type"
        label={t("obligations.wakala.obTypeLabel")}
        required
        error={errors.obType}
      >
        <FormSelectWithQuickCreate
          id="wakala-type"
          name="obligation_type_id"
          value={selectedObTypeId}
          onChange={onSelectObType}
          placeholder={t("obligations.wakala.obTypePlaceholder")}
          options={obligationTypes.map((o) => ({ value: o.id, label: o.name }))}
          canAdd={canAddObType}
          onOpenAdd={onOpenAddObType}
          addAriaLabel={t("obligations.types.add")}
        />
      </Field>
    </div>
  );
}
