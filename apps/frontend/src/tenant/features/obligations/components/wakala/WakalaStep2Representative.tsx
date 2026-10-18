import React from "react";
import { Field, FormSelectWithQuickCreate } from "@/components/app/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import type { Mujtahid, MujtahidRep, ObligationType } from "@/lib/data/obligationsData";

interface WakalaStep2RepresentativeProps {
  selectedMujtahid: Mujtahid | undefined;
  selectedObType: ObligationType | undefined;
  selectedRepId: string;
  availableReps: MujtahidRep[];
  errors: Record<string, string>;
  onSelectRep: (id: string) => void;
  canAddRep: boolean;
  onOpenAddRep: () => void;
}

export function WakalaStep2Representative({
  selectedMujtahid,
  selectedObType,
  selectedRepId,
  availableReps,
  errors,
  onSelectRep,
  canAddRep,
  onOpenAddRep,
}: WakalaStep2RepresentativeProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-200">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
        <div className="font-semibold text-primary">{t("obligations.wakala.stage1Selection")}</div>
        <div className="mt-1 flex flex-wrap gap-2 text-foreground">
          <span className="rounded bg-background px-2 py-0.5 border font-medium">
            {t("obligations.wakala.mujtahidLabel", { name: selectedMujtahid?.name || "?" })}
          </span>
          <span className="rounded bg-background px-2 py-0.5 border font-medium">
            {t("obligations.wakala.typeLabel", { name: selectedObType?.name || "?" })}
          </span>
        </div>
      </div>

      <Field id="wakala-rep" label={t("obligations.wakala.repLabel")} required error={errors.rep}>
        <FormSelectWithQuickCreate
          id="wakala-rep"
          name="mujtahid_representative_id"
          value={selectedRepId}
          onChange={onSelectRep}
          placeholder={t("obligations.wakala.repPlaceholder")}
          options={availableReps.map((rep) => ({
            value: rep.id,
            label: rep.name,
          }))}
          canAdd={canAddRep}
          onOpenAdd={onOpenAddRep}
          addAriaLabel={t("obligations.mujtahids.addRep")}
        />
      </Field>
      {availableReps.length === 0 && (
        <p className="mt-1 text-xs text-muted-foreground">{t("obligations.wakala.noRepYet")}</p>
      )}
    </div>
  );
}
