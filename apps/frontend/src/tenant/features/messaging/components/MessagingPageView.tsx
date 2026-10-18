import { Suspense, lazy, useState } from "react";
import { MessageSquare, type LucideIcon } from "lucide-react";
import {
  type Message,
  type MessageTemplate,
  type StandardMessagingRecipient as MessagingRecipient,
  messagingTransferSchema,
} from "@mms/shared";
import { useGenericModuleExport } from "@/lib/backgroundJobs/useGenericModuleExport";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { ErrorState } from "@/components/app/ErrorState";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { ResponsiveAccordionTabs } from "@/components/app/ResponsiveAccordionTabs";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { useTranslation } from "@/hooks/useTranslation";
import type { MessagingTarget } from "@/hooks/useMessageComposerState";
import { MessagingCommandMetrics } from "./MessagingCommandMetrics";
import { MessagingPageHeaderActions } from "./MessagingPageHeaderActions";
import { MessagingWorkTier } from "./MessagingWorkTier";
import { MessagingCsvImportDialog } from "./MessagingCsvImportDialog";

const MessagingReportsTier = lazy(() =>
  import("@/tenant/components/moduleReports").then((m) => ({ default: m.ModuleReportsTier })),
);
const MessagingSetupTier = lazy(() =>
  import("./MessagingSetupTier").then((m) => ({ default: m.MessagingSetupTier })),
);

const MessageComposer = lazy(() => import("@/tenant/components/messaging/TenantMessageComposer"));

export interface MessagingPageViewProps {
  canRead: boolean;
  canWrite: boolean;
  canViewSetup: boolean;
  canEditSetup: boolean;
  canClearLogs: boolean;
  activeTab: "work" | "reports" | "setup";
  visibleTabs: { id: string; label: string; icon: LucideIcon }[];
  channelFilter: "all" | "sms" | "whatsapp" | "email";
  startingCampaign: boolean;
  messagingTarget: MessagingTarget | null;
  templates: MessageTemplate[];
  stats: { total: number; sms: number; whatsapp: number; email: number };
  metricsQueryIsError: boolean;
  deleteTemplateId: string | null;
  confirmClearLogsOpen: boolean;
  handleTabChange: (tab: "work" | "reports" | "setup") => void;
  setChannelFilter: (channel: "all" | "sms" | "whatsapp" | "email") => void;
  setDeleteTemplateId: (id: string | null) => void;
  setConfirmClearLogsOpen: (open: boolean) => void;
  startCampaign: (channel: "whatsapp" | "sms" | "email") => void;
  resend: (log: Message, recipient: MessagingRecipient) => void;
  handleBulkResend: (
    logs: Message[],
    recipients: MessagingRecipient[],
    targetChannel?: "whatsapp" | "sms" | "email",
  ) => void;
  confirmDeleteTemplate: () => Promise<void>;
  confirmClearLogs: () => Promise<void>;
  handleDispatchSent: () => void;
  closeComposer: () => void;
  refetchMetrics: () => void;
}

export function MessagingPageView(p: MessagingPageViewProps): React.JSX.Element {
  const { t } = useTranslation();
  const [importOpen, setImportOpen] = useState(false);
  const { handleExport, isExporting } = useGenericModuleExport({
    path: "/api/messaging/export/csv",
    filename: "messaging-logs.csv",
    columns: messagingTransferSchema.exportColumns,
    canExport: p.canWrite,
  });

  return (
    <ModulePageShell
      seoTitle={`MMS - ${t("nav.messaging")}`}
      seoDescription={t("messaging.subtitle")}
      headerIcon={MessageSquare}
      headerTitle={t("messaging.title")}
      headerSubtitle={t("messaging.subtitle")}
      headerActions={
        <MessagingPageHeaderActions
          canWrite={p.canWrite}
          canExport={p.canWrite}
          isExporting={isExporting}
          startingCampaign={p.startingCampaign}
          onStartCampaign={p.startCampaign}
          onImport={() => setImportOpen(true)}
          onExport={handleExport}
        />
      }
      metricsStrip={
        <MessagingCommandMetrics
          canRead={p.canRead}
          isError={p.metricsQueryIsError}
          onRetry={p.refetchMetrics}
          stats={p.stats}
        />
      }
    >
      {!p.canRead ? (
        <ErrorState
          title={t("platform.actionForbidden")}
          description={t("messaging.loadFailedHint")}
        />
      ) : (
        <ResponsiveAccordionTabs
          tabs={p.visibleTabs}
          activeTab={p.activeTab}
          onTabChange={(tab) => p.handleTabChange(tab as typeof p.activeTab)}
          panelIdPrefix="messaging-tab"
        >
          {p.activeTab === "work" && (
            <div className="space-y-5">
              <MessagingWorkTier
                canWrite={p.canWrite}
                canClearLogs={p.canClearLogs}
                onClearLogsRequest={() => p.setConfirmClearLogsOpen(true)}
                onResend={p.resend}
                onBulkResend={p.handleBulkResend}
                channel={p.channelFilter}
                onChannelChange={p.setChannelFilter}
              />
            </div>
          )}
          {p.activeTab === "reports" && (
            <Suspense fallback={<RouteStatusFallback />}>
              <MessagingReportsTier category="messaging" />
            </Suspense>
          )}
          {p.activeTab === "setup" && (
            <Suspense fallback={<RouteStatusFallback />}>
              <MessagingSetupTier
                canWrite={p.canWrite}
                canEditSetup={p.canEditSetup}
                onDeleteRequest={p.setDeleteTemplateId}
              />
            </Suspense>
          )}
        </ResponsiveAccordionTabs>
      )}

      {p.canRead && p.messagingTarget && (
        <Suspense fallback={null}>
          <MessageComposer
            channel={p.messagingTarget.channel}
            recipients={p.messagingTarget.recipients}
            templates={p.templates}
            initialMessage={p.messagingTarget.initialMessage}
            initialSubject={p.messagingTarget.initialSubject}
            onSent={p.handleDispatchSent}
            onClose={p.closeComposer}
          />
        </Suspense>
      )}

      <ConfirmAlertDialog
        open={Boolean(p.deleteTemplateId)}
        onOpenChange={(open) => {
          if (!open) p.setDeleteTemplateId(null);
        }}
        title={t("messaging.deleteTemplateTitle")}
        description={t("messaging.deleteTemplateDesc")}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={() => void p.confirmDeleteTemplate()}
      />

      <ConfirmAlertDialog
        open={p.confirmClearLogsOpen}
        onOpenChange={p.setConfirmClearLogsOpen}
        title={t("messaging.clearLogs")}
        description={t("messaging.clearLogsDesc")}
        confirmLabel={t("messaging.clearLogsConfirm")}
        destructive
        onConfirm={() => void p.confirmClearLogs()}
      />

      <MessagingCsvImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        canWrite={p.canWrite}
      />
    </ModulePageShell>
  );
}
