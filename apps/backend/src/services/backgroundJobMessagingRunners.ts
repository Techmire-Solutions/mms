import { randomUUID } from "node:crypto";
import { MESSAGING_MODULE_MANIFEST } from "@mms/contracts";
import { registerModuleCsvImportJobRunner } from "../lib/registerModuleCsvImportJobRunner.js";
import { messagingUseCases } from "../messaging/use-cases/messagingUseCases.js";

/** `messaging:import` — bulk-creates message templates from the transfer schema. */
export function registerMessagingImportJobRunner(): void {
  registerModuleCsvImportJobRunner<{
    title?: string;
    message?: string;
    channel?: string;
    category?: string;
  }>({
    moduleId: MESSAGING_MODULE_MANIFEST.moduleId,
    entityNounPlural: "templates",
    importBatch: async (rows, ctx) => {
      let imported = 0;
      let failed = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const title = row.title?.trim();
        const body = row.message?.trim();
        if (!title || !body) {
          failed++;
          continue;
        }
        const channel = (
          ["sms", "whatsapp", "email", "all"].includes(row.channel?.toLowerCase() || "")
            ? row.channel?.toLowerCase()
            : "all"
        ) as "sms" | "whatsapp" | "email" | "all";
        const category = (
          ["general", "academic", "financial", "attendance", "emergency"].includes(
            row.category?.toLowerCase() || "",
          )
            ? row.category?.toLowerCase()
            : "general"
        ) as "general" | "academic" | "financial" | "attendance" | "emergency";

        try {
          await messagingUseCases.saveMessageTemplate(ctx.tenant, {
            id: `custom_${randomUUID()}`,
            label: title,
            body,
            channel,
            category,
            updatedAt: new Date().toISOString(),
          });
          imported++;
        } catch {
          failed++;
        }
        if ((i + 1) % 10 === 0) {
          await ctx.updateProgress(i + 1, rows.length);
        }
      }
      return { imported, failed, total: rows.length };
    },
  });
}
