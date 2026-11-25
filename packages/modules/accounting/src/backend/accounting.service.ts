import { bypassTenantScope } from "@mms/db";
import { assertPostingWindowOpen, isPostingWindowOpen } from "../shared/index.js";
import type { AccountingPage, AccountingPorts, AccountingTenantContext } from "./ports.js";
import type {
  Account,
  ConsolidationGroup,
  ConsolidationGroupPut,
  ConsolidationReport,
  ConsolidationReportQuery,
  FiscalYear,
  JournalEntry,
  MemberTrialBalanceRow,
} from "@mms/contracts";

function requireActor(ctx: AccountingTenantContext): string {
  if (!ctx.tenantId.trim()) throw new Error("Accounting operation requires a tenant");
  if (!ctx.actorId.trim()) throw new Error("Accounting operation requires an actor");
  return ctx.actorId;
}

export function createAccountingService(ports: AccountingPorts) {
  return {
    async listAccounts(ctx: AccountingTenantContext): Promise<Account[]> {
      requireActor(ctx);
      return ports.tenant.listAccounts(ctx);
    },

    async listJournalEntries(
      ctx: AccountingTenantContext,
      query: { page: number; limit: number; fiscalYear?: string; status?: string },
    ): Promise<AccountingPage<JournalEntry>> {
      requireActor(ctx);
      const limit = Math.min(Math.max(query.limit, 1), 200);
      return ports.tenant.listJournalEntries(ctx, { ...query, limit });
    },

    async saveJournalEntry(
      ctx: AccountingTenantContext,
      entry: JournalEntry,
    ): Promise<JournalEntry> {
      requireActor(ctx);
      if (entry.status !== "draft") {
        assertPostingWindowOpen({
          fiscalYearStatus: entry.fiscal_year ? "open" : "closed",
        });
      }
      return ports.tenant.saveJournalEntry(ctx, entry);
    },

    async reverseJournalEntry(
      ctx: AccountingTenantContext,
      id: string,
      reason: string,
    ): Promise<JournalEntry> {
      requireActor(ctx);
      if (reason.trim().length < 5) throw new Error("Reversal reason is required");
      return ports.tenant.reverseJournalEntry(ctx, id, reason.trim());
    },

    async listFiscalYears(ctx: AccountingTenantContext): Promise<FiscalYear[]> {
      requireActor(ctx);
      return ports.tenant.listFiscalYears(ctx);
    },

    async closeFiscalYear(ctx: AccountingTenantContext, id: string): Promise<FiscalYear> {
      requireActor(ctx);
      return ports.tenant.closeFiscalYear(ctx, id);
    },

    async buildTrialBalance(
      ctx: AccountingTenantContext,
      query: { dateFrom: string; dateTo: string },
    ): Promise<MemberTrialBalanceRow[]> {
      requireActor(ctx);
      if (Date.parse(query.dateFrom) > Date.parse(query.dateTo)) {
        throw new Error("dateFrom must not be after dateTo");
      }
      return ports.tenant.buildTrialBalance(ctx, query);
    },

    async listConsolidationGroups(actor: {
      id: string;
      email: string;
    }): Promise<ConsolidationGroup[]> {
      if (!actor.id.trim()) throw new Error("Platform actor is required");
      return ports.platform.listConsolidationGroups();
    },

    async saveConsolidationGroup(
      actor: { id: string; email: string },
      id: string,
      input: ConsolidationGroupPut,
    ): Promise<ConsolidationGroup> {
      if (!id.trim()) throw new Error("Consolidation group id is required");
      const group = await bypassTenantScope(
        {
          reason: "platform accounting consolidation group save",
          actorId: actor.id,
          auditMeta: {
            groupId: id,
            members: input.members.map((member) => member.memberSubdomain),
          },
        },
        () => ports.platform.saveConsolidationGroup(id, input),
      );
      await ports.platform.insertPlatformActivity({
        actorId: actor.id,
        actorEmail: actor.email,
        action: "consolidation.group.save",
        targetId: id,
        message: `${input.name}: ${input.members.length} member(s), ${input.presentationCurrency}`,
      });
      return group;
    },

    async deleteConsolidationGroup(
      actor: { id: string; email: string },
      id: string,
    ): Promise<boolean> {
      const deleted = await bypassTenantScope(
        {
          reason: "platform accounting consolidation group delete",
          actorId: actor.id,
          auditMeta: { groupId: id },
        },
        () => ports.platform.deleteConsolidationGroup(id),
      );
      if (deleted) {
        await ports.platform.insertPlatformActivity({
          actorId: actor.id,
          actorEmail: actor.email,
          action: "consolidation.group.delete",
          targetId: id,
          message: "Deleted consolidation group",
        });
      }
      return deleted;
    },

    async buildConsolidationReport(
      actor: { id: string; email: string },
      id: string,
      query: ConsolidationReportQuery,
    ): Promise<ConsolidationReport> {
      return bypassTenantScope(
        {
          reason: "platform accounting consolidation report",
          actorId: actor.id,
          auditMeta: { groupId: id, dateFrom: query.dateFrom, dateTo: query.dateTo },
        },
        () => ports.platform.buildConsolidationReport(id, query),
      );
    },
  };
}

export type AccountingService = ReturnType<typeof createAccountingService>;
export { isPostingWindowOpen };
