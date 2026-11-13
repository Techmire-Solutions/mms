import type { FastifyPluginAsync } from "fastify";
import type { User } from "@mms/shared";
import { questionBankContract } from "@mms/shared";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canDeleteCollection, canReadCollection } from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { questionBankUseCases } from "../../../questionBank/use-cases/questionBankUseCases.js";
import {
  assemblePaperHandler,
  duplicateQuestionHandler,
  mappedFailure,
  setQuestionStatusHandler,
  setTestPublishedHandler,
} from "./questionBankLifecycleHandlers.js";
import {
  addQuestionAttachmentHandler,
  removeQuestionAttachmentHandler,
} from "./questionBankAttachmentHandlers.js";
import { checkQuestionDuplicatesHandler } from "./questionBankDuplicateHandlers.js";
import { listQuestionsHandler, pickerQuestionsHandler } from "./questionBankListHandlers.js";

const s = initServer();

export const questionBankContractRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(questionBankContract, {
    reportAggregates: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof questionBankContract)["reportAggregates"]>): Promise<
      ContractRouteResponse<(typeof questionBankContract)["reportAggregates"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "questions")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const aggregates = await withTenant(
          String(request.tenant?.id),
          () => questionBankUseCases.loadQuestionBankReportAggregates(query || {}),
          { readOnly: true },
        );
        return { status: 200 as const, body: aggregates };
      } catch (error) {
        const mapped = mappedFailure(error);
        if (mapped) return mapped;
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to load report aggregates" },
        };
      }
    },
    listQuestions: listQuestionsHandler,
    pickerQuestions: pickerQuestionsHandler,
    bulkDeleteQuestions: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof questionBankContract)["bulkDeleteQuestions"]>): Promise<
      ContractRouteResponse<(typeof questionBankContract)["bulkDeleteQuestions"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, "questions")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () =>
            questionBankUseCases.bulkSoftDeleteQuestions(
              body.ids.map(String),
              String(user.id),
              body.deletionReason,
            ),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true, ...result } };
      } catch (error) {
        const mapped = mappedFailure(error);
        if (mapped) return mapped;
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to bulk delete questions" },
        };
      }
    },
    bulkRestoreQuestions: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof questionBankContract)["bulkRestoreQuestions"]>): Promise<
      ContractRouteResponse<(typeof questionBankContract)["bulkRestoreQuestions"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, "questions")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => questionBankUseCases.bulkRestoreQuestions(body.ids.map(String), user?.id),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true, ...result } };
      } catch (error) {
        const mapped = mappedFailure(error);
        if (mapped) return mapped;
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to bulk restore questions" },
        };
      }
    },
    setQuestionStatus: setQuestionStatusHandler,
    duplicateQuestion: duplicateQuestionHandler,
    assemblePaper: assemblePaperHandler,
    checkQuestionDuplicates: checkQuestionDuplicatesHandler,
    addQuestionAttachment: addQuestionAttachmentHandler,
    removeQuestionAttachment: removeQuestionAttachmentHandler,
    setTestPublished: setTestPublishedHandler,
    listTests: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof questionBankContract)["listTests"]>): Promise<
      ContractRouteResponse<(typeof questionBankContract)["listTests"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "tests")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const tests = await withTenant(
          String(request.tenant?.id),
          () => questionBankUseCases.loadTests({ page: query?.page, limit: query?.limit }),
          { readOnly: true },
        );
        return { status: 200 as const, body: { tests } };
      } catch (error) {
        const mapped = mappedFailure(error);
        if (mapped) return mapped;
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to list tests" },
        };
      }
    },
    listResults: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof questionBankContract)["listResults"]>): Promise<
      ContractRouteResponse<(typeof questionBankContract)["listResults"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "assessment_results")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const results = await withTenant(
          String(request.tenant?.id),
          () => questionBankUseCases.loadResults({ page: query?.page, limit: query?.limit }),
          { readOnly: true },
        );
        return { status: 200 as const, body: { results } };
      } catch (error) {
        const mapped = mappedFailure(error);
        if (mapped) return mapped;
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to list assessment results" },
        };
      }
    },
    widgetAggregates: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof questionBankContract)["widgetAggregates"]>): Promise<
      ContractRouteResponse<(typeof questionBankContract)["widgetAggregates"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "questions")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => questionBankUseCases.loadQuestionBankWidgetAggregates(body.widgets),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch (error) {
        const mapped = mappedFailure(error);
        if (mapped) return mapped;
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to load widget aggregates" },
        };
      }
    },
  } as unknown as RouterImplementation<typeof questionBankContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
    // Declared response schemas are the wire contract (including the answer-key summary shape).
    responseValidation: true,
  });
};
