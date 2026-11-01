import React from "react";
import type { UseFormReturn } from "react-hook-form";
import { USER_STATUS_VALUES, type InviteWorkspaceUserInput, type WorkspaceRole } from "@mms/shared";
import ContactPicker from "@/components/contactLink/ContactPicker";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { FormSelect } from "@/components/app/FormSelect";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { TranslatedFormMessage } from "@/lib/forms/TranslatedFormMessage";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface InviteUserFormFieldsProps {
  form: UseFormReturn<InviteWorkspaceUserInput>;
  excludeIds: string[];
  assignableRoles: WorkspaceRole[];
  t: TranslationFunction;
}

export function InviteUserFormFields({
  form,
  excludeIds,
  assignableRoles,
  t,
}: InviteUserFormFieldsProps): React.JSX.Element {
  return (
    <>
      <FormField
        control={form.control}
        name="contactId"
        render={({ field }) => (
          <FormItem>
            <ContactPicker
              label={t("users.fieldContact")}
              value={field.value || null}
              excludeIds={excludeIds}
              onChange={(id) => field.onChange(id ?? "")}
              searchPlaceholder={t("users.contactSearch")}
              emptyTitle={t("users.contactEmptyTitle")}
              emptyHint={t("users.contactEmptyHint")}
            />
            <TranslatedFormMessage messageKey={form.formState.errors.contactId?.message} />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="role"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("users.fieldRole")}</FormLabel>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {assignableRoles.map((workspaceRole) => (
                <Button
                  key={workspaceRole.id}
                  type="button"
                  size="sm"
                  aria-pressed={field.value === workspaceRole.id}
                  variant={field.value === workspaceRole.id ? "default" : "outline"}
                  onClick={() => field.onChange(workspaceRole.id)}
                  className="min-h-11"
                >
                  {workspaceRole.customLabel?.trim() || t(workspaceRole.labelKey)}
                </Button>
              ))}
            </div>
            <TranslatedFormMessage messageKey={form.formState.errors.role?.message} />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="status"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="invite-status">{t("users.fieldStatus")}</FormLabel>
            <FormControl>
              <FormSelect
                id="invite-status"
                name="status"
                value={field.value}
                onChange={field.onChange}
                options={USER_STATUS_VALUES.map((status) => ({
                  value: status,
                  label: t(`users.status.${status}`),
                }))}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="sendEmail"
        render={({ field }) => (
          <FormItem>
            <CheckboxField
              id={field.name}
              name={field.name}
              checked={field.value}
              onCheckedChange={field.onChange}
              label={t("users.inviteSendEmail")}
              labelClassName="text-xs"
            />
          </FormItem>
        )}
      />
    </>
  );
}
