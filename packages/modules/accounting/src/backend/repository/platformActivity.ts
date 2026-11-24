import { activeDb } from "@mms/db/client";
import { platformActivityLogs } from "@mms/db/schema";

export interface PlatformActivityInput {
  userId?: string | null;
  userEmail: string;
  action: string;
  targetResource?: string | null;
  targetId?: string | null;
  ipAddress?: string | null;
  metadataMessage?: string | null;
}

export async function insertPlatformActivityLog(input: PlatformActivityInput): Promise<void> {
  await activeDb()
    .insert(platformActivityLogs)
    .values({
      userId: input.userId ?? null,
      userEmail: input.userEmail,
      action: input.action,
      targetResource: input.targetResource ?? null,
      targetId: input.targetId ?? null,
      ipAddress: input.ipAddress ?? null,
      metadataMessage: input.metadataMessage ?? null,
    });
}
