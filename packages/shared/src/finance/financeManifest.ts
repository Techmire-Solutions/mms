/** Finance module manifest — aligns with globle1 universal module architecture. */
import type { Permission } from "../auth/permissions.js";

export const FINANCE_MODULE_MANIFEST = {
  moduleId: "finance",
  entityType: "Invoice",
  collectionKey: "finance_invoices",
  paymentCollectionKey: "finance_payments",
  settingsObjectKey: "finance_settings",
  invoiceColumnPreferencesObjectKey: "finance_invoice_user_column_preferences",
  paymentColumnPreferencesObjectKey: "finance_payment_user_column_preferences",
  restBasePath: "/api/finance",
  analyticsCategory: "financial",
  tiers: ["work", "reports", "setup"] as const,
  setupSubTabs: ["preferences", "templates"] as const,
  softDelete: {
    workExcludesDeleted: true,
    reportsIncludeDeleted: false,
    exportsIncludeDeleted: false,
    captureDeletionReason: false,
    retentionDays: null,
  },
  permissions: {
    // Distinct capabilities: a read-only role (auditor, principal) must be able to
    // inspect financial records, and archiving/waiving must not be implied by the
    // ordinary write permission held by cashiers and billing staff.
    read: "finance.read",
    write: "finance.write",
    delete: "finance.delete",
    manage: "finance.manage",
    setupView: "configuration.view",
    setupWrite: "settings.global.write",
    export: "finance.read",
    reports: "finance.read",
  } satisfies Record<string, Permission>,
  work: {
    directoryViews: ["invoices", "payments"] as const,
    bulkActions: ["delete", "status", "receipts", "export"] as const,
  },
  defaultPageSize: 10,
  maxPageSize: 100,
} as const;

export type FinanceModuleTier = (typeof FINANCE_MODULE_MANIFEST.tiers)[number];
