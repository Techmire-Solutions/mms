/** Contact repository public surface — list, CRUD, uniqueness lookups. */
export {
  listContactsByWorkspace,
  countContactsByWorkspace,
  findContactById,
  findContactsByIds,
  findContactsSummaryByIds,
  saveContact,
  bulkSaveContacts,
  bulkSoftDeleteContactsSql,
  bulkRestoreContactsSql,
  replaceContactsForWorkspace,
} from "./contactRepositoryCore.js";
export { listContactsPage } from "./contactRepositoryList.js";
export type { ContactUniqueLookupValues } from "./contactRepositoryLookup.js";
export {
  findExistingNormalizedContactNames,
  findActiveContactsMatchingUniqueValues,
} from "./contactRepositoryLookup.js";
export type { ContactDuplicateCandidateKeys } from "./contactRepositoryDuplicates.js";
export {
  findContactDuplicateCandidateIds,
  findContactDuplicateBlockedIds,
  reparentContactReferences,
} from "./contactRepositoryDuplicates.js";
