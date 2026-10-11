/**
 * Migration 090: Encrypt plaintext `llm_api_key` and `llm_configs[].apiKey` on
 * `workspaces` using AES-256-GCM (`encryptSecretAtRest`). Idempotent — already
 * encrypted envelopes are left unchanged.
 */
import { eq } from "drizzle-orm";
import type { LlmConfig } from "@mms/shared";
import { getDb } from "../dbClient.js";
import * as schema from "../schema.js";
import { withGlobalTenant } from "../tenant-context.js";
import {
  encryptLlmApiKey,
  encryptLlmConfigs,
  workspaceLlmSecretsNeedEncryption,
} from "../repositories/workspaceLlmSecrets.js";
import { invalidateWorkspaceCache } from "../../services/workspaceService.js";

export async function runMigration090(): Promise<void> {
  console.log("Encrypting plaintext workspace LLM secrets at rest...");
  const db = getDb();
  const workspaces = await db
    .select({
      subdomain: schema.workspaces.subdomain,
      llmApiKey: schema.workspaces.llmApiKey,
      llmConfigs: schema.workspaces.llmConfigs,
    })
    .from(schema.workspaces);

  let updatedCount = 0;

  await withGlobalTenant(async (tx) => {
    for (const ws of workspaces) {
      const configs = (ws.llmConfigs as LlmConfig[] | null) ?? null;
      if (!workspaceLlmSecretsNeedEncryption(ws.llmApiKey, configs)) {
        continue;
      }

      await tx
        .update(schema.workspaces)
        .set({
          llmApiKey: encryptLlmApiKey(ws.llmApiKey),
          llmConfigs: encryptLlmConfigs(configs),
        })
        .where(eq(schema.workspaces.subdomain, ws.subdomain));

      await invalidateWorkspaceCache(ws.subdomain);
      updatedCount += 1;
    }
  });

  console.log(`Encrypted LLM secrets on ${updatedCount} workspace row(s).`);
}
