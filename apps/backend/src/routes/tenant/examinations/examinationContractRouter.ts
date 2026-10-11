import type { FastifyPluginAsync } from "fastify";
import { isQueryFlagTrue, type User } from "@mms/shared";
import { examinationContract } from "@mms/shared";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canReadCollection, canDeleteCollection } from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { examinationsUseCases } from "../../../examinations/use-cases/examinationsUseCases.js";

const s = initServer();

export const examinationContractRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(examinationContract, {
    listExams: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof examinationContract)["listExams"]>): Promise<
      ContractRouteResponse<(typeof examinationContract)["listExams"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "exams")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, "exams")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        if (
          query?.page !== undefined ||
          query?.limit !== undefined ||
          query?.search !== undefined ||
          query?.status !== undefined
        ) {
          const result = await withTenant(
            String(request.tenant?.id),
            () => examinationsUseCases.loadExamsPage({ ...query, includeDeleted }),
            { readOnly: true },
          );
          return { status: 200 as const, body: result };
        }
        const exams = await withTenant(
          String(request.tenant?.id),
          () => examinationsUseCases.loadExams({ includeDeleted }),
          { readOnly: true },
        );
        return { status: 200 as const, body: { exams } };
      } catch {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to list exams" },
        };
      }
    },
    bulkDeleteExams: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof examinationContract)["bulkDeleteExams"]>): Promise<
      ContractRouteResponse<(typeof examinationContract)["bulkDeleteExams"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, "exams")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () =>
            examinationsUseCases.bulkSoftDeleteExams(
              body.ids.map(String),
              String(user.id),
              body.deletionReason,
            ),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true, ...result } };
      } catch {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to bulk delete exams" },
        };
      }
    },
    bulkRestoreExams: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof examinationContract)["bulkRestoreExams"]>): Promise<
      ContractRouteResponse<(typeof examinationContract)["bulkRestoreExams"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, "exams")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => examinationsUseCases.bulkRestoreExams(body.ids.map(String), user?.id),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true, ...result } };
      } catch {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to bulk restore exams" },
        };
      }
    },
    listResults: async ({
      request,
    }: ContractRouteArgs<(typeof examinationContract)["listResults"]>): Promise<
      ContractRouteResponse<(typeof examinationContract)["listResults"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "exam_results")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => examinationsUseCases.loadExamResults(),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to list exam results" },
        };
      }
    },
    widgetAggregates: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof examinationContract)["widgetAggregates"]>): Promise<
      ContractRouteResponse<(typeof examinationContract)["widgetAggregates"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "exams")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => examinationsUseCases.loadExaminationsWidgetAggregates(body.widgets),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch (error) {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to load widget aggregates" },
        };
      }
    },
  } as unknown as RouterImplementation<typeof examinationContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
