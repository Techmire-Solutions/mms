import type { Contact, GoogleContactsSyncRunResult } from "@mms/shared";
import {
  mergeContacts,
  collectUniqueContactFieldValues,
  listUniqueContactFieldRefs,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { runInTransaction } from "../../db/database.js";
import { loadContactWriteContext } from "./contactWriteContext.js";
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

  // Running O(1) index of unique-field composites among inserts AND updates accepted
  // so far, so each new candidate is checked against only the handful of prior
  // pending writes that actually collide — not a full rescan (avoids O(n²) on large
  // Google directories) and not only the committed rows (which miss pending writes).
  const { defaultPhoneCountryCode } = defaults;
  const collectOptions = { defaultPhoneCountryCode };
  // Lazily loaded on first accepted write (absent field config disables the in-run index).
  let syncUniqueFields: ReturnType<typeof listUniqueContactFieldRefs> | null = null;
  const acceptedComposites = new Map<string, string>(); // composite -> accepted contact id
  const acceptedById = new Map<string, Contact>(); // accepted contact id -> contact

  // One tenant-config read for the whole sync instead of two per candidate.
  const writeContext = await loadContactWriteContext();

  const ensureSyncUniqueFields = () => {
    if (syncUniqueFields === null) {
      const syncFieldConfig = writeContext.fieldConfig;
      syncUniqueFields = syncFieldConfig?.fields
        ? listUniqueContactFieldRefs(syncFieldConfig.fields)
        : [];
    }
    return syncUniqueFields;
  };

  /** Unique-value composites the pending record would occupy. */
  const pendingCompositesFor = (record: Contact): string[] =>
    collectUniqueContactFieldValues(record, ensureSyncUniqueFields(), collectOptions).map(
      (value) => `${value.tabId}:${value.fieldKey}:${value.normalized}`,
    );

  /** Pending (accepted-but-unpersisted) records sharing one of these composites. */
  const pendingPeersFor = (composites: string[], selfId?: string): Contact[] => {
    const peers = new Map<string, Contact>();
    for (const composite of composites) {
      const ownerId = acceptedComposites.get(composite);
      if (!ownerId || (selfId != null && ownerId === selfId)) continue;
      const peer = acceptedById.get(ownerId);
      if (peer) peers.set(ownerId, peer);
    }
    return [...peers.values()];
  };

  /** Records an accepted write in the in-run index so later candidates can collide with it. */
  const registerPending = (record: Contact, composites: string[]): void => {
    if (composites.length === 0) return;
    const recordId = String(record.id);
    acceptedById.set(recordId, record);
    for (const composite of composites) {
      if (!acceptedComposites.has(composite)) acceptedComposites.set(composite, recordId);
    }
  };

  await runInTransaction(async () => {
    for (const candidate of mapped) {
      const match = peerIndex.findMatch(candidate);
      const isExistingNameOnly = !match && existingNames.has(candidate.name.trim().toLowerCase());

      if (match) {
        const merged = mergeContacts(match, candidate);
        if (hasMeaningfulChanges(match, merged)) {
          try {
            const prepared = await prepareContactRecord(merged, match.id, writeContext);
            const candidateComposites = pendingCompositesFor(prepared);
            await assertContactUniqueFields(tenant, prepared, {
              language: "en",
              excludeContactIds: [match.id],
              // A previously accepted update is not in the database yet; without its
              // peer here two updates could both introduce the same unique value.
              additionalPeers: pendingPeersFor(candidateComposites, String(match.id)),
              context: writeContext,
            });
            acceptedUpdates.push(prepared);
            registerPending(prepared, candidateComposites);
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
          const prepared = await prepareContactRecord(candidate, candidate.id, writeContext);
          const candidateComposites = pendingCompositesFor(prepared);

          // Pass only the (tiny) colliding subset — not the whole accepted array —
          // so `assertContactUniqueFields` still reports the identical conflicts
          // without rescanning every previously accepted write.
          await assertContactUniqueFields(tenant, prepared, {
            language: "en",
            additionalPeers: pendingPeersFor(candidateComposites),
            context: writeContext,
          });

          acceptedInserts.push(prepared);
          registerPending(prepared, candidateComposites);
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
