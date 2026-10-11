import React, { useState, useCallback } from "react";
import {
  ShieldCheck,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertTriangle,
  Hash,
  Layers,
} from "lucide-react";
import { WarningCallout } from "@/components/ui/WarningCallout";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/StatCard";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { triggerFileDownload } from "@/lib/download";
import { apiJson } from "@/lib/apiClient";
import {
  useAuditVerifyMutation,
  useAuditMerkleRootsQuery,
  useAuditAnomaliesQuery,
  type AuditVerificationResult,
  type AuditExportPayload,
} from "@/tenant/hooks/collections/audit";

interface AuditIntegritySectionProps {
  workspaceSubdomain: string;
}

export function AuditIntegritySection({
  workspaceSubdomain,
}: AuditIntegritySectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const [lastResult, setLastResult] = useState<AuditVerificationResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const verifyMutation = useAuditVerifyMutation();
  const merkleQuery = useAuditMerkleRootsQuery();
  const anomaliesQuery = useAuditAnomaliesQuery();

  const handleVerify = useCallback(async () => {
    try {
      const result = await verifyMutation.mutateAsync();
      setLastResult(result);
      if (result.status === "VERIFIED") {
        notify.success(t("audit.verified"), {
          description: `${result.recordsChecked} ${t("audit.recordsChecked").toLowerCase()}`,
        });
      } else {
        notify.error(t("audit.tampered"), {
          description: result.discrepancies.join(", ") || t("audit.brokenChain"),
        });
      }
    } catch {
      notify.error(t("audit.brokenChain"));
    }
  }, [verifyMutation, t]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const payload = await apiJson<AuditExportPayload>("/api/audit/export");
      const filename = `audit-trail-${workspaceSubdomain}-${new Date().toISOString().slice(0, 10)}.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      triggerFileDownload(blob, filename);
      notify.success(t("audit.exportAction"));
    } catch {
      notify.error(t("audit.brokenChain"));
    } finally {
      setIsExporting(false);
    }
  }, [workspaceSubdomain, t]);

  const latestMerkle = merkleQuery.data?.items?.[0] ?? null;

  return (
    <SectionCard
      title={t("audit.integrityTitle")}
      subtitle={t("audit.integrityDesc")}
      icon={ShieldCheck}
    >
      <div className="space-y-5 pt-1">
        {lastResult ? (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div
              className={`flex items-center gap-1.5 text-xs font-semibold ${
                lastResult.status === "VERIFIED" ? "text-success" : "text-destructive"
              }`}
            >
              {lastResult.status === "VERIFIED" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              <span>
                {lastResult.status === "VERIFIED" ? t("audit.verified") : t("audit.tampered")}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <StatCard
                variant="compact"
                icon={Layers}
                label={t("audit.recordsChecked")}
                value={lastResult.recordsChecked}
                accent="primary"
              />
              <StatCard
                variant="compact"
                icon={Hash}
                label={t("audit.headHash")}
                value={
                  lastResult.headHash
                    ? `${lastResult.headHash.slice(0, 8)}…${lastResult.headHash.slice(-6)}`
                    : "—"
                }
                accent="primary"
              />
              <StatCard
                variant="compact"
                icon={ShieldCheck}
                label={t("audit.merkleRoot")}
                value={
                  latestMerkle
                    ? `${latestMerkle.rootHash.slice(0, 8)}…${latestMerkle.rootHash.slice(-6)}`
                    : "—"
                }
                accent="primary"
              />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border/50 bg-card/30 p-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("audit.integrityDesc")}
            </p>
          </div>
        )}

        {(anomaliesQuery.data?.anomalies?.length ?? 0) > 0 && (
          <WarningCallout
            density="compact"
            title={t("audit.anomaliesDetected", {
              count: anomaliesQuery.data?.anomalies.length ?? 0,
            })}
          >
            <ul className="list-disc ps-4 text-muted-foreground text-3xs leading-relaxed space-y-1">
              {anomaliesQuery.data?.anomalies.map((anom, idx) => (
                <li key={idx}>{anom.description}</li>
              ))}
            </ul>
          </WarningCallout>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            type="button"
            variant="default"
            onClick={handleVerify}
            disabled={verifyMutation.isPending}
            className="min-h-11 gap-2 px-5 py-2.5 rounded-lg font-semibold"
          >
            <RefreshCw className={`h-4 w-4 ${verifyMutation.isPending ? "animate-spin" : ""}`} />
            <span>{verifyMutation.isPending ? t("audit.verifying") : t("audit.verifyAction")}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
            className="min-h-11 gap-2 px-5 py-2.5 rounded-lg font-semibold"
          >
            <Download className={`h-4 w-4 ${isExporting ? "animate-spin" : ""}`} />
            <span>{t("audit.exportAction")}</span>
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
