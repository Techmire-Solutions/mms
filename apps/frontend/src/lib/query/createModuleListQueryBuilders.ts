/**
 * Shared Work-directory list Query builders.
 *
 * Contacts/Students/Faculty/Users each duplicated the same four helpers
 * (page-URL builder, key-param normalizer, paginated query key, filter equality).
 * This factory takes a per-module field spec and produces the identical surface.
 *
 * `resolveApiPath`/`resolveQueryKey` are lazy accessors: the module Query-key
 * modules re-export the builders, so a direct top-level read would hit a TDZ
 * cycle. Reading inside the returned functions keeps evaluation order safe.
 */

export type ListFilterKind = "text" | "boolean" | "csv" | "enum";

export interface ListFilterSpec {
  /** Property name on the params object, the URL query-string param, and the key field. */
  name: string;
  kind: ListFilterKind;
  /** Value used in the Query key when the filter is unset. */
  keyDefault: string | boolean;
  /** `enum` only: the value that means "no filter" (mapped to `keyDefault`). */
  allValue?: string;
}

export interface ModuleListQueryBuilderConfig {
  resolveApiPath: () => string;
  resolveQueryKey: () => readonly unknown[];
  defaultPageSize: number;
  /** `"include"` keeps defaults in the key; `"omit"` drops filters equal to their default. */
  keyStyle: "include" | "omit";
  fields: readonly ListFilterSpec[];
}

export interface ModuleListQueryBuilders<TParams> {
  buildPageUrl: (params: TParams) => string;
  listQueryKeyParams: (params: TParams) => Record<string, unknown>;
  paginatedQueryKey: (params: TParams) => readonly unknown[];
  sameListFilters: (
    previous: Record<string, unknown> | undefined,
    next: Record<string, unknown>,
  ) => boolean;
}

type ReadableParams = Record<string, unknown> & { page: number; limit?: number };

function normalizeKeyValue(field: ListFilterSpec, raw: unknown): string | boolean {
  switch (field.kind) {
    case "text": {
      const value = String(raw ?? "").trim();
      return value || (field.keyDefault as string);
    }
    case "boolean":
      return Boolean(raw);
    case "csv":
      return (Array.isArray(raw) ? raw : []).map(String).join(",");
    case "enum": {
      const value = String(raw ?? "").trim();
      return value && value !== field.allValue ? value : (field.keyDefault as string);
    }
  }
}

function applyUrlParam(queryParams: URLSearchParams, field: ListFilterSpec, raw: unknown): void {
  switch (field.kind) {
    case "text": {
      const value = String(raw ?? "").trim();
      if (value) queryParams.set(field.name, value);
      return;
    }
    case "boolean":
      if (raw) queryParams.set(field.name, "true");
      return;
    case "csv": {
      const values = Array.isArray(raw) ? raw : [];
      if (values.length > 0) queryParams.set(field.name, values.map(String).join(","));
      return;
    }
    case "enum": {
      const value = String(raw ?? "").trim();
      if (value && value !== field.allValue) queryParams.set(field.name, value);
      return;
    }
  }
}

export function createModuleListQueryBuilders<TParams extends { page: number; limit?: number }>(
  config: ModuleListQueryBuilderConfig,
): ModuleListQueryBuilders<TParams> {
  const { fields, keyStyle, defaultPageSize } = config;

  function listQueryKeyParams(params: TParams): Record<string, unknown> {
    const source = params as ReadableParams;
    const out: Record<string, unknown> = {};
    for (const field of fields) {
      const value = normalizeKeyValue(field, source[field.name]);
      if (keyStyle === "omit" && value === field.keyDefault) continue;
      out[field.name] = value;
    }
    out.page = source.page;
    out.limit = source.limit ?? defaultPageSize;
    return out;
  }

  function buildPageUrl(params: TParams): string {
    const source = params as ReadableParams;
    const queryParams = new URLSearchParams();
    queryParams.set("page", String(source.page));
    queryParams.set("limit", String(source.limit ?? defaultPageSize));
    for (const field of fields) {
      applyUrlParam(queryParams, field, source[field.name]);
    }
    return `${config.resolveApiPath()}?${queryParams.toString()}`;
  }

  function paginatedQueryKey(params: TParams): readonly unknown[] {
    return [...config.resolveQueryKey(), "page", listQueryKeyParams(params)];
  }

  function sameListFilters(
    previous: Record<string, unknown> | undefined,
    next: Record<string, unknown>,
  ): boolean {
    if (!previous) return false;
    return (
      fields.every((field) => previous[field.name] === next[field.name]) &&
      previous.limit === next.limit
    );
  }

  return { buildPageUrl, listQueryKeyParams, paginatedQueryKey, sameListFilters };
}
