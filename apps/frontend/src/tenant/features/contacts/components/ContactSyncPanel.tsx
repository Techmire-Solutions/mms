import React from "react";
import { Info } from "lucide-react";
import { WarningCallout } from "@/components/app/WarningCallout";
import { useTranslation } from "@/hooks/useTranslation";
import type { Contact } from "@mms/shared";
import { GoogleContactsPanel } from "./sync/GoogleContactsPanel";
import { AppleContactsPanel } from "./sync/AppleContactsPanel";
import { ModuleSetupContent } from "@/components/app/ModuleSetupContent";

export interface ContactSyncPanelProps {
  onImport: (contacts: Contact[]) => void | Promise<void>;
  /** Requires `contacts.write` — sync imports/mutates entities; do not gate on canEditSetup alone. */
  canWrite?: boolean;
}

/**
 * ContactSyncPanel — Google/Apple sync under Setup → Sync.
 * CTAs use `canWrite` (contacts.write), not `canEditSetup`, so Setup-only roles cannot import.
 */
export function ContactSyncPanel({
  onImport,
  canWrite = false,
}: ContactSyncPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <ModuleSetupContent className="space-y-5">
      <WarningCallout
        icon={Info}
        tone="info"
        title={t("contacts.sync.title")}
        description={t("contacts.sync.description")}
      />

      <GoogleContactsPanel canWrite={canWrite} />
      <AppleContactsPanel onImport={onImport} canWrite={canWrite} />
    </ModuleSetupContent>
  );
}

export default ContactSyncPanel;
