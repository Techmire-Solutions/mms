import React, { useState } from "react";
import { Code2 } from "lucide-react";
import { formatDate } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Modal, CopyButton } from "@shared/ui";
import { SubTabBar } from "@/components/app/SubTabBar";
import type { PlatformActivityLogItem } from "@/platform/hooks/usePlatformActivityLogs";

interface ActivityLogInspectModalProps {
  log: PlatformActivityLogItem | null;
  onClose: () => void;
}

export function ActivityLogInspectModal({
  log,
  onClose,
}: ActivityLogInspectModalProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"full" | "payload">("full");

  if (!log) return null;

  const hasMetadata = Boolean(log.metadataMessage && log.metadataMessage.trim().length > 0);
  const metadataJson = hasMetadata ? log.metadataMessage : t("platform.logs.metadataEmpty");
  const fullJson = JSON.stringify(log, null, 2);

  const displayedContent = activeTab === "payload" ? metadataJson : fullJson;
  const copyText = (activeTab === "payload" && hasMetadata ? log.metadataMessage : fullJson) ?? "";

  return (
    <Modal
      open={Boolean(log)}
      onClose={onClose}
      title={t("platform.logs.inspectJson")}
      subtitle={`${log.action} — ${formatDate(log.createdAt)}`}
      icon={Code2}
      size="lg"
    >
      <div className="space-y-4 pt-2 text-start">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <SubTabBar
            tabs={[
              { key: "full", label: t("platform.logs.viewFullEvent") },
              { key: "payload", label: t("platform.logs.viewPayload") },
            ]}
            value={activeTab}
            onChange={(k) => setActiveTab(k as "full" | "payload")}
          />
          <CopyButton
            text={copyText}
            label={
              activeTab === "payload" ? t("platform.logs.copyPayload") : t("platform.logs.copyJson")
            }
            labelCopied={t("platform.logs.copied")}
            variant="outline"
          />
        </div>

        <div className="relative rounded-xl border border-border/60 bg-muted/60 p-4 font-mono text-xs overflow-x-auto max-h-80 select-all">
          <pre>{displayedContent}</pre>
        </div>

        <div className="flex items-center justify-between pt-2 text-2xs text-muted-foreground font-mono">
          <span>ID: {log.id}</span>
          <span>{log.ipAddress || "—"}</span>
        </div>
      </div>
    </Modal>
  );
}
