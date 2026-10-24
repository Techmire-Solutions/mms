import {
  collectUniqueContactFieldValues,
  findContactUniqueFieldConflicts,
  listUniqueContactFieldRefs,
  type Contact,
  type ValidationError,
} from "@mms/shared";
import { ConflictError } from "../../lib/httpErrors.js";
import { loadContactFieldConfig } from "./contactConfigService.js";
import { loadContactRuntimeDefaults } from "./contactLoadUseCases.js";
import type { ContactsRepository } from "../repository/contactsRepository.js";
import { contactsRepository } from "../repository/contactsRepositoryAdapter.js";

/** Thrown when a contact reuses a Setup-unique field value. */
export class ContactUniqueFieldError extends ConflictError {
  readonly code = "unique_conflict" as const;
  readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    const message = errors.map((error) => error.message).join("; ") || "Unique field conflict";
    super(message);
    this.name = "ContactUniqueFieldError";
    this.errors = errors;
  }
}

export interface AssertContactUniqueFieldsOptions {
  language?: string;
  excludeContactIds?: Array<string | number>;
  /** Extra peers not yet persisted (e.g. Google sync batch). */
  additionalPeers?: ReadonlyArray<Contact>;
  /**
   * Take transaction-scoped advisory locks on normalized unique values before peer checks.
   * Callers must already be inside `runInTransaction` / tenant tx for locks to cover the write.
   * @default true
   */
  acquireLocks?: boolean;
}

/**
 * Transaction-scoped advisory locks for Setup-unique values (closes check-then-write races).
 * Keys are sorted for stable lock order across concurrent writers.
 * The lock SQL lives in the repository adapter — a storage concern, not domain orchestration.
 */
async function acquireContactUniqueValueLocks(
  tenant: string,
  lockKeys: string[],
  repo: ContactsRepository,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const sorted = [...new Set(lockKeys.map((key) => key.trim()).filter(Boolean))].sort();
  await repo.acquireUniqueValueLocks(subdomain, sorted);
}

/**
 * Rejects save when any enabled Setup `unique` field collides with another active contact
 * (or is duplicated within the candidate).
 *
 * Peer lookup is scoped to contacts matching candidate unique values (SQL), not a full-tenant dump.
 * Acquires advisory locks on normalized unique values before the peer read (TOCTOU guard).
 */
export async function assertContactUniqueFields(
  tenant: string,
  contact: Contact,
  languageOrOptions: string | AssertContactUniqueFieldsOptions = "en",
  excludeContactIdsArg: Array<string | number> = [],
  repo: ContactsRepository = contactsRepository,
): Promise<void> {
  const options: AssertContactUniqueFieldsOptions =
    typeof languageOrOptions === "string"
      ? { language: languageOrOptions, excludeContactIds: excludeContactIdsArg }
      : languageOrOptions;
  const language = options.language ?? "en";
  const excludeContactIds = options.excludeContactIds ?? excludeContactIdsArg;
  const additionalPeers = options.additionalPeers ?? [];
  const acquireLocks = options.acquireLocks !== false;

  const fieldConfig = await loadContactFieldConfig();
  const fields = fieldConfig?.fields;
  if (!fields) return;

  const uniqueFields = listUniqueContactFieldRefs(fields);
  if (uniqueFields.length === 0) return;

  const { defaultPhoneCountryCode } = await loadContactRuntimeDefaults();
  const collectOptions = { defaultPhoneCountryCode };
  const candidateValues = collectUniqueContactFieldValues(contact, uniqueFields, collectOptions);

  // Intra-candidate duplicates need no peer load.
  const intraErrors = findContactUniqueFieldConflicts(contact, [], fields, language, {
    defaultPhoneCountryCode,
    excludeContactIds,
  });

  if (candidateValues.length === 0) {
    if (intraErrors.length > 0) {
      throw new ContactUniqueFieldError(intraErrors);
    }
    return;
  }

  if (acquireLocks) {
    const lockKeys = candidateValues.map(
      (value) => `${value.tabId}:${value.fieldKey}:${value.normalized}`,
    );
    await acquireContactUniqueValueLocks(tenant, lockKeys, repo);
  }

  const phoneDigits = candidateValues
    .filter((value) => value.tabId === "phones" && value.fieldKey === "number")
    .map((value) => value.normalized);
  const emails = candidateValues
    .filter((value) => value.tabId === "emails" && value.fieldKey === "address")
    .map((value) => value.normalized);
  const scalars = candidateValues
    .filter(
      (value) =>
        !(value.tabId === "phones" && value.fieldKey === "number") &&
        !(value.tabId === "emails" && value.fieldKey === "address"),
    )
    .map((value) => ({ fieldKey: value.fieldKey, normalized: value.normalized }));

  const excludeIds = [...excludeContactIds, ...(contact.id != null ? [contact.id] : [])];
  const peers = await repo.findActiveContactsMatchingUniqueValues(
    tenant,
    { phoneDigits, emails, scalars },
    excludeIds,
  );

  const errors = findContactUniqueFieldConflicts(
    contact,
    [...peers, ...additionalPeers],
    fields,
    language,
    {
      defaultPhoneCountryCode,
      excludeContactIds: excludeIds,
    },
  );
  if (errors.length > 0) {
    throw new ContactUniqueFieldError(errors);
  }
}
