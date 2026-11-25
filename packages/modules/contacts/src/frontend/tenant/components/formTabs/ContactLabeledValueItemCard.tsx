import React, { type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { TranslationFunction } from "@mms/fe-core/i18n";
import {
  EditableSelect,
  Field,
  FormCardTypeSelect,
  TYPE_SELECT_WIDTH,
} from "@mms/fe-core/components/FormPrimitives";
import { LeadingIconInput } from "@mms/ui";
import { FormListFieldCard } from "@mms/fe-core/components/FormPrimitives";
import { cn } from "@mms/ui";
import { FORM_INPUT_ERROR } from "@mms/ui";
import type {
  ListItem,
  ContactLabeledValueFieldContext,
  TranslateFn,
} from "./ContactLabeledValueSubListTab.js";

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
  valueMaxLength?: number | ((item: ListItem) => number | undefined);
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
  valueMaxLength,
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

  const maxLength = typeof valueMaxLength === "function" ? valueMaxLength(item) : valueMaxLength;

  const valueInput = (
    <LeadingIconInput
      icon={Icon}
      type={valueInputType}
      id={`${valueInputIdPrefix}-${idx}`}
      name={`${valueInputIdPrefix}-${idx}`}
      value={stringValue}
      maxLength={maxLength}
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

  const itemKey =
    (item as { id?: string; _localId?: string }).id ??
    (item as { _localId?: string })._localId ??
    getLocalId(listKey, idx);

  return (
    <FormListFieldCard
      key={itemKey}
      id={itemKey}
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
