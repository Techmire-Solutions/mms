import React from "react";
import { Globe, Info, Key, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WarningCallout } from "@/components/ui/WarningCallout";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";
import { useTranslation } from "@/hooks/useTranslation";
import { useGoogleContactsSync } from "@/tenant/features/contacts/hooks/useGoogleContactsSync";
import {
  GoogleContactsConnectStep,
  GoogleContactsConnectedState,
  GoogleContactsSetupForm,
  GoogleContactsSetupHint,
} from "@/tenant/features/contacts/components/sync/GoogleContactsPanelSections";

export interface GoogleContactsPanelProps {
  canWrite?: boolean;
}

/**
 * GoogleContactsPanel component to configure and run Google Contacts synchronization.
 */
export function GoogleContactsPanel({
  canWrite = false,
}: GoogleContactsPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  // BE google-sync routes require contacts.write.
  const sync = useGoogleContactsSync({ canWrite });

  const title = (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="min-w-0 truncate">{t("contacts.sync.googleTitle")}</span>
      {sync.isConnected && (
        <StatusBadge
          status="success"
          size="sm"
          config={{ success: { label: t("contacts.sync.connected"), cls: SEMANTIC_BADGE.success } }}
        />
      )}
    </span>
  );

  const actions = canWrite ? (
    <Button
      type="button"
      variant="ghost"
      aria-expanded={sync.showSetup}
      onClick={() => sync.setShowSetup((v) => !v)}
      className="flex min-h-11 shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground"
    >
      <Key className="h-3 w-3" />
      <span>
        {sync.isConfigured ? t("contacts.sync.editCredentials") : t("contacts.sync.setup")}
      </span>
      {sync.showSetup ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
    </Button>
  ) : undefined;

  return (
    <SectionCard title={title} icon={Globe} actions={actions}>
      <div className="space-y-4 text-start">
        {!canWrite && (
          <WarningCallout
            icon={Info}
            tone="info"
            density="compact"
            description={t("contacts.sync.writeRequired")}
          />
        )}

        {!sync.isConfigured && !sync.showSetup && canWrite && <GoogleContactsSetupHint t={t} />}

        {canWrite && sync.showSetup && (
          <GoogleContactsSetupForm
            clientId={sync.form.clientId}
            clientSecret={sync.form.clientSecret}
            error={sync.error}
            onClientIdChange={(value) => sync.setForm((form) => ({ ...form, clientId: value }))}
            onClientSecretChange={(value) =>
              sync.setForm((form) => ({ ...form, clientSecret: value }))
            }
            onSave={() => void sync.handleSaveCredentials()}
            onCancel={() => {
              sync.setShowSetup(false);
              sync.setError("");
            }}
            t={t}
          />
        )}

        {sync.isConfigured && !sync.isConnected && !sync.showSetup && canWrite && (
          <GoogleContactsConnectStep
            showAuthCode={sync.showAuthCode}
            authCode={sync.authCode}
            exchanging={sync.exchanging}
            error={sync.error}
            onConnect={sync.handleConnect}
            onAuthCodeChange={sync.setAuthCode}
            onExchangeCode={() => void sync.handleExchangeCode()}
            t={t}
          />
        )}

        {sync.isConnected && (
          <GoogleContactsConnectedState
            canWrite={canWrite}
            error={sync.error}
            syncResult={sync.syncResult}
            syncing={sync.syncing}
            onDisconnect={() => void sync.handleDisconnect()}
            onSync={() => void sync.handleSync()}
            t={t}
          />
        )}
      </div>
    </SectionCard>
  );
}
