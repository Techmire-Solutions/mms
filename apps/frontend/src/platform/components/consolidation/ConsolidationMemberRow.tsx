import type React from "react";
import { Building2 } from "lucide-react";
import { Checkbox, Input } from "@shared/ui";
import { Field } from "@/components/app/FormPrimitives";
import { FormListFieldCard } from "@/components/app/FormListFieldCard";
import { FormSelect } from "@/components/app/FormSelect";
import { useTranslation } from "@/hooks/useTranslation";
import type { MemberDraft } from "@/platform/hooks/useConsolidationGroupDraft";

interface ConsolidationMemberRowProps {
  member: MemberDraft;
  index: number;
  workspaceOptions: { value: string; label: string }[];
  canRemove: boolean;
  onChange: (patch: Partial<MemberDraft>) => void;
  onRemove: () => void;
}

const RATE_FIELDS = [
  { field: "closingRate", labelKey: "platform.consolidation.closingRate" },
  { field: "averageRate", labelKey: "platform.consolidation.averageRate" },
  { field: "historicalRate", labelKey: "platform.consolidation.historicalRate" },
] as const;

/** One member workspace: ownership, parent flag and its IAS 21.39 translation rates. */
export function ConsolidationMemberRow({
  member,
  index,
  workspaceOptions,
  canRemove,
  onChange,
  onRemove,
}: ConsolidationMemberRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const id = `cons-member-${member.key}`;
  return (
    <FormListFieldCard
      id={id}
      index={index}
      icon={Building2}
      label={t("platform.consolidation.member", { n: index + 1 })}
      onRemove={onRemove}
      removeLabel={t("platform.consolidation.removeMember")}
      canRemove={canRemove}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id={`${id}-workspace`} label={t("platform.consolidation.workspace")}>
          <FormSelect
            id={`${id}-workspace`}
            name={`members.${index}.memberSubdomain`}
            value={member.memberSubdomain}
            onChange={(value) => onChange({ memberSubdomain: value })}
            options={workspaceOptions}
            searchable
          />
        </Field>
        <Field id={`${id}-ownership`} label={t("platform.consolidation.ownership")}>
          <Input
            id={`${id}-ownership`}
            name={`members.${index}.ownershipPercent`}
            type="text"
            inputMode="decimal"
            value={member.isParent ? "100" : member.ownershipPercent}
            disabled={member.isParent}
            onChange={(event) => onChange({ ownershipPercent: event.target.value })}
            className="text-end font-mono"
          />
        </Field>
        <label
          htmlFor={`${id}-parent`}
          className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2"
        >
          <Checkbox
            id={`${id}-parent`}
            checked={member.isParent}
            onCheckedChange={(checked) => onChange({ isParent: checked === true })}
          />
          {t("platform.consolidation.isParent")}
        </label>
        {RATE_FIELDS.map(({ field, labelKey }) => (
          <Field
            key={field}
            id={`${id}-${field}`}
            label={t(labelKey)}
            hint={t("platform.consolidation.rateHint")}
          >
            <Input
              id={`${id}-${field}`}
              name={`members.${index}.${field}`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={member[field]}
              onChange={(event) => onChange({ [field]: event.target.value })}
              className="text-end font-mono"
            />
          </Field>
        ))}
      </div>
    </FormListFieldCard>
  );
}
