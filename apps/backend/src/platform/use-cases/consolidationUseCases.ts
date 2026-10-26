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

function httpError(message: string, statusCode: number, type: string): Error {
  return Object.assign(new Error(message), { statusCode, type });
}

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
  if (!saved) throw httpError("Consolidation group was not saved", 500, "server_error");
  return saved;
}

export async function deleteGroup(
  repo: PlatformConsolidationRepository,
  actor: { id: string; email: string },
  id: string,
): Promise<void> {
  if (!(await repo.deleteConsolidationGroup(id))) {
    throw httpError("Consolidation group not found", 404, "not_found");
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
  if (!group) throw httpError("Consolidation group not found", 404, "not_found");
  if (group.members.length === 0)
    throw httpError("The group has no members", 422, "validation_error");

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
      throw httpError(
        `Enter closing, average and historical ${ledger.functionalCurrency}→${group.presentationCurrency} rates for ${member.memberSubdomain}`,
        422,
        "validation_error",
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
