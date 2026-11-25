import React, { useState } from "react";
import { Boxes, LayoutDashboard } from "lucide-react";
import { SYSTEM_MODULES, type PlatformModuleCatalogEntry } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { useSavedFlash } from "@mms/fe-core/hooks/useSavedFlash";
import { SettingsPanel } from "@mms/fe-core/components/SettingsShell";
import { SectionCard } from "@/components/app/SectionCard";
import { SettingsFormActions } from "@mms/fe-core/components/SettingsFormActions";
import { CardSkeleton } from "@mms/ui";
import { PlatformSettingsLoadError } from "@/platform/features/settings/components/PlatformSettingsLoadError";
import { PlatformModuleSelectCard } from "@/platform/features/shell/components/PlatformModuleSelectCard";
import { resolveModuleIcon } from "@/lib/config/moduleIcons";
import {
  usePlatformModuleCatalogQuery,
  useUpdatePlatformModules,
} from "@/platform/features/settings/hooks/usePlatformModules";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { getPlatformErrorMessage } from "@/platform/features/auth/lib/platformAuthErrors";

const REQUIRED_IDS = new Set(SYSTEM_MODULES.filter((module) => module.required).map((m) => m.id));

type DefaultsDraft = Record<string, boolean>;

function toDefaults(catalog: PlatformModuleCatalogEntry[]): DefaultsDraft {
  return Object.fromEntries(catalog.map((entry) => [entry.id, entry.defaultEnabled]));
}

/**
 * Workspaces → Setup: new-workspace provisioning defaults (module defaults).
 * Global module availability stays in Settings → Modules.
 */
export function PlatformWorkspacesSetupTier(): React.JSX.Element {
  const { t } = useTranslation();
  const { isSuperUser } = usePlatformPermissions();
  const { data: catalog, isLoading, isError, refetch } = usePlatformModuleCatalogQuery();
  const updateModules = useUpdatePlatformModules();
  const { saved, flashSaved } = useSavedFlash();

  const [draft, setDraft] = useState<DefaultsDraft | null>(null);
  const [prevCatalog, setPrevCatalog] = useState(catalog);
  const [formError, setFormError] = useState<string | null>(null);

  const serverDraft = catalog ? toDefaults(catalog) : null;
  const isDirty =
    Boolean(draft && serverDraft) && JSON.stringify(draft) !== JSON.stringify(serverDraft);

  if (catalog !== prevCatalog) {
    setPrevCatalog(catalog);
    if (catalog && (!draft || !isDirty)) setDraft(toDefaults(catalog));
  }

  if (isLoading || !draft) return <CardSkeleton count={2} />;
  if (isError) return <PlatformSettingsLoadError onRetry={() => void refetch()} />;

  const toggleDefault = (id: string, enabled: boolean): void => {
    if (REQUIRED_IDS.has(id)) return;
    setDraft((current) => (current ? { ...current, [id]: enabled } : current));
    setFormError(null);
  };

  const handleSave = async (): Promise<void> => {
    setFormError(null);
    try {
      await updateModules.mutateAsync({
        defaultEnabledModules: {
          ...draft,
          ...Object.fromEntries([...REQUIRED_IDS].map((id) => [id, true])),
        },
        disabledModules: catalog?.filter((entry) => !entry.platformEnabled).map((e) => e.id) ?? [],
      });
      flashSaved();
    } catch (error) {
      setFormError(getPlatformErrorMessage(error, t, undefined, "platform.loadFailed"));
    }
  };

  return (
    <SettingsPanel
      width="medium"
      introKey="platform.setup.workspacesIntro"
      isDirty={isDirty}
      saved={saved}
      footer={
        isSuperUser ? (
          <SettingsFormActions
            saveLabel={t("common.save")}
            onSave={() => void handleSave()}
            onDiscard={() => {
              setDraft(serverDraft);
              setFormError(null);
            }}
            dirty={isDirty}
            saving={updateModules.isPending}
            discardLabel={t("theme.discardChanges")}
          />
        ) : undefined
      }
    >
      <SectionCard
        title={t("platform.settings.modulesDefaultsTitle")}
        subtitle={t("platform.settings.modulesDefaultsDesc")}
        icon={Boxes}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {catalog?.map((entry) => {
            const Icon = resolveModuleIcon(entry.icon) ?? LayoutDashboard;
            return (
              <PlatformModuleSelectCard
                key={entry.id}
                module={entry}
                selected={Boolean(draft[entry.id])}
                disabled={!isSuperUser || entry.required}
                icon={Icon}
                onToggle={toggleDefault}
              />
            );
          })}
        </div>
      </SectionCard>

      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
    </SettingsPanel>
  );
}
