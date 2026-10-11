import type { FastifyPluginAsync } from "fastify";
import {
  savedReportsContract,
  type GenericSavedReportCategory,
  type Permission,
  type User,
  ACCOUNTING_MODULE_MANIFEST,
  ATTENDANCE_MODULE_MANIFEST,
  CONTACTS_MODULE_MANIFEST,
  ENROLLMENTS_MODULE_MANIFEST,
  EXAMINATIONS_MODULE_MANIFEST,
  FACULTY_MODULE_MANIFEST,
  FINANCE_MODULE_MANIFEST,
  HASANAT_MODULE_MANIFEST,
  QUESTION_BANK_MODULE_MANIFEST,
  SESSIONS_MODULE_MANIFEST,
  STUDENTS_MODULE_MANIFEST,
} from "@mms/shared";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { handleContractError } from "../../lib/contractError.js";
import { standardRequestValidationErrorHandler } from "../../lib/contractRegistration.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../lib/contractRouterTypes.js";
import { createCollectionAuditHelper } from "../../lib/createCollectionAuditHelper.js";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { getModuleAccessDenial } from "../../middleware/requireTenantModule.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import {
  createSavedReportForOwner,
  deleteSavedReportByOwner,
  listSavedReportsByOwner,
  touchSavedReportRunByOwner,
} from "../../db/repositories/savedReportsRepository.js";

const s = initServer();

/**
 * Category → owning module manifest gate. The `financial` alias resolves to the
 * modern finance module. obligations follows the FE report-collection mapping
 * (ModuleReportsToolPanels → finance_invoices), and messaging/users gate on
 * contacts — the module whose report panel hosts those categories. There is no
 * exported ModuleManifest type in @mms/shared (manifests are structural
 * consts), so the gate declares the slice this router needs and `satisfies`
 * proves the map covers all 14 categories.
 */
interface SavedReportCategoryGate {
  readonly moduleId: string;
  readonly collectionKey: string;
  readonly permissions: { readonly read: Permission };
}

const CATEGORY_MODULE_MAP = {
  students: STUDENTS_MODULE_MANIFEST,
  attendance: ATTENDANCE_MODULE_MANIFEST,
  finance: FINANCE_MODULE_MANIFEST,
  financial: FINANCE_MODULE_MANIFEST,
  accounting: ACCOUNTING_MODULE_MANIFEST,
  examinations: EXAMINATIONS_MODULE_MANIFEST,
  questionBank: QUESTION_BANK_MODULE_MANIFEST,
  hasanat: HASANAT_MODULE_MANIFEST,
  sessions: SESSIONS_MODULE_MANIFEST,
  faculty: FACULTY_MODULE_MANIFEST,
  enrollments: ENROLLMENTS_MODULE_MANIFEST,
  obligations: FINANCE_MODULE_MANIFEST,
  messaging: CONTACTS_MODULE_MANIFEST,
  users: CONTACTS_MODULE_MANIFEST,
} satisfies Record<GenericSavedReportCategory, SavedReportCategoryGate>;

function getTenantId(request: { tenant?: { id: string } }): string | null {
  return request.tenant?.id || getRequestTenant() || null;
}

function auditSavedReport(
  user: User,
  gate: SavedReportCategoryGate,
  action: "create" | "delete" | "run",
  summary: string,
  reportId: string,
): Promise<void> {
  return createCollectionAuditHelper(gate.collectionKey)(
    user,
    `${gate.moduleId}.saved_report.${action}`,
    summary,
    reportId,
  );
}

const savedReportsRouter = s.router(savedReportsContract, {
  list: async ({
    query,
    request,
  }: ContractRouteArgs<(typeof savedReportsContract)["list"]>): Promise<
    ContractRouteResponse<(typeof savedReportsContract)["list"]>
  > => {
    const user = request.user as User;
    const gate = CATEGORY_MODULE_MAP[query.category];
    const denied = await getModuleAccessDenial(request, gate.moduleId, "read");
    if (denied) return { status: 403 as const, body: denied };
    const tenantId = getTenantId(request);
    if (!tenantId) {
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Missing tenant context" },
      };
    }
    try {
      const reports = await listSavedReportsByOwner(tenantId, query.category, String(user.id));
      return { status: 200 as const, body: { reports } };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to list saved reports" },
      });
    }
  },

  create: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof savedReportsContract)["create"]>): Promise<
    ContractRouteResponse<(typeof savedReportsContract)["create"]>
  > => {
    const user = request.user as User;
    const gate = CATEGORY_MODULE_MAP[body.category];
    const denied = await getModuleAccessDenial(request, gate.moduleId, "read");
    if (denied) return { status: 403 as const, body: denied };
    const tenantId = getTenantId(request);
    if (!tenantId) {
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Missing tenant context" },
      };
    }
    try {
      const report = await createSavedReportForOwner(tenantId, {
        ...body,
        createdBy: String(user.id),
        createdByName: user.name || user.email,
      });
      await auditSavedReport(user, gate, "create", `Saved report "${report.name}"`, report.id);
      return { status: 201 as const, body: { report } };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to save report" },
      });
    }
  },

  delete: async ({
    params: { id },
    query,
    request,
  }: ContractRouteArgs<(typeof savedReportsContract)["delete"]>): Promise<
    ContractRouteResponse<(typeof savedReportsContract)["delete"]>
  > => {
    const user = request.user as User;
    const gate = CATEGORY_MODULE_MAP[query.category];
    const denied = await getModuleAccessDenial(request, gate.moduleId, "read");
    if (denied) return { status: 403 as const, body: denied };
    const tenantId = getTenantId(request);
    if (!tenantId) {
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Missing tenant context" },
      };
    }
    try {
      const deleted = await deleteSavedReportByOwner(tenantId, id, query.category, String(user.id));
      if (!deleted) {
        return {
          status: 404 as const,
          body: { type: "not_found", message: "Saved report not found" },
        };
      }
      await auditSavedReport(user, gate, "delete", `Deleted saved report ${id}`, id);
      return { status: 200 as const, body: { success: true } };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to delete saved report" },
      });
    }
  },

  run: async ({
    params: { id },
    query,
    request,
  }: ContractRouteArgs<(typeof savedReportsContract)["run"]>): Promise<
    ContractRouteResponse<(typeof savedReportsContract)["run"]>
  > => {
    const user = request.user as User;
    const gate = CATEGORY_MODULE_MAP[query.category];
    const denied = await getModuleAccessDenial(request, gate.moduleId, "read");
    if (denied) return { status: 403 as const, body: denied };
    const tenantId = getTenantId(request);
    if (!tenantId) {
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Missing tenant context" },
      };
    }
    try {
      const report = await touchSavedReportRunByOwner(
        tenantId,
        id,
        query.category,
        String(user.id),
      );
      if (!report) {
        return {
          status: 404 as const,
          body: { type: "not_found", message: "Saved report not found" },
        };
      }
      await auditSavedReport(user, gate, "run", `Ran saved report "${report.name}"`, report.id);
      return { status: 200 as const, body: { report } };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to run saved report" },
      });
    }
  },
} as unknown as RouterImplementation<typeof savedReportsContract>);

/**
 * Generic saved-report preset routes — @ts-rest contract router.
 * Owner-scoped only: every op is gated on the owning module's grant, enablement and read permission
 * and restricted to the caller's own presets for the category.
 */
export default async function savedReportsRoutes(
  fastify: Parameters<FastifyPluginAsync>[0],
): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);
  // The shared contract types the delete/run bodies as z.void().optional(),
  // but the generated FE client always posts `body: {}` on those routes.
  // Normalize an empty JSON object back to "no body" so ts-rest validation
  // accepts the FE request shape; handlers ignore the body entirely.
  fastify.addHook("preHandler", async (request) => {
    const body = request.body;
    if (
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      Object.keys(body).length === 0
    ) {
      request.body = undefined;
    }
  });
  await fastify.register(s.plugin(savedReportsRouter), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
}
