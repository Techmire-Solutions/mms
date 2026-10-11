import {
  normalizeContactPreferences,
  relationshipPairsMatchDefaults,
  type ContactPreferences,
  type RelationshipPair,
} from "@mms/shared";
import { requireTenant } from "../../lib/tenantContext.js";
import {
  getContactModulePreferencesByWorkspace,
  upsertContactModulePreferences,
} from "../../db/repositories/contactModulePreferencesRepository.js";
import { createModulePreferencesService } from "../../lib/createModulePreferencesService.js";
import { syncRelationshipMirrorsFromPairs } from "../../lib/contactRelationshipMirrorService.js";

const preferencesStore = createModulePreferencesService<ContactPreferences>({
  broadcastKey: "contacts",
  getByWorkspace: getContactModulePreferencesByWorkspace,
  upsert: upsertContactModulePreferences,
  normalize: normalizeContactPreferences,
});

function rawNeedsRelationshipPairsRewrite(raw: Record<string, unknown>): boolean {
  const pairs = raw.relationshipPairs;
  if (!Array.isArray(pairs)) return true;
  return !relationshipPairsMatchDefaults(pairs as RelationshipPair[]);
}

/**
 * Rewrite `relationships` lookup (+ field-config options) from prefs SSOT.
 * Ignores any client-supplied label list for that kind.
 */
export async function mirrorRelationshipLookupsFromPreferences(): Promise<string[]> {
  const prefs = await loadContactPreferencesWithoutMirror();
  return syncRelationshipMirrorsFromPairs(prefs.relationshipPairs, prefs.relationshipOptionOrder);
}

async function loadContactPreferencesWithoutMirror(): Promise<ContactPreferences> {
  return (await preferencesStore.load()) ?? normalizeContactPreferences(null);
}

export async function loadContactPreferences(): Promise<ContactPreferences | null> {
  const raw = await getContactModulePreferencesByWorkspace(requireTenant());
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const normalized = normalizeContactPreferences(record as Partial<ContactPreferences>);
  // One-shot: rewrite stored pairs to the fixed system catalog when they diverge.
  if (rawNeedsRelationshipPairsRewrite(record)) {
    await upsertContactModulePreferences(requireTenant(), Object.assign({}, normalized));
  }
  // Align lookups + field-config options with pair-derived labels (purges stale seeds).
  await syncRelationshipMirrorsFromPairs(
    normalized.relationshipPairs,
    normalized.relationshipOptionOrder,
  );
  return normalized;
}

export async function saveContactPreferences(
  preferences: ContactPreferences,
): Promise<ContactPreferences> {
  const saved = await preferencesStore.save(preferences);
  await syncRelationshipMirrorsFromPairs(saved.relationshipPairs, saved.relationshipOptionOrder);
  return saved;
}
