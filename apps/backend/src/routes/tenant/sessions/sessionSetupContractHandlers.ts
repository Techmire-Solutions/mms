import {
  type sessionContract,
  SESSIONS_MODULE_MANIFEST,
  SESSION_LOOKUP_KINDS,
  type User,
  type SessionLookupKind,
  roleHasPermission,
  normalizeSessionModulePreferences,
} from "@mms/shared";
import { canReadCollection } from "../../../services/rbacService.js";
import { sessionsUseCases } from "../../../sessions/use-cases/sessionsUseCases.js";
import {
  loadSessionFieldConfig,
  saveSessionFieldConfig,
} from "../../../services/sessionConfigService.js";
import {
  loadSessionModulePreferences,
  saveSessionModulePreferences,
} from "../../../services/sessionPreferencesService.js";
import { loadSessionLookupsMap } from "../../../services/sessionLookupsService.js";
import { auditSession } from "./sessionRouteHelpers.js";
import { putSessionLookupKind } from "./sessionLookupKindPut.js";
import { handleContractError } from "../../../lib/contractError.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { withTenant } from "../../../db/tenant-context.js";

const COLLECTION = SESSIONS_MODULE_MANIFEST.collectionKey;
const SETUP_WRITE_PERM = SESSIONS_MODULE_MANIFEST.permissions.setupWrite;

export const sessionSetupContractHandlers = {
  exportAudit: async ({
    request,
  }: ContractRouteArgs<(typeof sessionContract)["exportAudit"]>): Promise<
    ContractRouteResponse<(typeof sessionContract)["exportAudit"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION))
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Insufficient permissions" },
      };
    return { status: 200 as const, body: { success: true } };
  },

  widgetAggregates: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof sessionContract)["widgetAggregates"]>): Promise<
    ContractRouteResponse<(typeof sessionContract)["widgetAggregates"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION))
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Insufficient permissions" },
      };
    try {
      const result = await withTenant(
        String(request.tenant?.id),
        () => sessionsUseCases.loadSessionsWidgetAggregates(body.widgets, request),
        { readOnly: true },
      );
      return { status: 200 as const, body: { results: result } };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to load widget aggregates" },
      });
    }
  },

  reportAggregates: async ({
    request,
  }: ContractRouteArgs<(typeof sessionContract)["reportAggregates"]>): Promise<
    ContractRouteResponse<(typeof sessionContract)["reportAggregates"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION))
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Insufficient permissions" },
      };
    try {
      const aggregates = await sessionsUseCases.loadSessionsReportAggregates();
      return { status: 200 as const, body: aggregates };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to load sessions report aggregates" },
      });
    }
  },

  getFieldConfig: async ({
    request,
  }: ContractRouteArgs<(typeof sessionContract)["getFieldConfig"]>): Promise<
    ContractRouteResponse<(typeof sessionContract)["getFieldConfig"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION))
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Insufficient permissions" },
      };
    try {
      const config = await loadSessionFieldConfig();
      return {
        status: 200 as const,
        body: { config: (config ?? null) as Record<string, unknown> | null },
      };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to load session field config" },
      });
    }
  },

  updateFieldConfig: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof sessionContract)["updateFieldConfig"]>): Promise<
    ContractRouteResponse<(typeof sessionContract)["updateFieldConfig"]>
  > => {
    const user = request.user as User;
    if (!roleHasPermission(user.role, SETUP_WRITE_PERM))
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Insufficient permissions" },
      };
    try {
      const saved = await saveSessionFieldConfig(body);
      await auditSession(
        user,
        "session.field-config",
        "Updated session field configuration",
        "field-config",
      );
      return { status: 200 as const, body: { success: true, config: Object.assign({}, saved) } };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to save session field config" },
      });
    }
  },

  getPreferences: async ({
    request,
  }: ContractRouteArgs<(typeof sessionContract)["getPreferences"]>): Promise<
    ContractRouteResponse<(typeof sessionContract)["getPreferences"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION))
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Insufficient permissions" },
      };
    try {
      const raw = await loadSessionModulePreferences();
      const preferences = normalizeSessionModulePreferences(raw ?? undefined);
      return { status: 200 as const, body: { preferences } };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to load session preferences" },
      });
    }
  },

  updatePreferences: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof sessionContract)["updatePreferences"]>): Promise<
    ContractRouteResponse<(typeof sessionContract)["updatePreferences"]>
  > => {
    const user = request.user as User;
    if (!roleHasPermission(user.role, SETUP_WRITE_PERM))
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Insufficient permissions" },
      };
    try {
      const normalized = normalizeSessionModulePreferences(body);
      await saveSessionModulePreferences(normalized);
      await auditSession(
        user,
        "session.preferences",
        "Updated session module preferences",
        "preferences",
      );
      return { status: 200 as const, body: { success: true, preferences: normalized } };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to save session preferences" },
      });
    }
  },

  getLookups: async ({
    request,
  }: ContractRouteArgs<(typeof sessionContract)["getLookups"]>): Promise<
    ContractRouteResponse<(typeof sessionContract)["getLookups"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION))
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Insufficient permissions" },
      };
    try {
      const lookups = await loadSessionLookupsMap();
      return {
        status: 200 as const,
        body: { lookups: { statuses: lookups.statuses ?? [] } },
      };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to load session lookups" },
      });
    }
  },

  getLookupKind: async ({
    params: { kind },
    request,
  }: ContractRouteArgs<(typeof sessionContract)["getLookupKind"]>): Promise<
    ContractRouteResponse<(typeof sessionContract)["getLookupKind"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION))
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Insufficient permissions" },
      };
    if (!SESSION_LOOKUP_KINDS.includes(kind as SessionLookupKind))
      return {
        status: 403 as const,
        body: { type: "validation_error", message: `Unknown lookup kind: ${kind}` },
      };
    try {
      const map = await loadSessionLookupsMap();
      return { status: 200 as const, body: map[kind as SessionLookupKind] };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to load session lookup kind" },
      });
    }
  },

  updateLookupKind: putSessionLookupKind,
};
