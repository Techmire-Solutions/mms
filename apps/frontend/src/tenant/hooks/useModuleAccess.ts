import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  evaluateModuleAccess,
  toEffectiveModuleFlags,
  type ModuleAction,
  type ModuleAvailabilityMap,
} from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { moduleAccessQueryOptions } from "@/lib/query/moduleAccessQuery";
import type { ModuleAccessEvaluator } from "@/lib/config/routeAccess";
import { usePermissions } from "@/tenant/hooks/usePermissions";

export interface ModuleAccessState {
  /** `pending` and `error` both deny every module until authoritative data arrives. */
  status: "pending" | "error" | "ready";
  availability: ModuleAvailabilityMap | null;
  /** `enabledModules`-shaped flags (grant ∧ enablement) for widget/quick-action helpers. */
  effectiveModules: Record<string, boolean>;
  evaluate: ModuleAccessEvaluator;
  canManageModules: boolean;
  retry: () => void;
}

/**
 * Module access for the signed-in user: server-authoritative grant and
 * enablement (`/api/module-access`) combined with the session's permissions.
 * The backend re-enforces the same policy on every request.
 */
export function useModuleAccess(): ModuleAccessState {
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const query = useQuery(moduleAccessQueryOptions(isAuthenticated));
  const { refetch } = query;

  const status: ModuleAccessState["status"] = query.isError
    ? "error"
    : query.data
      ? "ready"
      : "pending";
  const availability = status === "ready" ? (query.data ?? null) : null;

  const evaluate = useCallback<ModuleAccessEvaluator>(
    (moduleId: string, action?: ModuleAction) =>
      evaluateModuleAccess({ moduleId, availability, can, action }),
    [availability, can],
  );
  const effectiveModules = useMemo(() => toEffectiveModuleFlags(availability), [availability]);
  const retry = useCallback(() => void refetch(), [refetch]);

  return {
    status,
    availability,
    effectiveModules,
    evaluate,
    canManageModules: can("settings.global.write"),
    retry,
  };
}
