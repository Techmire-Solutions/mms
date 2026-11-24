import type { FastifyPluginAsync } from "fastify";
import {
  ACCOUNTING_MODULE_MANIFEST,
  accountingSuccessResponseSchema,
  bankReconciliationMatchSchema,
  bankStatementInsertSchema,
  bankStatementResponseSchema,
  bankStatementsResponseSchema,
  emptyQuerySchema,
  type User,
} from "@mms/contracts";
import { canReadCollection, canWriteCollection } from "@mms/be-core/rbac";
import { sendForbidden, sendIfHttpDomainError, sendDatabaseError } from "@mms/be-core/http/errors";
import { parseRequest, replyValidationError } from "@mms/be-core/http/routes";
import { sendValidated } from "@mms/be-core/http/routes";
import { withTenant } from "@mms/db/context";
import {
  loadBankStatements,
  matchBankStatementLine,
  upsertBankStatement,
} from "../use-cases/accountingLedgerOpsUseCases.js";

const COLLECTION = ACCOUNTING_MODULE_MANIFEST.collectionKey;

/** Bank statements and reconciliation matches (split from the ledger-ops plugin for the 300-line ceiling). */
export const accountingBankingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/bank-statements", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const query = parseRequest(emptyQuerySchema, request.query ?? {});
    if (!query.ok) return replyValidationError(reply, query);
    try {
      const statements = await withTenant(String(request.tenant?.id), () => loadBankStatements(), {
        readOnly: true,
      });
      return sendValidated(reply, 200, bankStatementsResponseSchema, { statements });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to load bank statements", error)
      );
    }
  });

  fastify.put("/bank-statements", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(bankStatementInsertSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const statement = await withTenant(
        String(request.tenant?.id),
        () => upsertBankStatement(parsed.data),
        {
          readOnly: false,
        },
      );
      return sendValidated(reply, 200, bankStatementResponseSchema, { statement });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to save bank statement", error)
      );
    }
  });

  fastify.post("/bank-reconciliations", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(bankReconciliationMatchSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      await withTenant(String(request.tenant?.id), () => matchBankStatementLine(parsed.data), {
        readOnly: false,
      });
      return sendValidated(reply, 200, accountingSuccessResponseSchema, { success: true });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to match bank line", error)
      );
    }
  });
};
