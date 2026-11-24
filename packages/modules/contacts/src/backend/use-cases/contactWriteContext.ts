import { loadContactFieldConfig } from "./contactConfigService.js";
import { loadContactRuntimeDefaults } from "./contactLoadUseCases.js";
import type { ContactCountryCodeRow, ContactWriteContext } from "./contactWriteContextTypes.js";

/**
 * Loads every tenant-configuration read a contact write needs, once.
 *
 * Batch writers (import worker, Google sync) call this once per job and thread
 * the result through `prepareContactRecord` / `assertContactUniqueFields`, so
 * the per-contact query count stays constant instead of scaling with the batch.
 *
 * Country codes and relationship pairs are read once by
 * `loadContactRuntimeDefaults` (they feed the default dial code and inference),
 * and re-exposed here so no consumer pays a second lookup / preferences read.
 */
export async function loadContactWriteContext(): Promise<ContactWriteContext> {
  const [runtimeDefaults, fieldConfig] = await Promise.all([
    loadContactRuntimeDefaults(),
    loadContactFieldConfig(),
  ]);
  return {
    runtimeDefaults,
    countryCodes: runtimeDefaults.countryCodes as readonly ContactCountryCodeRow[],
    fieldConfig,
    relationshipPairs: runtimeDefaults.relationshipPairs,
  };
}
