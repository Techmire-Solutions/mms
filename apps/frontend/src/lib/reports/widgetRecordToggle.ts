import { apiFetch, apiJson } from "@/lib/apiClient";
import { findCachedCollectionRecord } from "@/lib/queryCacheCollections";
import { queryClientInstance } from "@/lib/queryClient";
import {
  ATTENDANCE_MODULE_MANIFEST,
  CONTACTS_MODULE_MANIFEST,
  FINANCE_MODULE_MANIFEST,
  HASANAT_MODULE_MANIFEST,
  SESSIONS_MODULE_MANIFEST,
  STUDENTS_MODULE_MANIFEST,
} from "@mms/shared";
import { ATTENDANCE_QUERY_KEY } from "@/tenant/hooks/collections/attendance";
import { CONTACTS_QUERY_KEY } from "@/tenant/hooks/collections/contacts";
import { FINANCE_INVOICES_QUERY_KEY } from "@/tenant/hooks/collections/finance";
import { HASANAT_DISTRIBUTIONS_QUERY_KEY } from "@/tenant/hooks/collections/hasanat";
import { SESSIONS_QUERY_KEY } from "@/tenant/hooks/collections/sessions";
import { STUDENTS_QUERY_KEY } from "@/tenant/hooks/collections/students";

type RestToggleConfig = {
  putPath: (id: string) => string;
  /** When set, PUT body is a list (Hasanat bulk upsert pattern). */
  bulkBody?: true;
  invalidateQueryKey: readonly unknown[];
};

/** REST-authoritative collections that must never be mutated via saveCollection. */
const REST_WIDGET_TOGGLE_CONFIG: Record<string, RestToggleConfig> = {
  students: {
    putPath: (id) => `${STUDENTS_MODULE_MANIFEST.restBasePath}/${encodeURIComponent(id)}`,
    invalidateQueryKey: STUDENTS_QUERY_KEY,
  },
  contacts: {
    putPath: (id) => `${CONTACTS_MODULE_MANIFEST.restBasePath}/${encodeURIComponent(id)}`,
    invalidateQueryKey: CONTACTS_QUERY_KEY,
  },
  sessions: {
    putPath: (id) => `${SESSIONS_MODULE_MANIFEST.restBasePath}/${encodeURIComponent(id)}`,
    invalidateQueryKey: SESSIONS_QUERY_KEY,
  },
  finance_invoices: {
    putPath: (id) => `${FINANCE_MODULE_MANIFEST.restBasePath}/invoices/${encodeURIComponent(id)}`,
    invalidateQueryKey: FINANCE_INVOICES_QUERY_KEY,
  },
  attendance_records: {
    putPath: (id) => `${ATTENDANCE_MODULE_MANIFEST.restBasePath}/${encodeURIComponent(id)}`,
    invalidateQueryKey: ATTENDANCE_QUERY_KEY,
  },
  hasanat_distributions: {
    putPath: () => `${HASANAT_MODULE_MANIFEST.restBasePath}/distributions/bulk`,
    bulkBody: true,
    invalidateQueryKey: HASANAT_DISTRIBUTIONS_QUERY_KEY,
  },
};

export function isRestWidgetCollection(collectionName: string): boolean {
  return collectionName in REST_WIDGET_TOGGLE_CONFIG;
}

function nextToggleFieldValue(current: unknown): unknown {
  if (current === "active") return "inactive";
  if (current === "inactive") return "active";
  if (current === "paid") return "unpaid";
  if (current === "unpaid") return "paid";
  if (current === "present") return "absent";
  if (current === "absent") return "present";
  if (typeof current === "boolean") return !current;
  return !current;
}

function patchRecordForCollection(
  collectionName: string,
  record: Record<string, unknown>,
  field: string,
): Record<string, unknown> {
  if (collectionName === "finance_invoices" && field === "status") {
    const nextStatus = record.status === "paid" ? "unpaid" : "paid";
    const finalAmt = Number(record.finalAmt || 0);
    return { ...record, status: nextStatus, paidAmt: nextStatus === "paid" ? finalAmt : 0 };
  }
  if (collectionName === "contacts" && field === "status") {
    return { ...record, isActive: record.isActive === false };
  }
  return { ...record, [field]: nextToggleFieldValue(record[field]) };
}

/**
 * Persist a single-field toggle for a widget-targeted record via REST when
 * the collection is server-authoritative. Throws if the record cannot be found.
 */
export async function persistWidgetRecordToggle(options: {
  collectionName: string;
  recordId: string;
  field?: string;
}): Promise<void> {
  const { collectionName, recordId } = options;
  const field = options.field ?? "status";
  const config = REST_WIDGET_TOGGLE_CONFIG[collectionName];
  if (!config) {
    throw new Error(`Collection "${collectionName}" is not REST-toggleable from widgets`);
  }

  const existing = findCachedCollectionRecord(collectionName, recordId, config.invalidateQueryKey);
  if (!existing) {
    throw new Error(`Record ${recordId} not found in ${collectionName} cache`);
  }

  const patched = patchRecordForCollection(collectionName, { ...existing }, field);

  if (config.bulkBody) {
    await apiJson(config.putPath(recordId), {
      method: "PUT",
      body: JSON.stringify([patched]),
    });
  } else {
    await apiJson(config.putPath(recordId), {
      method: "PUT",
      body: JSON.stringify(patched),
    });
  }

  void queryClientInstance.invalidateQueries({ queryKey: config.invalidateQueryKey });
  window.dispatchEvent(new Event("local-database-update"));
}

/** Soft-delete a Hasanat distribution from widget drill-down via REST. */
export async function persistWidgetHasanatDistributionDelete(distId: string): Promise<void> {
  await apiFetch(
    `${HASANAT_MODULE_MANIFEST.restBasePath}/distributions/${encodeURIComponent(distId)}`,
    { method: "DELETE" },
  );
  void queryClientInstance.invalidateQueries({ queryKey: HASANAT_DISTRIBUTIONS_QUERY_KEY });
  window.dispatchEvent(new Event("local-database-update"));
}
