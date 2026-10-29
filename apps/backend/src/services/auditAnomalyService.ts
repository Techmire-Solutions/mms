import { and, desc, eq, gte } from "drizzle-orm";
import type { AuditAnomalyReport, AuditAnomalyItem } from "@mms/shared";
import { withTenantRead } from "../db/tenant-context.js";
import { auditTrailEvents } from "../db/schema/auditTrail.js";
import type { DbOrTransaction } from "./auditTrailService.js";

export interface DetectAnomaliesOptions {
  windowHours?: number;
  /** Hard cap on events fetched per window. Defaults to 10,000. */
  limit?: number;
}

/**
 * Section 6: Anomaly Detection.
 * Baselines write volume and access patterns per actor; flags spikes,
 * after-hours destructive activities, and geographically implausible IP access.
 */
export async function detectAuditAnomalies(
  workspaceSubdomain: string,
  options?: DetectAnomaliesOptions,
  executor?: DbOrTransaction,
): Promise<AuditAnomalyReport> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  return executor
    ? runAnomalyDetection(subdomain, options, executor)
    : withTenantRead(subdomain, (db) =>
        runAnomalyDetection(subdomain, options, db as unknown as DbOrTransaction),
      );
}

async function runAnomalyDetection(
  subdomain: string,
  options: DetectAnomaliesOptions | undefined,
  db: DbOrTransaction,
): Promise<AuditAnomalyReport> {
  const windowHours = options?.windowHours ?? 24;
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  // Hard cap: prevents unbounded memory buffering on large tenant shards (mms-performance §1).
  const fetchLimit = options?.limit ?? 10_000;

  const events = await db
    .select({
      id: auditTrailEvents.id,
      realUserId: auditTrailEvents.realUserId,
      actionType: auditTrailEvents.actionType,
      ipAddress: auditTrailEvents.ipAddress,
      transactionTimestamp: auditTrailEvents.transactionTimestamp,
    })
    .from(auditTrailEvents)
    .where(
      and(
        eq(auditTrailEvents.workspaceSubdomain, subdomain),
        gte(auditTrailEvents.transactionTimestamp, since),
      ),
    )
    .orderBy(desc(auditTrailEvents.transactionTimestamp))
    .limit(fetchLimit);

  const anomalies: AuditAnomalyItem[] = [];

  const userCounts = new Map<string, number>();
  const userIps = new Map<string, Set<string>>();
  let afterHoursDestructiveCount = 0;

  for (const event of events) {
    userCounts.set(event.realUserId, (userCounts.get(event.realUserId) ?? 0) + 1);

    if (event.ipAddress) {
      if (!userIps.has(event.realUserId)) {
        userIps.set(event.realUserId, new Set());
      }
      userIps.get(event.realUserId)!.add(event.ipAddress);
    }

    const hour = event.transactionTimestamp.getUTCHours();
    if (
      (hour < 5 || hour > 22) &&
      (event.actionType === "DELETE" || event.actionType === "REDACT")
    ) {
      afterHoursDestructiveCount++;
    }
  }

  // 1. Write volume spikes (e.g. > 100 events in window by a single user)
  for (const [userId, count] of userCounts.entries()) {
    if (count > 100) {
      anomalies.push({
        type: "VOLUME_SPIKE",
        severity: count > 300 ? "CRITICAL" : "HIGH",
        description: `Unusual write volume detected: User "${userId}" generated ${count} audit events in a ${windowHours}h window.`,
        userId,
        count,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  // 2. Geographically implausible Multi-IP access (>= 3 distinct IPs in window for same user)
  for (const [userId, ips] of userIps.entries()) {
    if (ips.size >= 3) {
      anomalies.push({
        type: "MULTI_IP_ACCESS",
        severity: "MEDIUM",
        description: `Geographically implausible access: User "${userId}" accessed workspace from ${ips.size} disparate IP addresses.`,
        userId,
        count: ips.size,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  // 3. Destructive operations executed after standard business hours
  if (afterHoursDestructiveCount > 0) {
    anomalies.push({
      type: "AFTER_HOURS_ACTIVITY",
      severity: "HIGH",
      description: `Detected ${afterHoursDestructiveCount} destructive or redaction events executed outside standard operating hours (22:00 - 05:00 UTC).`,
      count: afterHoursDestructiveCount,
      detectedAt: new Date().toISOString(),
    });
  }

  return {
    workspaceSubdomain: subdomain,
    evaluatedAt: new Date().toISOString(),
    anomalies,
  };
}
