import type { FinanceCommandMetricsSnapshot } from "@mms/contracts";
import { FINANCE_MODULE_MANIFEST } from "@mms/contracts";
import { serverMetricsQueryOptions, useServerMetrics } from "@mms/fe-core/hooks";

export function financeCommandMetricsQueryOptions() {
  return serverMetricsQueryOptions<FinanceCommandMetricsSnapshot>({
    moduleId: FINANCE_MODULE_MANIFEST.moduleId,
    apiPath: FINANCE_MODULE_MANIFEST.restBasePath,
  });
}

export function useFinanceMetrics(options?: { enabled?: boolean }) {
  return useServerMetrics<FinanceCommandMetricsSnapshot>({
    moduleId: FINANCE_MODULE_MANIFEST.moduleId,
    apiPath: FINANCE_MODULE_MANIFEST.restBasePath,
    enabled: options?.enabled,
  });
}
