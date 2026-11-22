import { getRequestTenant } from "./tenantContext.js";

/**
 * Generic integration-config service factory shared by the five tenant/platform
 * SMS/email/WhatsApp integration services (mms-dry §2).
 *
 * Every integration exposes the same surface — load/save config, load/save
 * secrets, and mark-test-result — differing only in the storage adapter and the
 * tenant guard. The canonical configs must carry the test-state fields below so
 * `markTestResult` can compose them uniformly.
 */

export interface IntegrationTestableConfig {
  connected: boolean;
  hasCredentials: boolean;
  lastTestAt?: string;
  lastTestOk?: boolean;
  lastError?: string;
}

export interface CreateIntegrationConfigServiceAdapter<
  TConfig extends IntegrationTestableConfig,
  TSecrets,
  TRow,
> {
  /** Maps a stored row onto the canonical config. */
  rowToConfig(row: TRow): TConfig;
  /** Canonical config when no row exists. */
  emptyConfig(): TConfig;
  /** Canonicalizes an incoming config before persistence. */
  mergeConfig(config: TConfig): TConfig;
  /** Loads the stored row (called after the tenant guard has passed). */
  loadRow(): Promise<TRow | null>;
  /** Persists the config row. */
  upsertConfig(config: TConfig): Promise<void>;
  /** Persists the secrets row. */
  upsertSecrets(secrets: TSecrets): Promise<void>;
  /** Extracts the secrets subset from a stored row. */
  secretsFromRow(row: TRow): TSecrets;
  /** True when the service is tenant-scoped (guarded by `getRequestTenant`). */
  tenantScoped: boolean;
}

export interface IntegrationConfigService<TConfig, TSecrets> {
  loadConfig(): Promise<TConfig>;
  saveConfig(config: TConfig): Promise<TConfig>;
  loadSecrets(): Promise<TSecrets>;
  saveSecrets(secrets: TSecrets): Promise<void>;
  markTestResult(ok: boolean, errorMessage?: string): Promise<TConfig>;
}

export function createIntegrationConfigService<
  TConfig extends IntegrationTestableConfig,
  TSecrets,
  TRow,
>(
  adapter: CreateIntegrationConfigServiceAdapter<TConfig, TSecrets, TRow>,
): IntegrationConfigService<TConfig, TSecrets> {
  const requireTenant = (): string => {
    const subdomain = getRequestTenant();
    if (!subdomain) throw new Error("Tenant context missing");
    return subdomain;
  };

  async function loadConfig(): Promise<TConfig> {
    if (adapter.tenantScoped && !getRequestTenant()) return adapter.emptyConfig();
    const row = await adapter.loadRow();
    if (!row) return adapter.emptyConfig();
    return adapter.rowToConfig(row);
  }

  async function saveConfig(config: TConfig): Promise<TConfig> {
    if (adapter.tenantScoped) requireTenant();
    const merged = adapter.mergeConfig(config);
    await adapter.upsertConfig(merged);
    return merged;
  }

  async function loadSecrets(): Promise<TSecrets> {
    if (adapter.tenantScoped && !getRequestTenant()) return {} as TSecrets;
    const row = await adapter.loadRow();
    if (!row) return {} as TSecrets;
    return adapter.secretsFromRow(row);
  }

  async function saveSecrets(secrets: TSecrets): Promise<void> {
    if (adapter.tenantScoped) requireTenant();
    await adapter.upsertSecrets(secrets);
  }

  async function markTestResult(ok: boolean, errorMessage?: string): Promise<TConfig> {
    const current = await loadConfig();
    const updated = adapter.mergeConfig({
      ...current,
      connected: ok,
      hasCredentials: current.hasCredentials,
      lastTestAt: new Date().toISOString(),
      lastTestOk: ok,
      lastError: ok ? undefined : errorMessage,
    });
    return saveConfig(updated);
  }

  return { loadConfig, saveConfig, loadSecrets, saveSecrets, markTestResult };
}
