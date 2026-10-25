import React, { useState, useEffect } from "react";
import { Save } from "lucide-react";
import {
  type TaskSettings,
  type DelegationScope,
  DELEGATION_SCOPES,
  DEFAULT_TASK_SETTINGS,
} from "@mms/shared";
import { Button } from "@/components/ui/button";
import { FormCheckboxCard } from "@/components/app/FormCheckboxCard";
import { FormSelect } from "@/components/app/FormSelect";
import { Field } from "@/components/app/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import { useTaskSettings, useUpdateTaskSettings } from "@/tenant/hooks/collections/tasks";
import { notify } from "@/lib/notify";
import { ModuleSetupContent } from "@/components/app/ModuleSetupContent";

export interface TasksSetupTabProps {
  initialSettings?: TaskSettings;
  canEditSetup?: boolean;
}

function settingsEqual(a: TaskSettings, b: TaskSettings): boolean {
  return (
    a.delegationScope === b.delegationScope &&
    a.allowSelfAssignment === b.allowSelfAssignment &&
    a.notifyOnAssignment === b.notifyOnAssignment &&
    a.notifyOnStatusChange === b.notifyOnStatusChange
  );
}

export function TasksSetupTab({
  initialSettings = DEFAULT_TASK_SETTINGS,
  canEditSetup = true,
}: TasksSetupTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: serverSettings, isLoading } = useTaskSettings();
  const updateSettingsMutation = useUpdateTaskSettings();
  const [settings, setSettings] = useState<TaskSettings>(initialSettings);
  const baseline = serverSettings ?? initialSettings;
  const dirty = !settingsEqual(settings, baseline);

  useEffect(() => {
    if (serverSettings) setSettings(serverSettings);
  }, [serverSettings]);

  const handleSave = async () => {
    if (!dirty) return;
    try {
      await updateSettingsMutation.mutateAsync(settings);
      notify.success(t("tasks.setup.saved"));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : t("tasks.setup.saveFailed"));
    }
  };

  return (
    <ModuleSetupContent>
      <div className="rounded-lg border border-border bg-card p-5 shadow-xs space-y-6">
        <div className="space-y-2">
          <Field
            id="tasks-delegation-scope"
            label={t("tasks.setup.delegationScope")}
            hint={t("tasks.setup.delegationScopeDesc")}
          >
            <FormSelect
              id="tasks-delegation-scope"
              value={settings.delegationScope}
              onChange={(v) => setSettings({ ...settings, delegationScope: v as DelegationScope })}
              disabled={!canEditSetup || isLoading}
              options={DELEGATION_SCOPES.map((scope) => ({
                value: scope,
                label:
                  scope === "descendants"
                    ? t("tasks.setup.descendants")
                    : t("tasks.setup.directReports"),
              }))}
            />
          </Field>
        </div>

        <div className="space-y-3 pt-2 border-t border-border/50">
          <FormCheckboxCard
            id="tasks-allow-self-assignment"
            name="allowSelfAssignment"
            label={t("tasks.setup.allowSelfAssignment")}
            description={t("tasks.setup.allowSelfAssignmentDesc")}
            checked={settings.allowSelfAssignment}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, allowSelfAssignment: checked })
            }
            disabled={!canEditSetup || isLoading}
          />

          <FormCheckboxCard
            id="tasks-notify-assignment"
            name="notifyOnAssignment"
            label={t("tasks.setup.notifyOnAssignment")}
            description={t("tasks.setup.notifyOnAssignmentDesc")}
            checked={settings.notifyOnAssignment}
            onCheckedChange={(checked) => setSettings({ ...settings, notifyOnAssignment: checked })}
            disabled={!canEditSetup || isLoading}
          />

          <FormCheckboxCard
            id="tasks-notify-status-change"
            name="notifyOnStatusChange"
            label={t("tasks.setup.notifyOnStatusChange")}
            description={t("tasks.setup.notifyOnStatusChangeDesc")}
            checked={settings.notifyOnStatusChange}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, notifyOnStatusChange: checked })
            }
            disabled={!canEditSetup || isLoading}
          />
        </div>

        {canEditSetup ? (
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
            <Button
              type="button"
              className="min-h-11 gap-1.5"
              onClick={() => void handleSave()}
              disabled={!dirty || updateSettingsMutation.isPending || isLoading}
            >
              <Save className="h-4 w-4" aria-hidden />
              <span>
                {updateSettingsMutation.isPending ? t("common.saving") : t("common.save")}
              </span>
            </Button>
          </div>
        ) : null}
      </div>
    </ModuleSetupContent>
  );
}
