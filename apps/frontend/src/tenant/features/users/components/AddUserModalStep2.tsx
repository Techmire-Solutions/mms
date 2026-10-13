import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/app/DatePicker";

import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useWorkspaceRoles } from "@/tenant/hooks/useWorkspaceRoles";
import { filterAssignableRoles, todayISO } from "@mms/shared";
import { FieldErrorMessage } from "@/components/app/FormPrimitives";
import { RoleCard } from "./AddUserModalRoleCard";
import type { AddUserStepProps } from "../lib/addUserModalTypes";

export function Step2({ form, setForm, errors }: AddUserStepProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
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
          <label
            htmlFor="users-temporary-role"
            className="flex items-center gap-1.5 cursor-pointer select-none"
          >
            <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">
              {t("users.addTemporaryRole")}
            </span>
          </label>
        </div>
        <AnimatePresence>
          {form.temporaryRole && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-2"
            >
              <DatePicker
                id="users-role-expiry"
                name="roleExpiry"
                value={form.roleExpiry || ""}
                min={todayISO()}
                onChange={(val) =>
                  setForm((previousForm) => ({ ...previousForm, roleExpiry: val }))
                }
                aria-label={t("users.addTemporaryRole")}
                className="w-full"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
