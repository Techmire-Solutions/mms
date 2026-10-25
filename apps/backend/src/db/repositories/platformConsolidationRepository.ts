import { eq, inArray } from "drizzle-orm";
import type { ConsolidationGroup, ConsolidationGroupPut } from "@mms/shared";
import {
  consolidationGroupMembers,
  consolidationGroups,
  consolidationIntercompanyAccounts,
} from "../schema.js";
import { withGlobalTenant } from "../tenant-context.js";
import { canonicalStoredRate } from "./repositoryFxMappers.js";

const optionalRate = (value: string | null) => (value ? canonicalStoredRate(value) : undefined);

/** All consolidation groups with members and intercompany codes (platform scope). */
export async function listConsolidationGroups(): Promise<ConsolidationGroup[]> {
  return withGlobalTenant(async (tx) => {
    const groups = await tx
      .select({
        id: consolidationGroups.id,
        name: consolidationGroups.name,
        presentationCurrency: consolidationGroups.presentationCurrency,
        updatedAt: consolidationGroups.updatedAt,
      })
      .from(consolidationGroups)
      .orderBy(consolidationGroups.name);
    if (groups.length === 0) return [];
    const ids = groups.map((group) => group.id);
    const [members, accounts] = await Promise.all([
      tx
        .select({
          groupId: consolidationGroupMembers.groupId,
          memberSubdomain: consolidationGroupMembers.memberSubdomain,
          ownershipPercent: consolidationGroupMembers.ownershipPercent,
          isParent: consolidationGroupMembers.isParent,
          closingRate: consolidationGroupMembers.closingRate,
          averageRate: consolidationGroupMembers.averageRate,
          historicalRate: consolidationGroupMembers.historicalRate,
        })
        .from(consolidationGroupMembers)
        .where(inArray(consolidationGroupMembers.groupId, ids)),
      tx
        .select({
          groupId: consolidationIntercompanyAccounts.groupId,
          accountCode: consolidationIntercompanyAccounts.accountCode,
        })
        .from(consolidationIntercompanyAccounts)
        .where(inArray(consolidationIntercompanyAccounts.groupId, ids)),
    ]);
    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      presentationCurrency: group.presentationCurrency,
      updatedAt: group.updatedAt.toISOString(),
      members: members
        .filter((member) => member.groupId === group.id)
        .map((member) => ({
          memberSubdomain: member.memberSubdomain,
          ownershipPercent: Number(member.ownershipPercent),
          isParent: member.isParent,
          closingRate: optionalRate(member.closingRate),
          averageRate: optionalRate(member.averageRate),
          historicalRate: optionalRate(member.historicalRate),
        }))
        .sort((left, right) => Number(right.isParent) - Number(left.isParent)),
      intercompanyAccountCodes: accounts
        .filter((account) => account.groupId === group.id)
        .map((account) => account.accountCode)
        .sort(),
    }));
  });
}

/** Replace a group's configuration atomically (members and intercompany codes are owned rows). */
export async function saveConsolidationGroup(
  id: string,
  input: ConsolidationGroupPut,
  userId: string | null,
): Promise<void> {
  await withGlobalTenant(async (tx) => {
    await tx
      .insert(consolidationGroups)
      .values({ id, name: input.name, presentationCurrency: input.presentationCurrency, updatedBy: userId })
      .onConflictDoUpdate({
        target: consolidationGroups.id,
        set: {
          name: input.name,
          presentationCurrency: input.presentationCurrency,
          updatedAt: new Date(),
          updatedBy: userId,
        },
      });
    await tx.delete(consolidationGroupMembers).where(eq(consolidationGroupMembers.groupId, id));
    await tx
      .delete(consolidationIntercompanyAccounts)
      .where(eq(consolidationIntercompanyAccounts.groupId, id));
    if (input.members.length > 0) {
      await tx.insert(consolidationGroupMembers).values(
        input.members.map((member) => ({
          groupId: id,
          memberSubdomain: member.memberSubdomain,
          ownershipPercent: String(member.ownershipPercent),
          isParent: member.isParent,
          closingRate: member.closingRate ?? null,
          averageRate: member.averageRate ?? null,
          historicalRate: member.historicalRate ?? null,
        })),
      );
    }
    const codes = [...new Set(input.intercompanyAccountCodes)];
    if (codes.length > 0) {
      await tx
        .insert(consolidationIntercompanyAccounts)
        .values(codes.map((accountCode) => ({ groupId: id, accountCode })));
    }
  });
}

/** Delete a group; returns false when it did not exist. */
export async function deleteConsolidationGroup(id: string): Promise<boolean> {
  return withGlobalTenant(async (tx) => {
    const deleted = await tx
      .delete(consolidationGroups)
      .where(eq(consolidationGroups.id, id))
      .returning({ id: consolidationGroups.id });
    return deleted.length > 0;
  });
}
