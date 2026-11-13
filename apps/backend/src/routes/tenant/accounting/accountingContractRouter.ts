import type { FastifyPluginAsync } from "fastify";
import { isQueryFlagTrue, UNPAGINATED_LIST_CAP, type User, accountingContract } from "@mms/shared";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import {
  installContractErrorHandler,
  standardRequestValidationErrorHandler,
} from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canReadCollection, canDeleteCollection } from "../../../services/rbacService.js";
import { handleContractError } from "../../../lib/contractError.js";
import { withTenant } from "../../../db/tenant-context.js";
import { accountingUseCases } from "../../../accounting/use-cases/accountingUseCases.js";
import { accountingReportDocumentHandlers } from "./accountingReportDocumentHandlers.js";

const s = initServer();

export const accountingContractRouter: FastifyPluginAsync = async (fastify) => {
  installContractErrorHandler(fastify);
  const router = s.router(accountingContract, {
    getEntry: async ({
      params,
      request,
    }: ContractRouteArgs<(typeof accountingContract)["getEntry"]>): Promise<
      ContractRouteResponse<(typeof accountingContract)["getEntry"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "accounting_entries")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const entry = await withTenant(
          String(request.tenant?.id),
          () => accountingUseCases.loadEntryById(params.id),
          { readOnly: true },
        );
        if (!entry) {
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Journal entry not found" },
          };
        }
        return { status: 200 as const, body: entry };
      } catch (error: unknown) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to load the journal entry" },
        });
      }
    },
    listAccounts: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof accountingContract)["listAccounts"]>): Promise<
      ContractRouteResponse<(typeof accountingContract)["listAccounts"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "accounts")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, "accounts")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        if (query?.page !== undefined) {
          const result = await withTenant(
            String(request.tenant?.id),
            () => accountingUseCases.loadAccountsPage({ ...query, includeDeleted }),
            { readOnly: true },
          );
          return { status: 200 as const, body: result };
        }
        // Compatibility branch (account pickers need the whole chart): read one
        // capped page instead of the unbounded collection and report truncation.
        const page = await withTenant(
          String(request.tenant?.id),
          () =>
            accountingUseCases.loadAccountsPage({
              page: 1,
              limit: UNPAGINATED_LIST_CAP,
              includeDeleted,
            }),
          { readOnly: true },
        );
        return {
          status: 200 as const,
          body: { accounts: page.accounts, truncated: page.hasMore },
        };
      } catch (error: unknown) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to list accounts" },
        });
      }
    },
    listEntries: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof accountingContract)["listEntries"]>): Promise<
      ContractRouteResponse<(typeof accountingContract)["listEntries"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "accounting_entries")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, "accounting_entries")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        if (query?.page !== undefined) {
          const result = await withTenant(
            String(request.tenant?.id),
            () =>
              accountingUseCases.loadEntriesPage({
                ...query,
                includeDeleted,
                // The wire carries `true`/`"true"`; the loader takes a boolean.
                includeLines:
                  isQueryFlagTrue(query?.includeLines) || query?.includeLines === undefined,
              }),
            { readOnly: true },
          );
          return { status: 200 as const, body: result };
        }
        const page = await withTenant(
          String(request.tenant?.id),
          () =>
            accountingUseCases.loadEntriesPage({
              page: 1,
              limit: UNPAGINATED_LIST_CAP,
              includeDeleted,
            }),
          { readOnly: true },
        );
        return {
          status: 200 as const,
          body: { entries: page.entries, truncated: page.hasMore },
        };
      } catch (error: unknown) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to list journal entries" },
        });
      }
    },
    listFiscalYears: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof accountingContract)["listFiscalYears"]>): Promise<
      ContractRouteResponse<(typeof accountingContract)["listFiscalYears"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "fiscal_years")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, "fiscal_years")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        if (query?.page !== undefined) {
          const result = await withTenant(
            String(request.tenant?.id),
            () => accountingUseCases.loadFiscalYearsPage({ ...query, includeDeleted }),
            { readOnly: true },
          );
          return { status: 200 as const, body: result };
        }
        const page = await withTenant(
          String(request.tenant?.id),
          () =>
            accountingUseCases.loadFiscalYearsPage({
              page: 1,
              limit: UNPAGINATED_LIST_CAP,
              includeDeleted,
            }),
          { readOnly: true },
        );
        return {
          status: 200 as const,
          body: { fiscalYears: page.fiscalYears, truncated: page.hasMore },
        };
      } catch (error: unknown) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to list fiscal years" },
        });
      }
    },
    ...accountingReportDocumentHandlers,
  } as unknown as RouterImplementation<typeof accountingContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
    // The session routers already validate responses; finance/accounting did not,
    // so their declared response schemas were compile-time only.
    responseValidation: true,
  });
};
