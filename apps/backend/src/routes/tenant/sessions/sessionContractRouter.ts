import type { FastifyPluginAsync } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { handleContractError } from "../../../lib/contractError.js";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { withTenant } from "../../../db/tenant-context.js";
import {
  sessionContract,
  isQueryFlagTrue,
  SESSIONS_MODULE_MANIFEST,
  SESSION_LOOKUP_KINDS,
  type User,
  type SessionLookupKind,
  roleHasPermission,
  normalizeSessionModulePreferences,
} from "@mms/shared";
import {
  canDeleteCollection,
  canWriteCollection,
  canReadCollection,
} from "../../../services/rbacService.js";
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

const COLLECTION = SESSIONS_MODULE_MANIFEST.collectionKey;
const SETUP_WRITE_PERM = SESSIONS_MODULE_MANIFEST.permissions.setupWrite;
const s = initServer();

export const sessionContractRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(sessionContract, {
    list: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof sessionContract)["list"]>): Promise<
      ContractRouteResponse<(typeof sessionContract)["list"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, COLLECTION)) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => sessionsUseCases.loadSessionsPage({ ...query, includeDeleted }),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to list sessions" },
        });
      }
    },

    create: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof sessionContract)["create"]>): Promise<
      ContractRouteResponse<(typeof sessionContract)["create"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const item = await withTenant(
          String(request.tenant?.id),
          () => sessionsUseCases.createSession(body),
          { readOnly: false },
        );
        return { status: 201 as const, body: { session: item } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to create session" },
        });
      }
    },

    get: async ({
      params: { id },
      query,
      request,
    }: ContractRouteArgs<(typeof sessionContract)["get"]>): Promise<
      ContractRouteResponse<(typeof sessionContract)["get"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const item = await withTenant(
          String(request.tenant?.id),
          () => sessionsUseCases.loadSessionById(id, includeDeleted),
          { readOnly: true },
        );
        if (!item)
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Session not found" },
          };
        return { status: 200 as const, body: { session: item } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to load session" },
        });
      }
    },

    update: async ({
      params: { id },
      body,
      request,
    }: ContractRouteArgs<(typeof sessionContract)["update"]>): Promise<
      ContractRouteResponse<(typeof sessionContract)["update"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        // Locked changes after start need Sessions setup rights plus a reason (audited).
        const lock = { canOverrideLock: roleHasPermission(user.role, SETUP_WRITE_PERM) };
        const updated = await withTenant(
          String(request.tenant?.id),
          () => sessionsUseCases.updateSessionById(id, body, lock),
          { readOnly: false },
        );
        if (!updated)
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Session not found" },
          };
        return { status: 200 as const, body: { session: updated } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to update session" },
        });
      }
    },

    delete: async ({
      params: { id },
      body,
      request,
    }: ContractRouteArgs<(typeof sessionContract)["delete"]>): Promise<
      ContractRouteResponse<(typeof sessionContract)["delete"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        await withTenant(
          String(request.tenant?.id),
          () => sessionsUseCases.deleteSessionById(id, String(user.id), body?.deletionReason),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to delete session" },
        });
      }
    },

    restore: async ({
      params: { id },
      request,
    }: ContractRouteArgs<(typeof sessionContract)["restore"]>): Promise<
      ContractRouteResponse<(typeof sessionContract)["restore"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        await withTenant(
          String(request.tenant?.id),
          () => sessionsUseCases.restoreSessionById(id, String(user.id)),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to restore session" },
        });
      }
    },

    bulkDelete: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof sessionContract)["bulkDelete"]>): Promise<
      ContractRouteResponse<(typeof sessionContract)["bulkDelete"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () =>
            sessionsUseCases.bulkSoftDeleteSessions(
              body.ids.map(String),
              String(user.id),
              body.deletionReason,
            ),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true, ...result } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to bulk delete sessions" },
        });
      }
    },

    bulkStatus: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof sessionContract)["bulkStatus"]>): Promise<
      ContractRouteResponse<(typeof sessionContract)["bulkStatus"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => sessionsUseCases.bulkUpdateSessionsStatus(body.ids.map(String), body.status),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true, ...result } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to bulk update session status" },
        });
      }
    },

    bulkRestore: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof sessionContract)["bulkRestore"]>): Promise<
      ContractRouteResponse<(typeof sessionContract)["bulkRestore"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => sessionsUseCases.bulkRestoreSessions(body.ids.map(String), String(user.id)),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true, ...result } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to bulk restore sessions" },
        });
      }
    },

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
          body: { lookups: { statuses: lookups.statuses ?? [], types: lookups.types ?? [] } },
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
  } as unknown as RouterImplementation<typeof sessionContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
