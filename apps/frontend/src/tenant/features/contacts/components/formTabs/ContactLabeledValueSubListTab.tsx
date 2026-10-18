import React, { useCallback, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import type { AppTranslationKey } from "@mms/shared";
import { ContactSubListShell, resolveSubListAllowAdd } from "./ContactSubListCards";
import type { ContactSubListKey, ContactSubListTabBaseProps } from "./types";
import { useTranslation } from "@/hooks/useTranslation";
import { ContactLabeledValueItemCard } from "./ContactLabeledValueItemCard";

export type ListItem = Record<string, unknown>;
export type TranslateFn = (key: AppTranslationKey) => string;

export interface ContactLabeledValueFieldContext {
  item: ListItem;
  index: number;
  updateItem: (idx: number, patch: ListItem) => void;
}

export interface ContactLabeledValueSubListTabProps extends ContactSubListTabBaseProps {
  listKey: Extract<ContactSubListKey, "emails" | "socials" | "phones">;
  labelFieldKey: string;
  valueFieldKey: string;
  valueLabel?: string;
  options: string[];
  onUpdateOptions: (options: string[]) => void;
  resolveLabel: (raw: unknown, options: string[], t: TranslateFn) => string;
  emptyItem: (resolvedLabel: string) => ListItem;
  icon: LucideIcon;
  emptyMessage: string;
  addLabel: string;
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
  /** Optional leading control beside the value input (e.g. dial-code select). */
  valueLeadingAddon?: (ctx: ContactLabeledValueFieldContext) => ReactNode;
  /** Optional custom header element (e.g. primary toggle). */
  headerExtras?: (ctx: ContactLabeledValueFieldContext) => ReactNode;
  /** Override default string patch when the value input changes (e.g. phone parse). */
  onValueChange?: (ctx: ContactLabeledValueFieldContext & { value: string }) => void;
  onValueBlur?: (index: number) => void;
}

/**
 * Shared Emails / Socials / Phones form tab shell: label EditableSelect + value Input.
 */
export function ContactLabeledValueSubListTab({
  contactDraft,
  getLocalId,
  listKey,
  labelFieldKey,
  valueFieldKey,
  valueLabel,
  options,
  onUpdateOptions,
  resolveLabel,
  emptyItem,
  icon: Icon,
  emptyMessage,
  addLabel,
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
  fields: _fields,
  formInstanceId: _formInstanceId,
  addSubListItem,
  ensureSubListItem,
  updateSubListItem,
  removeSubListItem,
}: ContactLabeledValueSubListTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const showLabel = isFieldEnabled(listKey, labelFieldKey);
  const showValue = isFieldEnabled(listKey, valueFieldKey);
  const allowAdd = resolveSubListAllowAdd([showLabel, showValue]);
  const items = (contactDraft[listKey] as ListItem[] | undefined) ?? [];

  const makeEmpty = useCallback(
    () => emptyItem(resolveLabel(undefined, options, t)),
    // We intentionally omit `emptyItem` and `resolveLabel` from deps since they are inline prop functions
    // that change on every render (e.g. from ContactPhonesTab). Including them causes `ensureItem` to
    // be unstable, which caused maximum update depth infinite loops in ContactSubListShell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options, t],
  );

  const addItem = useCallback(() => {
    addSubListItem(listKey, makeEmpty());
  }, [addSubListItem, listKey, makeEmpty]);

  const ensureItem = useCallback(() => {
    ensureSubListItem(listKey, makeEmpty());
  }, [ensureSubListItem, listKey, makeEmpty]);

  const removeItem = useCallback(
    (idx: number) => removeSubListItem(listKey, idx),
    [removeSubListItem, listKey],
  );

  const updateItem = useCallback(
    (idx: number, patch: ListItem) => updateSubListItem(listKey, idx, patch),
    [updateSubListItem, listKey],
  );

  return (
    <ContactSubListShell
      isEmpty={items.length === 0}
      emptyIcon={Icon}
      emptyMessage={emptyMessage}
      addLabel={addLabel}
      onAdd={addItem}
      onEnsureRow={ensureItem}
      allowAdd={allowAdd}
      listKey={listKey}
    >
      <AnimatePresence initial={false}>
        {items.map((item, idx) => (
          <ContactLabeledValueItemCard
            key={getLocalId(listKey, idx)}
            item={item}
            idx={idx}
            listKey={listKey}
            labelFieldKey={labelFieldKey}
            valueFieldKey={valueFieldKey}
            valueLabel={valueLabel}
            options={options}
            onUpdateOptions={onUpdateOptions}
            resolveLabel={resolveLabel}
            icon={Icon}
            removeLabel={removeLabel}
            valuePlaceholder={valuePlaceholder}
            valueInputType={valueInputType}
            valueInputIdPrefix={valueInputIdPrefix}
            labelSelectIdPrefix={labelSelectIdPrefix}
            autoComplete={autoComplete}
            inputMode={inputMode}
            autoCapitalize={autoCapitalize}
            spellCheck={spellCheck}
            enterKeyHint={enterKeyHint}
            valueLeadingAddon={valueLeadingAddon}
            headerExtras={headerExtras}
            onValueChange={onValueChange}
            onValueBlur={onValueBlur}
            getListItemError={getListItemError}
            isFieldEnabled={isFieldEnabled}
            isFieldRequired={isFieldRequired}
            getLocalId={getLocalId}
            updateItem={updateItem}
            removeItem={removeItem}
            t={t}
          />
        ))}
      </AnimatePresence>
    </ContactSubListShell>
  );
}
