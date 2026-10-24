import React, { type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import {
  EditableSelect,
  Field,
  FormCardTypeSelect,
  TYPE_SELECT_WIDTH,
} from "@/components/app/FormPrimitives";
import { LeadingIconInput } from "@/components/app/LeadingIconInput";
import { FormListFieldCard } from "@/components/app/FormPrimitives";
import { cn } from "@/lib/utils";
import { FORM_INPUT_ERROR } from "@/components/ui/formStyles";
import type {
  ListItem,
  ContactLabeledValueFieldContext,
  TranslateFn,
} from "./ContactLabeledValueSubListTab";

export interface ContactLabeledValueItemCardProps {
  item: ListItem;
  idx: number;
  listKey: string;
  labelFieldKey: string;
  valueFieldKey: string;
  valueLabel?: string;
  options: string[];
  onUpdateOptions: (options: string[]) => void;
  resolveLabel: (raw: unknown, options: string[], t: TranslateFn) => string;
  icon: LucideIcon;
  removeLabel: (index: number) => string;
  valuePlaceholder: string;
  valueInputType?: React.HTMLInputTypeAttribute;
  valueInputIdPrefix: string;
  labelSelectIdPrefix: string;
  autoComplete?: string;
  inputMode?: "search" | "text" | "email" | "tel" | "url" | "numeric" | "none" | "decimal";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  spellCheck?: boolean;
  enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
  valueLeadingAddon?: (ctx: ContactLabeledValueFieldContext) => ReactNode;
  headerExtras?: (ctx: ContactLabeledValueFieldContext) => ReactNode;
  onValueChange?: (ctx: ContactLabeledValueFieldContext & { value: string }) => void;
  onValueBlur?: (index: number) => void;
  getListItemError: (group: string, field: string, index: number) => string | undefined;
  isFieldEnabled: (group: string, field: string) => boolean;
  isFieldRequired: (group: string, field: string) => boolean;
  getLocalId: (group: string, index: number) => string;
  updateItem: (idx: number, patch: ListItem) => void;
  removeItem: (idx: number) => void;
  t: TranslationFunction;
}

export function ContactLabeledValueItemCard({
  item,
  idx,
  listKey,
  labelFieldKey,
  valueFieldKey,
  valueLabel,
  options,
  onUpdateOptions,
  resolveLabel,
  icon: Icon,
  removeLabel,
  valuePlaceholder,
  valueInputType = "text",
  valueInputIdPrefix,
  labelSelectIdPrefix,
  autoComplete,
  inputMode,
  autoCapitalize,
  spellCheck,
  enterKeyHint,
  valueLeadingAddon,
  headerExtras,
  onValueChange,
  onValueBlur,
  getListItemError,
  isFieldEnabled,
  isFieldRequired,
  getLocalId,
  updateItem,
  removeItem,
  t,
}: ContactLabeledValueItemCardProps): React.JSX.Element {
  const showLabel = isFieldEnabled(listKey, labelFieldKey);
  const showValue = isFieldEnabled(listKey, valueFieldKey);
  const valueError = getListItemError(listKey, valueFieldKey, idx);
  const labelValue = resolveLabel(item[labelFieldKey], options, t as TranslateFn);
  const rawValue = item[valueFieldKey];
  const stringValue = typeof rawValue === "string" ? rawValue : "";
  const fieldCtx: ContactLabeledValueFieldContext = {
    item,
    index: idx,
    updateItem,
  };

  const valueInput = (
    <LeadingIconInput
      icon={Icon}
      type={valueInputType}
      id={`${valueInputIdPrefix}-${idx}`}
      name={`${valueInputIdPrefix}-${idx}`}
      value={stringValue}
      autoComplete={autoComplete}
      inputMode={inputMode}
      autoCapitalize={autoCapitalize}
      spellCheck={spellCheck}
      enterKeyHint={enterKeyHint}
      onChange={(e) => {
        const value = e.target.value;
        if (onValueChange) {
          onValueChange({ ...fieldCtx, value });
          return;
        }
        updateItem(idx, { [valueFieldKey]: value });
      }}
      onBlur={onValueBlur ? () => onValueBlur(idx) : undefined}
      placeholder={valuePlaceholder}
      wrapperClassName="flex-1 min-w-0"
      className={cn(valueError && FORM_INPUT_ERROR)}
    />
  );

  return (
    <FormListFieldCard
      key={getLocalId(listKey, idx)}
      id={getLocalId(listKey, idx)}
      index={idx}
      icon={Icon}
      label={undefined}
      typeSelect={
        showLabel ? (
          <FormCardTypeSelect label={t("contacts.form.type")}>
            <EditableSelect
              options={options}
              value={labelValue}
              onChange={(val) => updateItem(idx, { [labelFieldKey]: val })}
              onUpdateOptions={onUpdateOptions}
              className={TYPE_SELECT_WIDTH}
              id={`${labelSelectIdPrefix}-${idx}`}
              name={`${labelSelectIdPrefix}-${idx}`}
            />
          </FormCardTypeSelect>
        ) : undefined
      }
      headerExtras={headerExtras ? headerExtras(fieldCtx) : undefined}
      onRemove={() => removeItem(idx)}
      removeLabel={removeLabel(idx + 1)}
    >
      <div className="space-y-3">
        {showValue ? (
          <Field
            label={valueLabel || valuePlaceholder}
            required={isFieldRequired(listKey, valueFieldKey)}
            error={valueError}
            id={`${valueInputIdPrefix}-${idx}`}
          >
            {valueLeadingAddon ? (
              <div className="flex w-full items-center gap-2">
                {valueLeadingAddon(fieldCtx)}
                {valueInput}
              </div>
            ) : (
              valueInput
            )}
          </Field>
        ) : null}
      </div>
    </FormListFieldCard>
  );
}
