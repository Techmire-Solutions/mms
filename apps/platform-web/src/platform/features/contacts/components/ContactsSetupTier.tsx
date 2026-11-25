import React, { useState } from "react";
import { Settings } from "lucide-react";
import { DEFAULT_PLATFORM_CONTACT_PREFS, type PlatformContactPrefs } from "@mms/contracts";
import { SettingsPanel } from "@mms/fe-core/components/SettingsShell";
import { SectionCard } from "@/components/app/SectionCard";
import { SettingsFormActions } from "@mms/fe-core/components/SettingsFormActions";
import { Field } from "@mms/fe-core/components/FormPrimitives";
import { FormSelect } from "@mms/fe-core/components/FormSelect";
import { CardSkeleton } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { useSavedFlash } from "@mms/fe-core/hooks/useSavedFlash";
import { PlatformSettingsLoadError } from "@/platform/features/settings/components/PlatformSettingsLoadError";
import {
  usePlatformSettingsQuery,
  useUpdatePlatformSettings,
} from "@/platform/features/settings/hooks/usePlatformSettings";
import {
  PLATFORM_CONTACT_KINDS,
  PLATFORM_CONTACT_KIND_LABEL_KEYS,
} from "@/platform/features/contacts/lib/platformContactKinds";

/** Contacts → Setup: directory defaults (default kind for new/imported contacts, dirty-gated). */
export function ContactsSetupTier(): React.JSX.Element {
  const { t } = useTranslation();
  const { data: settings, isLoading, isError, refetch } = usePlatformSettingsQuery();
  const update = useUpdatePlatformSettings();
  const { saved, flashSaved } = useSavedFlash();

  const [draft, setDraft] = useState<PlatformContactPrefs | null>(null);
  const [prevPrefs, setPrevPrefs] = useState(settings?.contactPrefs);

  const serverPrefs = settings?.contactPrefs ?? DEFAULT_PLATFORM_CONTACT_PREFS;
  const isDirty = Boolean(draft) && JSON.stringify(draft) !== JSON.stringify(serverPrefs);

  if (settings?.contactPrefs !== prevPrefs) {
    setPrevPrefs(settings?.contactPrefs);
    if (settings?.contactPrefs && (!draft || !isDirty)) {
      setDraft(settings.contactPrefs);
    }
  }

  if (isLoading || !draft) return <CardSkeleton count={1} />;
  if (isError) return <PlatformSettingsLoadError onRetry={() => void refetch()} />;

  const handleSave = async (): Promise<void> => {
    await update.mutateAsync({ contactPrefs: draft });
    flashSaved();
  };

  return (
    <SettingsPanel
      width="medium"
      introKey="platform.contacts.setupIntro"
      isDirty={isDirty}
      saved={saved}
      footer={
        <SettingsFormActions
          saveLabel={t("common.save")}
          onSave={() => void handleSave()}
          onDiscard={() => setDraft(serverPrefs)}
          dirty={isDirty}
          saving={update.isPending}
          discardLabel={t("theme.discardChanges")}
        />
      }
    >
      <SectionCard
        title={t("platform.contacts.setupTitle")}
        subtitle={t("platform.contacts.setupDesc")}
        icon={Settings}
      >
        <Field id="contact-prefs-kind" label={t("platform.contacts.setupDefaultKind")}>
          <FormSelect
            id="contact-prefs-kind"
            name="defaultKind"
            value={draft.defaultKind}
            onChange={(value) =>
              setDraft((current) =>
                current
                  ? { ...current, defaultKind: value as PlatformContactPrefs["defaultKind"] }
                  : current,
              )
            }
            options={PLATFORM_CONTACT_KINDS.map((kind) => ({
              value: kind,
              label: t(PLATFORM_CONTACT_KIND_LABEL_KEYS[kind]),
            }))}
          />
        </Field>
      </SectionCard>
    </SettingsPanel>
  );
}
