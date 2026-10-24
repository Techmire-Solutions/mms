import React from "react";
import { Database, ShieldCheck, Layers, Cpu, Clock, CheckCircle2, Server } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { PlatformTelemetryData } from "@/platform/hooks/usePlatformTelemetry";
import { usePlatformLiveAnnouncer } from "@/platform/components/common/PlatformLiveRegion";

export interface PlatformDatabaseTelemetryCardProps {
  telemetry?: PlatformTelemetryData;
  isLoading?: boolean;
}

export function PlatformDatabaseTelemetryCard({
  telemetry,
  isLoading = false,
}: PlatformDatabaseTelemetryCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const { announcePolite, announceAssertive } = usePlatformLiveAnnouncer();

  const platformDb = telemetry?.platformDb;
  const tenantDb = telemetry?.tenantDb;

  const totalPool = platformDb?.totalCount ?? telemetry?.dbPool.totalCount ?? 0;
  const activePool = platformDb?.activeCount ?? telemetry?.dbPool.activeCount ?? 0;
  const idlePool = platformDb?.idleCount ?? telemetry?.dbPool.idleCount ?? 0;
  const waitingPool = platformDb?.waitingCount ?? telemetry?.dbPool.waitingCount ?? 0;
  const utilRate = platformDb?.utilizationRate ?? telemetry?.dbPool.utilizationRate ?? 0;
  const latency = platformDb?.latencyMs ?? telemetry?.latencyMs ?? 0;
  const hasReplica = platformDb?.hasReplica ?? false;

  React.useEffect(() => {
    if (!telemetry || isLoading) return;
    if (utilRate > 85) {
      announceAssertive(`Critical alert: Database pool utilization at ${utilRate}%`);
    } else {
      announcePolite(
        `Database telemetry updated: latency ${latency}ms, pool utilization ${utilRate}%`,
      );
    }
  }, [telemetry, isLoading, utilRate, latency, announcePolite, announceAssertive]);

  const activeTenantsCount = tenantDb?.activeTenantsCount ?? 0;
  const totalTenantTx = tenantDb?.totalTenantTransactions ?? 0;
  const capLimit = tenantDb?.tenantCapLimit ?? Math.max(5, Math.floor(totalPool * 0.4));
  const budgetPct = tenantDb?.tenantBudgetPercent ?? 40;
  const activeTenants = tenantDb?.activeTenants ?? [];

  const poolTiles = [
    { label: "Active", val: `${activePool}/${totalPool}`, icon: Layers },
    { label: t("platform.db.idleReserve"), val: idlePool, icon: Cpu },
    { label: t("platform.db.waitingQueue"), val: waitingPool, icon: Clock },
    { label: "Latency", val: `${latency}ms`, icon: Clock },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" data-testid="platform-db-telemetry-card">
      {/* 1. Platform Database Card */}
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs flex flex-col justify-between space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Database className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                {t("platform.db.platformTitle")}
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-medium bg-primary/10 text-primary border border-primary/20">
                <Server className="w-2.5 h-2.5" />
                {platformDb?.engine ?? "PostgreSQL 16"}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-medium bg-muted text-muted-foreground border border-border/50">
                {hasReplica ? "Replica Active" : "Primary Node"}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("platform.db.platformDesc")}</p>
        </div>

        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t("platform.db.poolUtilization")}</span>
            <span className="font-mono font-semibold text-foreground">
              {isLoading ? "…" : `${utilRate}%`}
            </span>
          </div>
          <div className="w-full bg-muted/60 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                utilRate > 85 ? "bg-destructive" : utilRate > 65 ? "bg-warning" : "bg-primary"
              }`}
              style={{ width: `${Math.min(100, utilRate)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-border/50">
          {poolTiles.map((tile) => (
            <div key={tile.label} className="p-2 rounded-lg bg-muted/20 border border-border/40">
              <div className="text-3xs text-muted-foreground flex items-center gap-1">
                <tile.icon className="w-2.5 h-2.5" />
                {tile.label}
              </div>
              <div className="text-sm font-mono font-bold text-foreground">
                {isLoading ? "…" : tile.val}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Tenant Database & RLS Isolation Card */}
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs flex flex-col justify-between space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-success/10 text-success">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                {t("platform.db.tenantTitle")}
              </h3>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-semibold bg-success/15 text-success border border-success/30">
              <CheckCircle2 className="w-2.5 h-2.5" />
              RLS 100% Enforced
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{t("platform.db.tenantDesc")}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="p-2.5 rounded-lg bg-muted/20 border border-border/40">
            <div className="text-3xs text-muted-foreground">
              {t("platform.db.activeWorkspaces")}
            </div>
            <div className="text-sm font-mono font-bold text-foreground">
              {isLoading ? "…" : activeTenantsCount}
            </div>
            <div className="text-3xs text-muted-foreground/75">Active tenant leases</div>
          </div>

          <div className="p-2.5 rounded-lg bg-muted/20 border border-border/40">
            <div className="text-3xs text-muted-foreground">
              {t("platform.db.activeTransactions")}
            </div>
            <div className="text-sm font-mono font-bold text-foreground">
              {isLoading ? "…" : totalTenantTx}
            </div>
            <div className="text-3xs text-muted-foreground/75">In-flight transactions</div>
          </div>

          <div className="p-2.5 rounded-lg bg-muted/20 border border-border/40">
            <div className="text-3xs text-muted-foreground">{t("platform.db.tenantBudgetCap")}</div>
            <div className="text-sm font-mono font-bold text-foreground">
              {isLoading ? "…" : `${capLimit} conns`}
            </div>
            <div className="text-3xs text-muted-foreground/75">{budgetPct}% pool ceiling</div>
          </div>
        </div>

        <div className="pt-2 border-t border-border/50 text-xs">
          <div className="text-3xs font-medium text-muted-foreground mb-1.5 flex items-center justify-between">
            <span>Active Tenant Transaction Leases:</span>
            {activeTenants.some((it) => it.count >= capLimit - 1) && (
              <span className="text-3xs font-semibold text-warning">Near Cap Warning</span>
            )}
          </div>
          {activeTenants.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
              {activeTenants.map((item) => {
                const isNearCap = item.count >= capLimit - 1;
                return (
                  <span
                    key={item.tenant}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-3xs font-mono border ${
                      isNearCap
                        ? "bg-warning/20 border-warning/50 text-warning-foreground animate-pulse"
                        : "bg-muted/50 border-border/50 text-foreground"
                    }`}
                  >
                    <span className="font-semibold">{item.tenant}:</span>
                    <span
                      className={
                        isNearCap ? "text-destructive font-black" : "text-primary font-bold"
                      }
                    >
                      {item.count} tx {isNearCap ? `(near ${capLimit})` : ""}
                    </span>
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="text-3xs text-muted-foreground/80 italic flex items-center gap-1.5 py-0.5">
              <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
              {t("platform.db.noActiveTenantTx")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
