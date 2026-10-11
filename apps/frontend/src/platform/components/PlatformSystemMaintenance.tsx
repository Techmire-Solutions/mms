import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Database, Activity, Cpu, RefreshCw, CheckCircle2, Zap, Layers } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/StatCard";
import { apiFetch } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/utils";
import { containerVariantsConsole as containerVariants, itemVariants as cardVariants } from "@/platform/lib/animations";
import { PlatformMigrateRestartCard } from "@/platform/pages/account/PlatformMigrateRestartCard";
import { PlatformLatencySparkline } from "@/platform/components/system/PlatformLatencySparkline";
import { usePlatformTelemetry } from "@/platform/hooks/usePlatformTelemetry";
import { PlatformDatabaseTelemetryCard } from "@/platform/components/system/PlatformDatabaseTelemetryCard";

export function PlatformSystemMaintenance(): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const { data: telemetry, isLoading: telemetryLoading } = usePlatformTelemetry();
  const [probing, setProbing] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const [redisStatus, setRedisStatus] = useState<string>('connected');
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const runHealthProbe = useCallback(async () => {
    setProbing(true);
    const start = performance.now();
    try {
      const res = await apiFetch("/ready", { cache: "no-store" });
      const elapsed = Math.round(performance.now() - start);
      if (res.ok) {
        const body = (await res.json()) as { redis?: string; database?: string };
        setRedisStatus(body.redis ?? 'connected');
        setLatencyMs(elapsed);
        setLatencyHistory((prev) => [...prev.slice(-7), elapsed]);
      } else {
        setLatencyMs(null);
        setRedisStatus('disconnected');
      }
    } catch {
      setLatencyMs(null);
      setRedisStatus('disconnected');
    } finally {
      setProbing(false);
      setLastChecked(formatDateTime(new Date().toISOString()));
    }
  }, []);

  useEffect(() => {
    void runHealthProbe();
  }, [runHealthProbe]);

  const avgLatency =
    latencyHistory.length > 0
      ? Math.round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length)
      : null;

  return (
    <motion.div
      variants={reducedMotion ? undefined : containerVariants}
      initial={reducedMotion ? false : "hidden"}
      animate="show"
      className="space-y-6 text-start"
    >
      {/* System Maintenance Header Metrics */}
      <motion.div variants={cardVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          variant="compact"
          label={t("platform.dbEngine")}
          value="PostgreSQL 16"
          sub={t("platform.maintenance.rlsEnabled")}
          icon={Database}
          accent="primary"
        />
        <StatCard
          variant="compact"
          label={t("platform.wsBroadcaster")}
          value="Fastify WebSocket"
          sub={t("platform.maintenance.inProcess")}
          icon={Activity}
          accent="success"
        />
        <StatCard
          variant="compact"
          label={t("platform.contextStorage")}
          value="Node ALS"
          sub={t("platform.maintenance.asyncLocalStorage")}
          icon={Cpu}
          accent="warning"
        />
        <StatCard
          variant="compact"
          label={t("platform.maintenance.queueEngine")}
          value={
            redisStatus === 'connected'
              ? t("platform.maintenance.bullmqActive")
              : redisStatus === 'optional'
                ? t("platform.maintenance.bullmqStandalone")
                : t("platform.maintenance.bullmqOffline")
          }
          sub={t("platform.maintenance.queueEngineSub")}
          icon={Layers}
          accent={redisStatus === 'connected' ? "success" : "warning"}
        />
        <StatCard
          variant="compact"
          label={t("platform.maintenance.ping")}
          value={latencyMs !== null ? `${latencyMs} ms` : t("platform.maintenance.probing")}
          sub={
            avgLatency !== null
              ? `${t("platform.maintenance.avgLatency")}: ${avgLatency} ms`
              : lastChecked
                ? t("platform.maintenance.lastChecked", { time: lastChecked })
                : t("platform.statusOperational")
          }
          icon={Zap}
          accent={latencyMs !== null && latencyMs < 200 ? "success" : "primary"}
        />
      </motion.div>

      {/* Maintenance Action Cards */}
      <motion.div variants={cardVariants} className="space-y-6">
        <div className="p-4 rounded-xl border border-border/60 bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex h-2.5 w-2.5 rounded-full bg-success animate-pulse shrink-0" />
            <span className="font-bold text-foreground">{t("platform.maintenance.preflightCheck")}</span>
            <span className="text-muted-foreground">{t("platform.maintenance.systemsReady")}</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-3xs text-muted-foreground shrink-0 flex-wrap">
            <PlatformLatencySparkline
              history={latencyHistory}
              currentLatency={latencyMs}
              avgLatency={avgLatency}
            />
            <span className="bg-card px-2 py-0.5 rounded border border-border/50 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-success" />
              {t("platform.maintenance.dbConnsHealthy")}
            </span>
            <span className="bg-card px-2 py-0.5 rounded border border-border/50 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-success" />
              {redisStatus === 'connected'
                ? t("platform.maintenance.bullmqRedis")
                : t("platform.maintenance.bullmqInMemory")}
            </span>
            <span className="bg-card px-2 py-0.5 rounded border border-border/50 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-success" />
              {t("platform.maintenance.pm2Active")}
            </span>
            <Button
              variant="outline"
              icon={RefreshCw}
              onClick={() => void runHealthProbe()}
              loading={probing}
              title={t("platform.maintenance.runDiagnostics")}
              aria-label={t("platform.maintenance.runDiagnostics")}
            >
              {probing ? t("platform.maintenance.diagnosticsRunning") : t("platform.maintenance.runDiagnostics")}
            </Button>
          </div>
        </div>

        {/* Database Telemetry (Platform DB separated from Tenant DB) */}
        <PlatformDatabaseTelemetryCard
          telemetry={telemetry}
          isLoading={telemetryLoading}
        />

        <div className="grid grid-cols-1 max-w-xl gap-8 items-start">
          <PlatformMigrateRestartCard />
        </div>
      </motion.div>
    </motion.div>
  );
}

