import {
  normalizeMessagingPreferences,
  type MessagingPreferences,
  MESSAGING_MODULE_MANIFEST,
} from "@mms/shared";
import { getRequestTenant } from "../lib/tenantContext.js";
import { broadcastCollection } from "../lib/livePush.js";
import { getObject } from "../db/documentStoreObjects.js";
import { messagingUseCases } from "../messaging/use-cases/messagingUseCases.js";

const PREFS_KEY = MESSAGING_MODULE_MANIFEST.preferencesObjectKey;

export const messagingPreferencesService = {
  load: async (): Promise<MessagingPreferences> => {
    const subdomain = getRequestTenant();
    if (!subdomain) return normalizeMessagingPreferences(null);
    const stored = await messagingUseCases.loadMessagingPreferences(subdomain);
    if (stored) return normalizeMessagingPreferences(stored);
    // One-time backfill: a legacy objects-KV value migrates on first read.
    const legacy = await getObject(PREFS_KEY);
    return normalizeMessagingPreferences(legacy);
  },
  save: async (prefs: MessagingPreferences): Promise<MessagingPreferences> => {
    const normalized = normalizeMessagingPreferences(prefs);
    const subdomain = getRequestTenant();
    if (!subdomain) throw new Error("Tenant context required");
    await messagingUseCases.saveMessagingPreferences(subdomain, normalized);
    await broadcastCollection(MESSAGING_MODULE_MANIFEST.collectionKey);
    return normalized;
  },
};
