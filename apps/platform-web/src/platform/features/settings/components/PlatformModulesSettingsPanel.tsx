import React, { useState } from "react";
import { AlertTriangle, Boxes, LayoutDashboard } from "lucide-react";
import { SYSTEM_MODULES, type PlatformModuleCatalogEntry } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { useSavedFlash } from "@mms/fe-core/hooks/useSavedFlash";
import { SectionCard } from "@/components/app/SectionCard";
import { SettingsFormActions } from "@mms/fe-core/components/SettingsFormActions";
import { SettingsPanel } from "@mms/fe-core/components/SettingsShell";
import { Alert } from "@/components/app/Alert";
import { PlatformSettingsLoadError } from "@/platform/features/settings/components/PlatformSettingsLoadError";
import { CardSkeleton } from "@mms/ui";
import { PlatformModuleSelectCard } from "@/platform/features/shell/components/PlatformModuleSelectCard";
import { resolveModuleIcon } from "@/lib/config/moduleIcons";
import {
  usePlatformModuleCatalogQuery,
  useUpdatePlatformModules,
} from "@/platform/features/settings/hooks/usePlatformModules";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { getPlatformErrorMessage } from "@/platform/features/auth/lib/platformAuthErrors";

const REQUIRED_IDS = new Set(SYSTEM_MODULES.filter((module) => module.required).map((m) => m.id));

interface ModulesDraft {
  defaults: Record<string, boolean>;
  disabled: string[];
}

function toDraft(catalog: PlatformModuleCatalogEntry[]): ModulesDraft {
  return {
    defaults: Object.fromEntries(catalog.map((entry) => [entry.id, entry.defaultEnabled])),
    disabled: catalog.filter((entry) => !entry.platformEnabled).map((entry) => entry.id),
  };
}

/** Platform-wide module availability (feature flags) + new-workspace defaults. */
export default function PlatformModulesSettingsPanel(): React.JSX.Element {
  const { t } = useTranslation();
  const { isSuperUser } = usePlatformPermissions();
  const { data: catalog, isLoading, isError, refetch } = usePlatformModuleCatalogQuery();
  const updateModules = useUpdatePlatformModules();
  const { saved, flashSaved } = useSavedFlash();

  const [draft, setDraft] = useState<ModulesDraft | null>(null);
  const [prevCatalog, setPrevCatalog] = useState(catalog);
  const [formError, setFormError] = useState<string | null>(null);

  const serverDraft = catalog ? toDraft(catalog) : null;
  const isDirty =
    Boolean(draft && serverDraft) && JSON.stringify(draft) !== JSON.stringify(serverDraft);

  if (catalog !== prevCatalog) {
    setPrevCatalog(catalog);
    if (catalog && (!draft || !isDirty)) setDraft(toDraft(catalog));
  }

  if (isLoading || !draft) return <CardSkeleton count={2} />;
  if (isError) return <PlatformSettingsLoadError onRetry={() => void refetch()} />;

  const toggleDefault = (id: string, enabled: boolean): void => {
    if (REQUIRED_IDS.has(id)) return;
    setDraft((current) =>
      current ? { ...current, defaults: { ...current.defaults, [id]: enabled } } : current,
    );
    setFormError(null);
  };

  const toggleAvailability = (id: string, enabled: boolean): void => {
    if (REQUIRED_IDS.has(id)) return;
    setDraft((current) => {
      if (!current) return current;
      const disabled = new Set(current.disabled);
      if (enabled) disabled.delete(id);
      else disabled.add(id);
      return { ...current, disabled: [...disabled] };
    });
    setFormError(null);
  };

  const handleSave = async (): Promise<void> => {
    setFormError(null);
    try {
      await updateModules.mutateAsync({
        defaultEnabledModules: {
          ...draft.defaults,
          ...Object.fromEntries([...REQUIRED_IDS].map((id) => [id, true])),
        },
        disabledModules: draft.disabled,
      });
      flashSaved();
    } catch (error) {
      setFormError(getPlatformErrorMessage(error, t, undefined, "platform.loadFailed"));
    }
  };

  const renderGrid = (
    entries: PlatformModuleCatalogEntry[],
    selected: (entry: PlatformModuleCatalogEntry) => boolean,
    onToggle: (id: string, checked: boolean) => void,
    disabled: (entry: PlatformModuleCatalogEntry) => boolean,
  ) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {entries.map((entry) => {
        const Icon = resolveModuleIcon(entry.icon) ?? LayoutDashboard;
        return (
          <PlatformModuleSelectCard
            key={entry.id}
            module={entry}
            selected={selected(entry)}
            disabled={disabled(entry)}
            icon={Icon}
            onToggle={onToggle}
          />
        );
      })}
    </div>
  );

  return (
    <SettingsPanel
      width="wide"
      introKey="platform.settings.introModules"
      isDirty={isDirty}
      saved={saved}
      footer={
        isSuperUser ? (
          <SettingsFormActions
            saveLabel={t("common.save")}
            onSave={() => void handleSave()}
            onDiscard={() => setDraft(serverDraft)}
            dirty={isDirty}
            saving={updateModules.isPending}
            discardLabel={t("theme.discardChanges")}
          />
        ) : undefined
      }
    >
      {!isSuperUser ? (
        <Alert
          tone="warning"
          density="compact"
          role="status"
          icon={AlertTriangle}
          description={t("platform.settings.superUserOnly")}
        />
      ) : null}

      <SectionCard
        title={t("platform.settings.modulesAvailabilityTitle")}
        subtitle={t("platform.settings.modulesAvailabilityDesc")}
        icon={Boxes}
      >
        {renderGrid(
          catalog ?? [],
          (entry) => !draft.disabled.includes(entry.id),
          toggleAvailability,
          (entry) => !isSuperUser || Boolean(entry.required),
        )}
      </SectionCard>

      <SectionCard
        title={t("platform.settings.modulesDefaultsTitle")}
        subtitle={t("platform.settings.modulesDefaultsDesc")}
        icon={LayoutDashboard}
      >
        {renderGrid(
          catalog ?? [],
          (entry) => Boolean(draft.defaults[entry.id]),
          toggleDefault,
          (entry) =>
            !isSuperUser ||
            Boolean(entry.required) ||
            draft.disabled.includes(entry.id) ||
            !entry.platformEnabled,
        )}
      </SectionCard>

      {formError ? (
        <Alert tone="destructive" density="compact" role="alert" description={formError} />
      ) : null}
    </SettingsPanel>
  );
}
