import React from "react";
import type { UseFormReturn } from "react-hook-form";
import {
  USER_STATUS_VALUES,
  type EditWorkspaceUserInput,
  type SystemUser,
  type WorkspaceRole,
  type ModuleCustomField,
} from "@mms/shared";
import { WarningCallout } from "@/components/app/WarningCallout";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/app/FormSelect";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import ContactPicker from "@/components/contactLink/ContactPicker";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { TranslatedFormMessage } from "@/lib/forms/TranslatedFormMessage";
import { useTranslation } from "@/hooks/useTranslation";

export interface EditUserModalFieldsProps {
  form: UseFormReturn<EditWorkspaceUserInput & Record<string, unknown>>;
  user: SystemUser;
  canManageThisUser: boolean;
  /** Role is synced from faculty designations — picker is read-only. */
  roleLockedByFaculty?: boolean;
  assignableRoles: WorkspaceRole[];
  customFields: ModuleCustomField[];
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  formId?: string;
}

export function EditUserModalFields({
  form,
  user,
  canManageThisUser,
  roleLockedByFaculty = false,
  assignableRoles,
  customFields,
  onSubmit,
  formId = "edit-user-form",
}: EditUserModalFieldsProps): React.JSX.Element {
  const { t } = useTranslation();
  const roleDisabled = !canManageThisUser || roleLockedByFaculty;

  return (
    <form id={formId} noValidate className="space-y-4" onSubmit={onSubmit}>
      {!canManageThisUser && (
        <WarningCallout
          tone="destructive"
          density="compact"
          role="alert"
          description={t("users.errors.cannotModifySuperAdmin")}
        />
      )}
      <FormField
        control={form.control}
        name="contactId"
        render={({ field }) => (
          <FormItem>
            <ContactPicker
              label={t("users.fieldContact")}
              value={field.value || null}
              onChange={(id) => field.onChange(id ?? "")}
              searchPlaceholder={t("users.contactSearch")}
              emptyTitle={t("users.contactEmptyTitle")}
              emptyHint={t("users.contactEmptyHint")}
            />
            <TranslatedFormMessage messageKey={form.formState.errors.contactId?.message} />
            {user.loginEmail ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("users.fieldLoginEmail")}: {user.loginEmail}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">{t("users.loginEmailNote")}</p>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="role"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("users.fieldRole")}</FormLabel>
            {roleLockedByFaculty ? (
              <p className="mt-1 text-xs text-muted-foreground">{t("users.roleLockedByFaculty")}</p>
            ) : null}
            <div
              role="group"
              aria-label={t("users.fieldRole")}
              className="mt-1.5 flex flex-wrap gap-2"
            >
              {assignableRoles.map((workspaceRole) => (
                <Button
                  key={workspaceRole.id}
                  type="button"
                  size="sm"
                  disabled={roleDisabled}
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
            <FormLabel htmlFor="edit-user-status">{t("users.fieldStatus")}</FormLabel>
            <FormControl>
              <FormSelect
                id="edit-user-status"
                name="edit-user-status"
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
        name="twoFactorEnabled"
        render={({ field }) => (
          <FormItem className="flex min-h-11 flex-row items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox
                id={field.name}
                name={field.name}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <FormLabel
              htmlFor={field.name}
              className="cursor-pointer text-xs font-medium text-foreground"
            >
              {t("users.field2fa")}
            </FormLabel>
          </FormItem>
        )}
      />
      {customFields.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-border/50">
          <p className="text-xs font-bold text-foreground">{t("customFields.title")}</p>
          {customFields.map((cf) => (
            <FormField
              key={cf.id}
              control={form.control}
              name={cf.id}
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor={`custom-field-${cf.id}`}>{cf.label}</FormLabel>
                  <FormControl>
                    <Input
                      id={`custom-field-${cf.id}`}
                      name={field.name}
                      value={String(field.value ?? "")}
                      onChange={field.onChange}
                      placeholder={cf.placeholder || cf.label}
                    />
                  </FormControl>
                  <TranslatedFormMessage
                    messageKey={form.formState.errors[cf.id]?.message as string}
                  />
                </FormItem>
              )}
            />
          ))}
        </div>
      )}
    </form>
  );
}
