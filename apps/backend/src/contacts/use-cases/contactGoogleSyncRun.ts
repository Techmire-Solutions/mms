import type { Contact, GoogleContactsSyncRunResult } from "@mms/shared";
import {
  mergeContacts,
  collectUniqueContactFieldValues,
  listUniqueContactFieldRefs,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { runInTransaction } from "../../db/database.js";
import { broadcastCollection } from "../../lib/livePush.js";
import {
  loadContactRuntimeDefaults,
  loadExistingNormalizedContactNames,
  findContactsMatchingUniqueValues,
} from "./contactLoadUseCases.js";
import { bulkSaveContacts } from "./contactWriteUseCases.js";
import {
  prepareContactRecord,
  assertContactUniqueFields,
  ContactUniqueFieldError,
} from "./contactValidationUseCases.js";
import { invalidateDuplicateScanCache } from "./contactDuplicateScanUseCases.js";
import { loadContactFieldConfig } from "./contactConfigService.js";
import {
  mapGoogleConnectionToContact,
  extractPhoneKeys,
  extractEmails,
  hasMeaningfulChanges,
  PeerContactIndex,
} from "./contactGoogleSyncMapping.js";

export type { GoogleContactsSyncRunResult };

import { fetchGoogleConnectionsWithRefresh } from "./contactGooglePeopleApi.js";

/** Fetch Google Contacts server-side; enriches existing contacts or creates new contacts. */
export async function runGoogleContactsSync(userId: string): Promise<GoogleContactsSyncRunResult> {
  const connections = await fetchGoogleConnectionsWithRefresh(userId);
  const defaults = await loadContactRuntimeDefaults();
  const mapped = connections
    .map((connection) => mapGoogleConnectionToContact(connection, defaults))
    .filter((contact): contact is Contact => contact != null);

  const tenant = getRequestTenant();
  if (!tenant || mapped.length === 0) {
    return {
      total: mapped.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      skippedName: 0,
      skippedUnique: 0,
    };
  }

  const allPhoneDigits = [...new Set(mapped.flatMap(extractPhoneKeys))];
  const allEmails = [...new Set(mapped.flatMap(extractEmails))];
  const candidateNames = mapped
    .map((contact) => contact.name?.toLowerCase().trim() || "")
    .filter(Boolean);

  const peerContacts = await findContactsMatchingUniqueValues({
    phoneDigits: allPhoneDigits,
    emails: allEmails,
    scalars: candidateNames.map((name) => ({ fieldKey: "name", normalized: name })),
  }).catch(() => []);

  const existingNames =
    peerContacts.length === 0 && candidateNames.length > 0
      ? await loadExistingNormalizedContactNames(candidateNames)
      : new Set<string>();

  const acceptedInserts: Contact[] = [];
  const acceptedUpdates: Contact[] = [];
  let skippedName = 0;
  let skippedUnique = 0;
  const peerIndex = new PeerContactIndex(peerContacts);

  // Running O(1) index of unique-field composites among inserts accepted so far,
  // so each new insert is checked against only the handful of prior inserts that
  // actually collide — not a full rescan of `acceptedInserts` (avoids O(n²) on
  // large Google directories).
  const { defaultPhoneCountryCode } = defaults;
  const collectOptions = { defaultPhoneCountryCode };
  // Lazily loaded on first insert (absent field config disables the in-run index).
  let syncUniqueFields: ReturnType<typeof listUniqueContactFieldRefs> | null = null;
  const acceptedComposites = new Map<string, string>(); // composite -> accepted contact id
  const acceptedById = new Map<string, Contact>(); // accepted contact id -> contact

  await runInTransaction(async () => {
    for (const candidate of mapped) {
      const match = peerIndex.findMatch(candidate);
      const isExistingNameOnly = !match && existingNames.has(candidate.name.trim().toLowerCase());

      if (match) {
        const merged = mergeContacts(match, candidate);
        if (hasMeaningfulChanges(match, merged)) {
          try {
            const prepared = await prepareContactRecord(merged, match.id);
            await assertContactUniqueFields(tenant, prepared, {
              language: "en",
              excludeContactIds: [match.id],
            });
            acceptedUpdates.push(prepared);
            peerIndex.update(match, prepared);
          } catch (error) {
            if (error instanceof ContactUniqueFieldError) {
              skippedUnique += 1;
              continue;
            }
            throw error;
          }
        } else {
          skippedName += 1;
        }
      } else if (isExistingNameOnly) {
        skippedName += 1;
      } else {
        try {
          const prepared = await prepareContactRecord(candidate, candidate.id);

          // Load unique field refs once on first insert (absent config -> [] makes
          // the in-run index a no-op, matching the pre-optimisation behaviour).
          if (syncUniqueFields === null) {
            const syncFieldConfig = await loadContactFieldConfig();
            syncUniqueFields = syncFieldConfig?.fields
              ? listUniqueContactFieldRefs(syncFieldConfig.fields)
              : [];
          }

          // O(1) lookup of prior in-run inserts sharing a unique field value.
          const candidateComposites = collectUniqueContactFieldValues(
            prepared,
            syncUniqueFields,
            collectOptions,
          ).map((value) => `${value.tabId}:${value.fieldKey}:${value.normalized}`);
          const collidingContacts: Contact[] = [];
          for (const composite of candidateComposites) {
            const ownerId = acceptedComposites.get(composite);
            if (ownerId) {
              const existing = acceptedById.get(ownerId);
              if (existing) collidingContacts.push(existing);
            }
          }

          // Pass only the (tiny) colliding subset — not the whole accepted array —
          // so `assertContactUniqueFields` still reports the identical conflicts
          // without rescanning every previously accepted insert.
          await assertContactUniqueFields(tenant, prepared, {
            language: "en",
            additionalPeers: collidingContacts,
          });

          acceptedInserts.push(prepared);
          if (candidateComposites.length > 0) {
            const preparedId = String(prepared.id);
            acceptedById.set(preparedId, prepared);
            for (const composite of candidateComposites) {
              if (!acceptedComposites.has(composite)) {
                acceptedComposites.set(composite, preparedId);
              }
            }
          }
          peerIndex.add(prepared);
        } catch (error) {
          if (error instanceof ContactUniqueFieldError) {
            skippedUnique += 1;
            continue;
          }
          throw error;
        }
      }
    }

    if (acceptedInserts.length > 0) {
      await bulkSaveContacts(acceptedInserts);
    }
    if (acceptedUpdates.length > 0) {
      await bulkSaveContacts(acceptedUpdates);
    }
    if (acceptedInserts.length > 0 || acceptedUpdates.length > 0) {
      await invalidateDuplicateScanCache();
    }
  });

  const imported = acceptedInserts.length;
  const updated = acceptedUpdates.length;
  if (imported > 0 || updated > 0) {
    await broadcastCollection("contacts");
  }

  return {
    total: mapped.length,
    imported,
    updated,
    skippedName,
    skippedUnique,
    skipped: skippedName + skippedUnique,
  };
}
