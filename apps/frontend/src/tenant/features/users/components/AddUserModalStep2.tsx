import { useMemo } from "react";
import { AnimatePresence, m } from "framer-motion";
import { CalendarClock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/app/DatePicker";

import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useWorkspaceRoles } from "@/tenant/hooks/useWorkspaceRoles";
import { filterAssignableRoles, type FieldDefinition } from "@mms/contracts";
import { FieldErrorMessage } from "@/components/app/FormPrimitives";
import { useWorkspaceToday } from "@/hooks/useWorkspaceToday";
import { RegistryCustomFieldsGrid } from "@/components/app/RegistryCustomFieldsGrid";
import { useUsersConfig } from "@/hooks/useStandardModuleConfig";
import { RoleCard } from "./AddUserModalRoleCard";
import type { AddUserStepProps } from "../lib/addUserModalTypes";

export function Step2({ form, setForm, errors }: AddUserStepProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const today = useWorkspaceToday();
  const { customFields } = useUsersConfig();
  const workspaceRoles = useWorkspaceRoles();
  const assignableRoles = useMemo(
    () => filterAssignableRoles(workspaceRoles, user?.role),
    [workspaceRoles, user?.role],
  );
  const selectRole = (id: string): void =>
    setForm((previousForm) => ({ ...previousForm, role: id }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {assignableRoles.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            selected={form.role === role.id}
            onSelect={selectRole}
          />
        ))}
      </div>
      <FieldErrorMessage message={errors.role} />

      {(() => {
        const fields: FieldDefinition[] = customFields
          .filter((field) => field.showInForm !== false)
          .map((field, index) => ({
            key: field.id,
            label: field.label,
            type: field.type,
            enabled: true,
            order: index,
            options: field.options,
            placeholder: field.placeholder,
            required: field.required,
          }));
        if (fields.length === 0) return null;
        return (
          <div className="space-y-2">
            <p className="text-xs font-bold text-foreground">{t("customFields.title")}</p>
            <RegistryCustomFieldsGrid
              fields={fields}
              values={form as unknown as Record<string, unknown>}
              errors={errors}
              idPrefix="add-user-custom-field"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              onChange={(key, value) =>
                setForm(
                  (previousForm) => ({ ...previousForm, [key]: value }) as typeof previousForm,
                )
              }
            />
          </div>
        );
      })()}

      <div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="users-temporary-role"
            checked={!!form.temporaryRole}
            onCheckedChange={(checked) =>
              setForm((previousForm) => ({
                ...previousForm,
                temporaryRole: !!checked,
                roleExpiry: "",
              }))
            }
            className="cursor-pointer"
          />
          <Label
            htmlFor="users-temporary-role"
            className="mb-0 flex cursor-pointer items-center gap-1.5 text-xs font-medium normal-case tracking-normal text-foreground select-none"
          >
            <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
            {t("users.addTemporaryRole")}
          </Label>
        </div>
        <AnimatePresence>
          {form.temporaryRole && (
            <m.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-2"
            >
              <DatePicker
                id="users-role-expiry"
                name="roleExpiry"
                value={form.roleExpiry || ""}
                min={today}
                onChange={(val) =>
                  setForm((previousForm) => ({ ...previousForm, roleExpiry: val }))
                }
                aria-label={t("users.addTemporaryRole")}
                className="w-full"
              />
              <FieldErrorMessage message={errors.roleExpiry} />
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
