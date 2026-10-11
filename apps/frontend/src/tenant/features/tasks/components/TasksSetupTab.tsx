import React, { useState, useEffect } from "react";
import { Bell, Save, UserCheck } from "lucide-react";
import { type TaskSettings, DEFAULT_TASK_SETTINGS, type DelegationScope } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import { useTranslation } from "@/hooks/useTranslation";
import { useTaskSettings, useUpdateTaskSettings } from "@/tenant/hooks/collections/tasks";
import { notify } from "@/lib/notify";
import { ModuleSetupContent } from "@/components/ui/ModuleSetupContent";

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
      <div className="rounded-lg border border-border bg-card p-5 shadow-xs space-y-5">
        <div>
          <h3 className="font-semibold text-base text-foreground mb-1 text-wrap-balance">
            {t("tasks.setup.delegationScope")}
          </h3>
          <p className="text-xs text-muted-foreground text-wrap-pretty">
            {t("tasks.setup.delegationScopeDesc")}
          </p>
        </div>

        <RadioGroup
          value={settings.delegationScope}
          onValueChange={(val) =>
            setSettings({ ...settings, delegationScope: val as DelegationScope })
          }
          disabled={!canEditSetup || isLoading}
          className="space-y-3"
        >
          {(["descendants", "direct_reports"] as const).map((scope) => (
            <label
              key={scope}
              htmlFor={`scope-${scope}`}
              className="flex items-start gap-3 p-3 rounded-md border border-border bg-background cursor-pointer hover:bg-muted/30 transition-colors"
            >
              <RadioGroupItem id={`scope-${scope}`} value={scope} className="mt-0.5" />
              <div>
                <div className="text-sm font-medium text-foreground">
                  {t(
                    scope === "descendants"
                      ? "tasks.setup.descendants"
                      : "tasks.setup.directReports",
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t(
                    scope === "descendants"
                      ? "tasks.setup.descendantsDesc"
                      : "tasks.setup.directReportsDesc",
                  )}
                </div>
              </div>
            </label>
          ))}
        </RadioGroup>

        <div className="border-t border-border pt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div>
                <div className="text-sm font-medium text-foreground">
                  {t("tasks.setup.allowSelfAssignment")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("tasks.setup.allowSelfAssignmentDesc")}
                </div>
              </div>
            </div>
            <Checkbox
              checked={settings.allowSelfAssignment}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, allowSelfAssignment: checked === true })
              }
              disabled={!canEditSetup || isLoading}
              aria-label={t("tasks.setup.allowSelfAssignment")}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div>
                <div className="text-sm font-medium text-foreground">
                  {t("tasks.setup.notifyOnAssignment")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("tasks.setup.notifyOnAssignmentDesc")}
                </div>
              </div>
            </div>
            <Checkbox
              checked={settings.notifyOnAssignment}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, notifyOnAssignment: checked === true })
              }
              disabled={!canEditSetup || isLoading}
              aria-label={t("tasks.setup.notifyOnAssignment")}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div>
                <div className="text-sm font-medium text-foreground">
                  {t("tasks.setup.notifyOnStatusChange")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("tasks.setup.notifyOnStatusChangeDesc")}
                </div>
              </div>
            </div>
            <Checkbox
              checked={settings.notifyOnStatusChange}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, notifyOnStatusChange: checked === true })
              }
              disabled={!canEditSetup || isLoading}
              aria-label={t("tasks.setup.notifyOnStatusChange")}
            />
          </div>
        </div>

        {canEditSetup ? (
          <div className="pt-2 flex items-center justify-end gap-2">
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
