import { useEffect, useState } from "react";
import type React from "react";
import {
  PERMISSION_ACTIONS,
  type PermissionAction,
  type PermissionMap,
  type RbacModuleDef,
  type WorkspaceRole,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { Input } from "@/components/ui/input";
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
  onSave: (role: WorkspaceRole) => void;
  onClose: () => void;
}

function roleBaseline(role?: WorkspaceRole | null): RoleFormBaseline {
  return {
    name: role?.customLabel ?? "",
    desc: role?.customDescription ?? "",
    perms: role?.permissions ? structuredClone(role.permissions) : {},
  };
}

export function RoleFormModal({
  open,
  title,
  role,
  visibleModules,
  onSave,
  onClose,
}: RoleFormModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const [name, setName] = useState(role?.customLabel ?? "");
  const [desc, setDesc] = useState(role?.customDescription ?? "");
  const [perms, setPerms] = useState<PermissionMap>(
    role?.permissions ? structuredClone(role.permissions) : {},
  );
  const [baseline, setBaseline] = useState<RoleFormBaseline>(() => roleBaseline(role));
  const [error, setError] = useState("");
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  useEffect(() => {
    const next = roleBaseline(role);
    setName(next.name);
    setDesc(next.desc);
    setPerms(next.perms);
    setBaseline(next);
    setError("");
    setDiscardConfirmOpen(false);
  }, [role, open]);

  const formDirty = (() => {
    return (
      name !== baseline.name ||
      desc !== baseline.desc ||
      JSON.stringify(perms) !== JSON.stringify(baseline.perms)
    );
  })();

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

  const handleSave = (): void => {
    if (!name.trim()) {
      setError(t("users.permissions.errorNameRequired"));
      return;
    }
    onSave({
      id: role?.id ?? `role_${crypto.randomUUID()}`,
      labelKey: "users.role.custom",
      descriptionKey: "users.role.customDesc",
      customLabel: name.trim(),
      customDescription: desc.trim(),
      permissions: perms,
      isSystem: false,
      badgeVariant: "primary",
    });
  };

  const requestClose = (): void => {
    if (!formDirty) {
      onClose();
      return;
    }
    setDiscardConfirmOpen(true);
  };

  return (
    <>
      <FormModal
        open={open}
        onClose={requestClose}
        title={title}
        size="xl"
        tall
        cancelLabel={t("users.cancel")}
        saveLabel={t("users.permissions.saveRole")}
        onSave={handleSave}
        saveDisabled={!formDirty || !name.trim()}
        error={error || undefined}
        formId="role-form"
      >
        <form
          id="role-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (formDirty && name.trim()) handleSave();
          }}
          className="space-y-5"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              id="role-name"
              label={t("users.permissions.fieldName")}
              required
              error={error || undefined}
            >
              <Input
                id="role-name"
                name="name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (error) setError("");
                }}
                placeholder={t("users.permissions.fieldNamePlaceholder")}
              />
            </Field>
            <Field id="role-desc" label={t("users.permissions.fieldDescription")}>
              <Input
                id="role-desc"
                name="description"
                value={desc}
                onChange={(event) => setDesc(event.target.value)}
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

      <ConfirmAlertDialog
        open={discardConfirmOpen}
        onOpenChange={setDiscardConfirmOpen}
        title={t("settings.unsavedChanges")}
        description={t("users.permissions.discardUnsavedRoleFormConfirm")}
        confirmLabel={t("common.yes")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={() => {
          setDiscardConfirmOpen(false);
          onClose();
        }}
      />
    </>
  );
}
