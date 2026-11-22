import {
  buildMemberTrialBalance,
  consolidateTrialBalances,
  translateTrialBalance,
  type ConsolidationGroup,
  type ConsolidationGroupPut,
  type ConsolidationReport,
  type ConsolidationReportQuery,
} from "@mms/shared";
import type { PlatformConsolidationRepository } from "../repository/platformConsolidationRepositoryAdapter.js";
import { platformConsolidationRepository } from "../repository/platformConsolidationRepositoryAdapter.js";
import { HttpDomainError } from "../../lib/httpErrors.js";

export function listGroups(repo: PlatformConsolidationRepository): Promise<ConsolidationGroup[]> {
  return repo.listConsolidationGroups();
}

export async function saveGroup(
  repo: PlatformConsolidationRepository,
  actor: { id: string; email: string },
  id: string,
  input: ConsolidationGroupPut,
): Promise<ConsolidationGroup> {
  await repo.saveConsolidationGroup(id, input, actor.id);
  await repo.insertPlatformActivityLog({
    userId: actor.id,
    userEmail: actor.email,
    action: "consolidation.group.save",
    targetResource: "consolidation_groups",
    targetId: id,
    metadataMessage: `${input.name}: ${input.members.length} member(s), ${input.presentationCurrency}`,
  });
  const saved = (await repo.listConsolidationGroups()).find((group) => group.id === id);
  if (!saved) throw new HttpDomainError(500, "server_error", "Consolidation group was not saved");
  return saved;
}

export async function deleteGroup(
  repo: PlatformConsolidationRepository,
  actor: { id: string; email: string },
  id: string,
): Promise<void> {
  if (!(await repo.deleteConsolidationGroup(id))) {
    throw new HttpDomainError(404, "not_found", "Consolidation group not found");
  }
  await repo.insertPlatformActivityLog({
    userId: actor.id,
    userEmail: actor.email,
    action: "consolidation.group.delete",
    targetResource: "consolidation_groups",
    targetId: id,
  });
}

/**
 * Translate each member's trial balance into the presentation currency
 * (IAS 21.39: closing / average / historical) and aggregate them (IFRS 10):
 * intercompany codes eliminated, CTA in OCI, non-controlling interest measured.
 */
export async function buildConsolidationReport(
  repo: PlatformConsolidationRepository,
  groupId: string,
  query: ConsolidationReportQuery,
): Promise<ConsolidationReport> {
  const group = (await repo.listConsolidationGroups()).find((row) => row.id === groupId);
  if (!group) throw new HttpDomainError(404, "not_found", "Consolidation group not found");
  if (group.members.length === 0)
    throw new HttpDomainError(422, "validation_error", "The group has no members");

  const translated = [];
  for (const member of group.members) {
    const ledger = await repo.loadMemberLedger(
      member.memberSubdomain,
      query.dateFrom,
      query.dateTo,
    );
    const rows = buildMemberTrialBalance(
      ledger.balanceSheetRows,
      ledger.periodResultRows,
      ledger.functionalCurrency,
    );
    const sameCurrency = ledger.functionalCurrency === group.presentationCurrency;
    if (!sameCurrency && (!member.closingRate || !member.averageRate || !member.historicalRate)) {
      throw new HttpDomainError(
        422,
        "validation_error",
        `Enter closing, average and historical ${ledger.functionalCurrency}→${group.presentationCurrency} rates for ${member.memberSubdomain}`,
      );
    }
    translated.push({
      translated: translateTrialBalance(
        member.memberSubdomain,
        rows,
        {
          closing: member.closingRate ?? "1",
          average: member.averageRate ?? "1",
          defaultHistorical: member.historicalRate ?? "1",
        },
        ledger.functionalCurrency,
        group.presentationCurrency,
      ),
      ownershipPercent: member.isParent ? 100 : member.ownershipPercent,
    });
  }

  return {
    group,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    members: translated.map((member) => member.translated),
    consolidated: consolidateTrialBalances(
      translated,
      group.intercompanyAccountCodes,
      group.presentationCurrency,
    ),
  };
}

/**
 * Adapter-free surface for the platform routes (check:backend-boundaries: routes
 * must not import a repository adapter). The lower-level functions keep taking a
 * repository so tests can inject a fake.
 */
export const consolidationUseCases = {
  listGroups: () => listGroups(platformConsolidationRepository),
  saveGroup: (actor: { id: string; email: string }, id: string, input: ConsolidationGroupPut) =>
    saveGroup(platformConsolidationRepository, actor, id, input),
  deleteGroup: (actor: { id: string; email: string }, id: string) =>
    deleteGroup(platformConsolidationRepository, actor, id),
  buildConsolidationReport: (groupId: string, query: ConsolidationReportQuery) =>
    buildConsolidationReport(platformConsolidationRepository, groupId, query),
};
