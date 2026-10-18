import {
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  messageTemplateSchema,
  messageRecordSchema,
  type Workspace,
  type MessageTemplate,
  type Message,
  type WhatsAppTemplate,
} from "@mms/shared";
import { getCollectionByStorageName, listCollectionStorageNames } from "../database.js";
import {
  bulkSaveMessageTemplates,
  bulkSaveMessageLogs,
  listMessageTemplatesByWorkspace,
  listMessageLogsByWorkspace,
} from "../repositories/messagingRepository.js";

async function discoverTenantSubdomains(): Promise<Set<string>> {
  const subdomains = new Set<string>();
  const names = await listCollectionStorageNames();
  for (const name of names) {
    const parsed = parseTenantScopedStorageKey(name);
    if (parsed) subdomains.add(parsed.subdomain);
  }
  const workspaces = await getCollectionByStorageName(WORKSPACES_COLLECTION);
  if (Array.isArray(workspaces)) {
    for (const entry of workspaces) {
      const subdomain = (entry as Workspace).subdomain;
      if (subdomain) subdomains.add(subdomain);
    }
  }
  return subdomains;
}

function asTemplate(raw: unknown): MessageTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const parsed = messageTemplateSchema.safeParse({
    id: String(row.id ?? ""),
    label: String(row.label ?? ""),
    body: String(row.body ?? ""),
    category: row.category ?? "general",
    channel: row.channel ?? "all",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : undefined,
  });
  return parsed.success ? parsed.data : null;
}

function whatsappToTemplate(raw: unknown): MessageTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as WhatsAppTemplate;
  if (!row.id || !row.label || !row.body) return null;
  return {
    id: String(row.id),
    label: String(row.label),
    body: String(row.body),
    category: "general",
    channel: "whatsapp",
  };
}

function asMessage(raw: unknown): Message | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = messageRecordSchema.safeParse(raw);
  return parsed.success ? (parsed.data as Message) : null;
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of existing) map.set(String(row.id), row);
  for (const row of incoming) map.set(String(row.id), row);
  return [...map.values()];
}

/**
 * Imports legacy per-user / workspace messaging document collections into
 * message_templates and message_logs tables (upsert; idempotent).
 */
export async function runMigration035(): Promise<void> {
  let changed = false;
  const subdomains = await discoverTenantSubdomains();
  const storageNames = await listCollectionStorageNames();

  for (const subdomain of subdomains) {
    const prefix = tenantCollectionKey(subdomain, "");
    const templateCandidates: MessageTemplate[] = [];
    const logCandidates: Message[] = [];

    for (const storageName of storageNames) {
      if (!storageName.startsWith(prefix)) continue;
      const logical = storageName.slice(prefix.length);

      const isTemplates =
        logical === "whatsappTemplates" ||
        logical.startsWith("whatsappTemplates_u:") ||
        logical.startsWith("messages_templates_u:");
      const isLogs = logical === "messages" || logical.startsWith("messages_u:");

      if (!isTemplates && !isLogs) continue;

      const rows = await getCollectionByStorageName(storageName);
      if (!Array.isArray(rows) || rows.length === 0) continue;

      if (isTemplates) {
        for (const row of rows) {
          const tpl =
            logical.startsWith("whatsappTemplates") || logical === "whatsappTemplates"
              ? (whatsappToTemplate(row) ?? asTemplate(row))
              : (asTemplate(row) ?? whatsappToTemplate(row));
          if (tpl) templateCandidates.push(tpl);
        }
      }

      if (isLogs) {
        for (const row of rows) {
          const msg = asMessage(row);
          if (msg) logCandidates.push(msg);
        }
      }
    }

    if (templateCandidates.length > 0) {
      const existing = await listMessageTemplatesByWorkspace(subdomain);
      const merged = mergeById(existing, templateCandidates);
      await bulkSaveMessageTemplates(subdomain, merged);
      changed = true;
      console.log(
        `[Migration 035] Upserted ${templateCandidates.length} legacy template(s) for "${subdomain}" into message_templates.`,
      );
    }

    if (logCandidates.length > 0) {
      const existing = await listMessageLogsByWorkspace(subdomain);
      const merged = mergeById(existing, logCandidates);
      await bulkSaveMessageLogs(subdomain, merged);
      changed = true;
      console.log(
        `[Migration 035] Upserted ${logCandidates.length} legacy message log(s) for "${subdomain}" into message_logs.`,
      );
    }
  }

  if (!changed) {
    console.log("[Migration 035] No legacy messaging collections to import.");
  }
}
