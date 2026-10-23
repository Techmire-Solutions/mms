import {
  normalizeMessagingPreferences,
  type MessagingPreferences,
  MESSAGING_MODULE_MANIFEST,
} from "@mms/shared";
import { getObject, saveObject } from "../db/documentStoreObjects.js";
import { broadcastCollection } from "../lib/livePush.js";

const PREFS_KEY = MESSAGING_MODULE_MANIFEST.preferencesObjectKey;

export const messagingPreferencesService = {
  load: async (): Promise<MessagingPreferences> => {
    const raw = await getObject(PREFS_KEY);
    return normalizeMessagingPreferences(raw);
  },
  save: async (prefs: MessagingPreferences): Promise<MessagingPreferences> => {
    const normalized = normalizeMessagingPreferences(prefs);
    await saveObject(PREFS_KEY, normalized);
    await broadcastCollection(MESSAGING_MODULE_MANIFEST.collectionKey);
    return normalized;
  },
};
