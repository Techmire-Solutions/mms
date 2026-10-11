import { eq } from "drizzle-orm";
import { withTenant, withTenantRead, withGlobalTenant } from "../tenant-context.js";
import { questionBankModulePreferences } from "../schema.js";
import type { QuestionBankModulePreferences } from "@mms/shared";

export async function replaceQuestionBankModulePreferencesForWorkspace(
  workspaceSubdomain: string,
  preferences: Partial<QuestionBankModulePreferences>,
): Promise<void> {
  await withTenant(workspaceSubdomain, async (tx) => {
    await tx
      .insert(questionBankModulePreferences)
      .values({
        workspaceSubdomain,
        preferences: preferences as never,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [questionBankModulePreferences.workspaceSubdomain],
        set: {
          preferences: preferences as never,
          updatedAt: new Date(),
        },
      });
  });
}

export async function getQuestionBankModulePreferencesForWorkspace(
  workspaceSubdomain: string,
): Promise<Partial<QuestionBankModulePreferences> | null> {
  return await withTenantRead(workspaceSubdomain, async (tx) => {
    const [row] = await tx
      .select({ preferences: questionBankModulePreferences.preferences })
      .from(questionBankModulePreferences)
      .where(eq(questionBankModulePreferences.workspaceSubdomain, workspaceSubdomain))
      .limit(1);

    if (!row) {
      return null;
    }
    return row.preferences as Partial<QuestionBankModulePreferences>;
  });
}

export async function listAllQuestionBankModulePreferencesByWorkspace(): Promise<
  Record<string, Partial<QuestionBankModulePreferences>>
> {
  return await withGlobalTenant(async (tx) => {
    const rows = await tx
      .select({
        workspaceSubdomain: questionBankModulePreferences.workspaceSubdomain,
        preferences: questionBankModulePreferences.preferences,
      })
      .from(questionBankModulePreferences);
    const result: Record<string, Partial<QuestionBankModulePreferences>> = {};
    for (const row of rows) {
      if (row.workspaceSubdomain) {
        result[row.workspaceSubdomain] = row.preferences as Partial<QuestionBankModulePreferences>;
      }
    }
    return result;
  });
}
