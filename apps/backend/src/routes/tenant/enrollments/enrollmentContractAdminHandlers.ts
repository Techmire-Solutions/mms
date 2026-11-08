import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import type { enrollmentContract } from "@mms/shared";
import {
  ENROLLMENTS_MODULE_MANIFEST,
  normalizeEnrollmentModulePreferences,
  normalizeEnrollmentsReportComparisonQuery,
  parseComparisonQueryParams,
  type User,
} from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import { isUniqueViolation } from "../../../lib/pgErrors.js";
import { userHasPermission } from "../../../lib/userPermissionContext.js";
import { canDeleteCollection, canReadCollection } from "../../../services/rbacService.js";
import {
  loadEnrollmentFieldConfig,
  saveEnrollmentFieldConfig,
} from "../../../services/enrollmentConfigService.js";
import {
  loadEnrollmentModulePreferences,
  saveEnrollmentModulePreferences,
} from "../../../services/enrollmentPreferencesService.js";
import { enrollmentsUseCases } from "../../../enrollments/use-cases/enrollmentsUseCases.js";
import { auditEnrollment } from "./enrollmentRouteHelpers.js";

const COLLECTION = ENROLLMENTS_MODULE_MANIFEST.collectionKey;
const forbidden = {
  status: 403 as const,
  body: { type: "forbidden", message: "Insufficient permissions" },
};
const canWriteSetup = (user: User) =>
  userHasPermission(user, ENROLLMENTS_MODULE_MANIFEST.permissions.setupWrite);

/**
 * Handlers for the contract routes that used to be served (unvalidated) by plain routes:
 * field config, preferences, widget/report aggregates and single restore. Keeping them in the
 * contract router means the declared response schemas are actually validated at runtime.
 */
export const enrollmentContractAdminHandlers = {
  getFieldConfig: async ({
    request,
  }: ContractRouteArgs<(typeof enrollmentContract)["getFieldConfig"]>): Promise<
    ContractRouteResponse<(typeof enrollmentContract)["getFieldConfig"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return forbidden;
    try {
      const config = await loadEnrollmentFieldConfig();
      return { status: 200 as const, body: { config: config ?? null } };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to load enrollment field config" },
      });
    }
  },

  updateFieldConfig: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof enrollmentContract)["updateFieldConfig"]>): Promise<
    ContractRouteResponse<(typeof enrollmentContract)["updateFieldConfig"]>
  > => {
    const user = request.user as User;
    if (!canWriteSetup(user)) return forbidden;
    try {
      const config = await saveEnrollmentFieldConfig(body);
      await auditEnrollment(
        user,
        "enrollment.field-config",
        "Updated enrollment field configuration",
        "field-config",
      );
      return { status: 200 as const, body: { success: true as const, config } };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to save enrollment field config" },
      });
    }
  },

  getPreferences: async ({
    request,
  }: ContractRouteArgs<(typeof enrollmentContract)["getPreferences"]>): Promise<
    ContractRouteResponse<(typeof enrollmentContract)["getPreferences"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return forbidden;
    try {
      const loaded = await loadEnrollmentModulePreferences();
      return {
        status: 200 as const,
        body: { preferences: normalizeEnrollmentModulePreferences(loaded) },
      };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to load enrollment preferences" },
      });
    }
  },

  updatePreferences: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof enrollmentContract)["updatePreferences"]>): Promise<
    ContractRouteResponse<(typeof enrollmentContract)["updatePreferences"]>
  > => {
    const user = request.user as User;
    if (!canWriteSetup(user)) return forbidden;
    try {
      const saved = await saveEnrollmentModulePreferences(
        normalizeEnrollmentModulePreferences(body),
      );
      await auditEnrollment(
        user,
        "enrollment.preferences",
        "Updated enrollment module preferences",
        "preferences",
      );
      return { status: 200 as const, body: { success: true as const, preferences: saved } };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to save enrollment preferences" },
      });
    }
  },

  widgetAggregates: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof enrollmentContract)["widgetAggregates"]>): Promise<
    ContractRouteResponse<(typeof enrollmentContract)["widgetAggregates"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return forbidden;
    try {
      const results = await enrollmentsUseCases.loadEnrollmentsWidgetAggregates(
        body.widgets,
        request,
      );
      return { status: 200 as const, body: { results } };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to load enrollment aggregates" },
      });
    }
  },

  reportAggregates: async ({
    query,
    request,
  }: ContractRouteArgs<(typeof enrollmentContract)["reportAggregates"]>): Promise<
    ContractRouteResponse<(typeof enrollmentContract)["reportAggregates"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return forbidden;
    try {
      const comparisonQuery = normalizeEnrollmentsReportComparisonQuery(
        parseComparisonQueryParams(query ?? {}),
      );
      const aggregates = await enrollmentsUseCases.loadEnrollmentsReportAggregates(comparisonQuery);
      return { status: 200 as const, body: aggregates };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to load enrollment report aggregates" },
      });
    }
  },

  restore: async ({
    params: { id },
    request,
  }: ContractRouteArgs<(typeof enrollmentContract)["restore"]>): Promise<
    ContractRouteResponse<(typeof enrollmentContract)["restore"]>
  > => {
    const user = request.user as User;
    if (!canDeleteCollection(user, COLLECTION)) return forbidden;
    try {
      const restored = await enrollmentsUseCases.restoreEnrollmentById(id, String(user.id));
      if (!restored) {
        return {
          status: 404 as const,
          body: { type: "not_found", message: "Enrollment not found or not deleted" },
        };
      }
      return { status: 200 as const, body: { success: true as const } };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return {
          status: 409 as const,
          body: {
            type: "conflict",
            message: "A record with this unique identifier already exists",
          },
        };
      }
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to restore enrollment" },
      });
    }
  },
} as const;
