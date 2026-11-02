import React, { useMemo } from "react";
import { IdCard } from "lucide-react";
import { DatePicker } from "@/components/app/DatePicker";
import { EditableMultiSelect, Field, FormCheckboxCard } from "@/components/app/FormPrimitives";
import { LeadingIconInput } from "@/components/app/LeadingIconInput";
import { useTranslation } from "@/hooks/useTranslation";
import {
  type Contact,
  formatCnic,
  getContactTags,
  isReservedSystemTagName,
  normalizeContactTagName,
  splitContactTags,
  todayISO,
} from "@mms/shared";
import { ContactTagBadge } from "@/tenant/features/contacts/components/ContactTagBadge";
import { cn } from "@/lib/utils";

export interface ContactBasicMetaFieldsProps {
  contactDraft: Partial<Contact>;
  formInstanceId: string;
  isFieldEnabled: (tabId: string, fieldId: string) => boolean;
  isFieldRequired: (tabId: string, fieldId: string) => boolean;
  getFieldError: (fieldId: string) => string | undefined;
  updateDraft: (patch: Partial<Contact>) => void;
  tags?: string[];
  onUpdateTags?: (tags: string[]) => void;
}

export function ContactBasicMetaFields({
  contactDraft,
  formInstanceId,
  isFieldEnabled,
  isFieldRequired,
  getFieldError,
  updateDraft,
  tags,
  onUpdateTags,
}: ContactBasicMetaFieldsProps): React.JSX.Element {
  const { t } = useTranslation();
  const isSyedId = `cf-${formInstanceId}-isSyed`;
  const dobError = getFieldError("dob");
  const tagError = getFieldError("tag");

  const draftTags = contactDraft.tags;
  const draftTag = contactDraft.tag;
  const draftSystemTags = contactDraft.systemTags;

  const { manualTags, systemTags } = useMemo(() => {
    const allTags = getContactTags({ tags: draftTags, tag: draftTag });
    return splitContactTags({ tags: allTags, systemTags: draftSystemTags });
  }, [draftTags, draftTag, draftSystemTags]);

  const editableOptions = useMemo(() => {
    const systemNames = new Set(systemTags.map((tag) => normalizeContactTagName(tag.name)));
    return (tags ?? []).filter(
      (tag) => !isReservedSystemTagName(tag) && !systemNames.has(normalizeContactTagName(tag)),
    );
  }, [tags, systemTags]);

  return (
    <>
      {isFieldEnabled("basic", "dob") && (
        <Field
          label={t("contacts.fields.dob")}
          required={isFieldRequired("basic", "dob")}
          error={dobError}
          id={`cf-${formInstanceId}-dob`}
        >
          <DatePicker
            id={`cf-${formInstanceId}-dob`}
            name="dob"
            autoComplete="bday"
            value={contactDraft.dob || undefined}
            onChange={(dateStr) => updateDraft({ dob: dateStr })}
            required={isFieldRequired("basic", "dob")}
            max={todayISO()}
            className={cn(
              dobError &&
                "border-destructive focus-within:border-destructive focus-within:ring-destructive",
            )}
          />
        </Field>
      )}

      {isFieldEnabled("basic", "cnic") && (
        <Field
          label={t("contacts.form.cnic")}
          required={isFieldRequired("basic", "cnic")}
          id={`cf-${formInstanceId}-cnic`}
          error={getFieldError("cnic")}
        >
          <LeadingIconInput
            icon={IdCard}
            id={`cf-${formInstanceId}-cnic`}
            name="cnic"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="next"
            value={contactDraft.cnic || ""}
            onChange={(e) => {
              const formatted = formatCnic(e.target.value);
              updateDraft({ cnic: formatted });
            }}
            placeholder={t("contacts.form.cnicPlaceholder")}
          />
          {Boolean(contactDraft.cnic) && (
            <p className="mt-1 text-2xs text-muted-foreground flex items-center justify-between">
              <span>{t("contacts.form.cnicFormatHint")}</span>
              <span
                className={cn(
                  "font-mono font-medium",
                  (contactDraft.cnic || "").replace(/\D/g, "").length === 13
                    ? "text-success font-semibold"
                    : "text-muted-foreground",
                )}
              >
                {(contactDraft.cnic || "").replace(/\D/g, "").length}/13
              </span>
            </p>
          )}
        </Field>
      )}

      {isFieldEnabled("basic", "tag") && (
        <Field
          label={t("contacts.fields.tag")}
          required={isFieldRequired("basic", "tag")}
          id={`cf-${formInstanceId}-tag`}
          error={tagError}
        >
          <EditableMultiSelect
            id={`cf-${formInstanceId}-tag`}
            options={editableOptions}
            values={manualTags}
            onChange={(selected) =>
              updateDraft({
                tags: selected,
                tag: selected.join(", "),
              })
            }
            onUpdateOptions={onUpdateTags}
            placeholder={t("contacts.form.selectOption")}
            error={Boolean(tagError)}
            className="w-full"
          />
          {systemTags.length > 0 && (
            <div className="mt-2 space-y-1" data-testid="contact-system-tags">
              <div className="flex flex-wrap gap-1">
                {systemTags.map((systemTag) => (
                  <ContactTagBadge
                    key={`${systemTag.systemKey}:${systemTag.name}`}
                    tag={systemTag.name}
                    system={systemTag}
                  />
                ))}
              </div>
              <p className="m-0 text-2xs text-muted-foreground">{t("contacts.tags.systemHint")}</p>
            </div>
          )}
        </Field>
      )}

      {isFieldEnabled("basic", "isSyed") && (
        <div className="@md:col-span-2">
          <FormCheckboxCard
            id={isSyedId}
            name="isSyed"
            checked={Boolean(contactDraft.isSyed)}
            onCheckedChange={(checked) => updateDraft({ isSyed: checked })}
            label={t("contacts.fields.isSyed")}
            error={getFieldError("isSyed")}
          />
        </div>
      )}
    </>
  );
}
