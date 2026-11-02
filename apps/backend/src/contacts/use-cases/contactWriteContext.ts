import { loadContactFieldConfig } from "./contactConfigService.js";
import { loadContactLookupKind } from "./contactLookupsService.js";
import { loadContactRuntimeDefaults } from "./contactLoadUseCases.js";
import type { ContactCountryCodeRow, ContactWriteContext } from "./contactWriteContextTypes.js";

/**
 * Loads every tenant-configuration read a contact write needs, once.
 *
 * Batch writers (import worker, Google sync) call this once per job and thread
 * the result through `prepareContactRecord` / `assertContactUniqueFields`, so
 * the per-contact query count stays constant instead of scaling with the batch.
 */
export async function loadContactWriteContext(): Promise<ContactWriteContext> {
  const [runtimeDefaults, countryCodes, fieldConfig] = await Promise.all([
    loadContactRuntimeDefaults(),
    loadContactLookupKind("countryCodes"),
    loadContactFieldConfig(),
  ]);
  return {
    runtimeDefaults,
    countryCodes: (countryCodes ?? []) as readonly ContactCountryCodeRow[],
    fieldConfig,
  };
}
