import { eq, and } from "drizzle-orm";
import { withTenant } from "../../db/tenant-context.js";
import { userUiPreferences } from "../../db/schema/system.js";
import type { UserUiState, PatchUserUiStateBody } from "@mms/shared";

export async function getUserUiState(subdomain: string, userId: string): Promise<UserUiState> {
  return withTenant(subdomain, async (tx) => {
    const [record] = await tx
      .select({ state: userUiPreferences.state })
      .from(userUiPreferences)
      .where(
        and(
          eq(userUiPreferences.workspaceSubdomain, subdomain),
          eq(userUiPreferences.userId, userId),
        ),
      );

    if (!record) {
      return {};
    }
    return record.state as UserUiState;
  });
}

export async function patchUserUiState(
  subdomain: string,
  userId: string,
  patch: PatchUserUiStateBody,
): Promise<UserUiState> {
  const currentState = await getUserUiState(subdomain, userId);

  const newState = {
    ...currentState,
    ...patch.state,
  };

  try {
    const updatedRecord = await withTenant(subdomain, async (tx) => {
      const [row] = await tx
        .insert(userUiPreferences)
        .values({
          workspaceSubdomain: subdomain,
          userId,
          state: newState,
        })
        .onConflictDoUpdate({
          target: [userUiPreferences.workspaceSubdomain, userUiPreferences.userId],
          set: {
            state: newState,
            updatedAt: new Date(),
          },
        })
        .returning({ state: userUiPreferences.state });
      return row;
    });

    return (updatedRecord?.state ?? newState) as UserUiState;
  } catch (err: unknown) {
    const pgError = err as { code?: string };
    // 23503: foreign_key_violation (e.g. user replaced by backup restore)
    if (pgError?.code === "23503") {
      return newState as UserUiState;
    }
    throw err;
  }
}
