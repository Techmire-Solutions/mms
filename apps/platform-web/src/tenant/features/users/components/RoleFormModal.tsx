import { useState } from "react";
import type React from "react";
import {
  normalizePermissionMap,
  PERMISSION_ACTIONS,
  serializeWorkspaceRoleWrite,
  workspaceRoleLabel,
  workspaceRoleWriteSchema,
  type PermissionAction,
  type PermissionMap,
  type RbacModuleDef,
  type WorkspaceRole,
} from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { FormModal } from "@mms/fe-core/components/FormModal";
import { Field } from "@mms/fe-core/components/FormPrimitives";
import { Input } from "@mms/ui";
import { mapApiFormError } from "@mms/fe-core/forms/serverFormErrors";
import { useSubmitGuard } from "@mms/fe-core/forms/useSubmitGuard";
import { mapZodFormErrors } from "@mms/fe-core/forms/mapZodFormErrors";
import { translateValidationMessage } from "@mms/fe-core/forms/translateValidationMessage";
import { PermissionMatrix } from "@/tenant/features/users/components/PermissionMatrix";

interface RoleFormBaseline {
  name: string;
  desc: string;
  perms: PermissionMap;
}

interface RoleFormModalProps {
  open: boolean;
  title: string;
  role?: WorkspaceRole | null;
  visibleModules: readonly RbacModuleDef[];
  existingRoles?: readonly WorkspaceRole[];
  onSave: (role: WorkspaceRole) => void | Promise<void>;
  onClose: () => void;
}

function roleBaseline(role?: WorkspaceRole | null): RoleFormBaseline {
  return {
    name: role?.customLabel ?? "",
    desc: role?.customDescription ?? "",
    perms: normalizePermissionMap(role?.permissions),
  };
}

export function RoleFormModal({
  open,
  title,
  role,
  visibleModules,
  existingRoles = [],
  onSave,
  onClose,
}: RoleFormModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const [name, setName] = useState(role?.customLabel ?? "");
  const [desc, setDesc] = useState(role?.customDescription ?? "");
  const [perms, setPerms] = useState<PermissionMap>(() =>
    normalizePermissionMap(role?.permissions),
  );
  const [baseline, setBaseline] = useState<RoleFormBaseline>(() => roleBaseline(role));
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // `saving` is render state; the ref guard closes the same-frame double click.
  const guardSave = useSubmitGuard();

  // Adjust state during render: a new role target (or a re-open) resets the whole form.
  const [prevFormSource, setPrevFormSource] = useState({ role, open });
  if (prevFormSource.role !== role || prevFormSource.open !== open) {
    setPrevFormSource({ role, open });
    const next = roleBaseline(role);
    setName(next.name);
    setDesc(next.desc);
    setPerms(next.perms);
    setBaseline(next);
    setError("");
    setFieldErrors({});
  }

  const formDirty = (() => {
    return (
      name !== baseline.name ||
      desc !== baseline.desc ||
      JSON.stringify(normalizePermissionMap(perms)) !== JSON.stringify(baseline.perms)
    );
  })();

  // Compare against every role's display label (custom labels AND translated
  // system labels), excluding the role currently being edited.
  const duplicateName = existingRoles.some(
    (candidate) =>
      candidate.id !== role?.id &&
      workspaceRoleLabel(candidate, t).trim().toLowerCase() === name.trim().toLowerCase(),
  );

  const togglePerm = (moduleId: string, action: PermissionAction): void => {
    setPerms((previousPermissions) => {
      const currentActions = previousPermissions[moduleId] || [];
      const updatedActions = currentActions.includes(action)
        ? currentActions.filter((permissionAction) => permissionAction !== action)
        : [...currentActions, action];
      return { ...previousPermissions, [moduleId]: updatedActions };
    });
  };

  const selectAll = (moduleId: string): void => {
    setPerms((prev) => ({ ...prev, [moduleId]: [...PERMISSION_ACTIONS] }));
  };

  const clearAll = (moduleId: string): void => {
    setPerms((prev) => ({ ...prev, [moduleId]: [] }));
  };

  const submitRole = async (): Promise<void> => {
    const parsed = workspaceRoleWriteSchema.safeParse({
      id: role?.id ?? `role_${crypto.randomUUID()}`,
      name: name.trim(),
      description: desc.trim(),
      permissions: normalizePermissionMap(perms),
    });
    if (!parsed.success) {
      setFieldErrors(
        mapZodFormErrors(parsed.error, (message) => translateValidationMessage(message, t)),
      );
      setError(t("common.formPleaseFixErrors"));
      return;
    }
    if (duplicateName) {
      setFieldErrors({ name: t("users.permissions.errorNameDuplicate") });
      setError(t("common.formPleaseFixErrors"));
      return;
    }
    setError("");
    setFieldErrors({});
    setSaving(true);
    try {
      await onSave(serializeWorkspaceRoleWrite(parsed.data, role));
    } catch (saveError) {
      // Server field errors must land on the same keys as the Zod map; the
      // banner alone leaves the offending Name field looking valid.
      const mapped = mapApiFormError(saveError, (message) =>
        translateValidationMessage(message, t),
      );
      setFieldErrors(mapped.fieldErrors ?? {});
      setError(mapped.message ?? t("settings.serverSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = (): Promise<void | undefined> => guardSave(() => submitRole());

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={title}
      size="xl"
      tall
      cancelLabel={t("users.cancel")}
      saveLabel={t("users.permissions.saveRole")}
      onSave={handleSave}
      saving={saving}
      saveDisabled={saving || !formDirty || !name.trim()}
      error={error || undefined}
      isDirty={formDirty}
      formId="role-form"
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("users.permissions.discardUnsavedRoleFormConfirm")}
      discardConfirmLabel={t("common.yes")}
      discardCancelLabel={t("common.cancel")}
    >
      <form
        id="role-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!saving && formDirty && name.trim()) void handleSave();
        }}
        className="space-y-5"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            id="role-name"
            label={t("users.permissions.fieldName")}
            required
            error={
              duplicateName
                ? t("users.permissions.errorNameDuplicate")
                : fieldErrors.name || undefined
            }
          >
            <Input
              id="role-name"
              name="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError("");
                if (fieldErrors.name) {
                  setFieldErrors((current) => ({ ...current, name: "" }));
                }
              }}
              placeholder={t("users.permissions.fieldNamePlaceholder")}
            />
          </Field>
          <Field
            id="role-desc"
            label={t("users.permissions.fieldDescription")}
            error={fieldErrors.description || undefined}
          >
            <Input
              id="role-desc"
              name="description"
              value={desc}
              onChange={(event) => {
                setDesc(event.target.value);
                if (fieldErrors.description) {
                  setFieldErrors((current) => ({ ...current, description: "" }));
                }
              }}
              placeholder={t("users.permissions.fieldDescriptionPlaceholder")}
            />
          </Field>
        </div>

        <PermissionMatrix
          modules={visibleModules}
          perms={perms}
          readOnly={false}
          onToggle={togglePerm}
          onSelectAll={selectAll}
          onClearAll={clearAll}
        />
      </form>
    </FormModal>
  );
}
