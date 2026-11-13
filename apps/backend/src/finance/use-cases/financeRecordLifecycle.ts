import { withTenant } from "../../db/tenant-context.js";
import {
  invoiceAuditState,
  paymentAuditState,
  recordInvoiceAudit,
  recordPaymentAudit,
} from "./financeAuditEvents.js";
import {
  onInvoicesArchived,
  onInvoicesRestored,
  onPaymentsArchived,
  onPaymentsRestored,
  readArchivedInvoices,
  readArchivedPayments,
  type ArchivableRepo,
} from "./financeRecordLifecycleLedger.js";

export {
  onInvoicesArchived,
  onInvoicesRestored,
  onPaymentsArchived,
  onPaymentsRestored,
  readArchivedInvoices,
  readArchivedPayments,
  type ArchivableRepo,
} from "./financeRecordLifecycleLedger.js";

/** The soft-delete surface of a `createGenericRelationalService` collection. */
interface SoftDeletableCrud {
  deleteById(id: string, deletedBy: string, deletionReason?: string): Promise<boolean>;
  restoreById(id: string, userId?: string): Promise<boolean>;
  bulkDeleteByIds(
    ids: string[],
    deletedBy: string,
    deletionReason?: string,
  ): Promise<{ succeeded: number; failed: number }>;
  bulkRestoreByIds(ids: string[], userId?: string): Promise<{ succeeded: number; failed: number }>;
}

/**
 * The finance composition root's archive / restore operations.
 *
 * Each one wraps the plain soft delete together with its ledger and subledger
 * consequences in a single transaction, so the directory, the invoice balance
 * and the ledger move together or not at all.
 */
export function createFinanceLifecycleOperations(deps: {
  repo: ArchivableRepo;
  invoiceCrud: SoftDeletableCrud;
  paymentCrud: SoftDeletableCrud;
  requireTenant: () => string;
}) {
  const { repo, invoiceCrud, paymentCrud, requireTenant } = deps;

  /**
   * Archive/restore changes recognised revenue and the ledger posting, so it is a
   * financial mutation: the audit row is appended in the same tenant transaction
   * (the soft-delete columns alone are not an audit trail). The before state is
   * read while the row is still active, and the archive reversal runs first so a
   * posting failure rolls the whole operation back with the audit row.
   */
  const invoiceStates = async (tenant: string, ids: readonly string[]) => {
    const rows = await repo.findInvoicesByIds(tenant, [...ids], { includeDeleted: true });
    // The before state is the plain row state; the event belongs to the new state.
    return new Map(rows.map((invoice) => [invoice.id, invoiceAuditState(invoice)]));
  };
  const paymentStates = async (tenant: string, ids: readonly string[]) => {
    const rows = await repo.findPaymentsByIds(tenant, [...ids], { includeDeleted: true });
    return new Map(rows.map((payment) => [payment.id, paymentAuditState(payment)]));
  };

  return {
    deleteInvoiceById: async (id: string, deletedBy: string, deletionReason?: string) => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const before = await invoiceStates(tenant, [id]);
        const archived = await invoiceCrud.deleteById(id, deletedBy, deletionReason);
        if (archived) {
          await onInvoicesArchived(repo, tenant, [id]);
          const [invoice] = await repo.findInvoicesByIds(tenant, [id], { includeDeleted: true });
          if (invoice) {
            await recordInvoiceAudit(
              tenant,
              "DELETE",
              invoice,
              before.get(id) ?? null,
              "invoice_archived",
              deletionReason,
            );
          }
        }
        return archived;
      });
    },
    restoreInvoiceById: async (id: string, userId?: string) => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const before = await invoiceStates(tenant, [id]);
        const snapshot = await readArchivedInvoices(repo, tenant, [id]);
        const restored = await invoiceCrud.restoreById(id, userId);
        if (restored) {
          await onInvoicesRestored(tenant, snapshot);
          const [invoice] = await repo.findInvoicesByIds(tenant, [id], { includeDeleted: true });
          if (invoice) {
            await recordInvoiceAudit(
              tenant,
              "RESTORE",
              invoice,
              before.get(id) ?? null,
              "invoice_restored",
            );
          }
        }
        return restored;
      });
    },
    bulkSoftDeleteInvoices: async (ids: string[], deletedBy: string, deletionReason?: string) => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const before = await invoiceStates(tenant, ids);
        const result = await invoiceCrud.bulkDeleteByIds(ids, deletedBy, deletionReason);
        if (result.succeeded > 0) {
          await onInvoicesArchived(repo, tenant, ids);
          const archived = await repo.findInvoicesByIds(tenant, ids, { includeDeleted: true });
          for (const invoice of archived) {
            if (!invoice.deletedAt) continue;
            await recordInvoiceAudit(
              tenant,
              "DELETE",
              invoice,
              before.get(invoice.id) ?? null,
              "invoice_archived",
              deletionReason,
            );
          }
        }
        return result;
      });
    },
    bulkRestoreInvoices: async (ids: string[], userId?: string) => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const before = await invoiceStates(tenant, ids);
        const snapshot = await readArchivedInvoices(repo, tenant, ids);
        const result = await invoiceCrud.bulkRestoreByIds(ids, userId);
        if (result.succeeded > 0) {
          await onInvoicesRestored(tenant, snapshot);
          const restored = await repo.findInvoicesByIds(tenant, ids, { includeDeleted: true });
          for (const invoice of restored) {
            if (invoice.deletedAt) continue;
            await recordInvoiceAudit(
              tenant,
              "RESTORE",
              invoice,
              before.get(invoice.id) ?? null,
              "invoice_restored",
            );
          }
        }
        return result;
      });
    },

    deletePaymentById: async (id: string, deletedBy: string, deletionReason?: string) => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const before = await paymentStates(tenant, [id]);
        const archived = await paymentCrud.deleteById(id, deletedBy, deletionReason);
        if (archived) {
          await onPaymentsArchived(repo, tenant, [id]);
          const [payment] = await repo.findPaymentsByIds(tenant, [id], { includeDeleted: true });
          if (payment) {
            await recordPaymentAudit(
              tenant,
              payment,
              "DELETE",
              before.get(id) ?? null,
              deletionReason,
            );
          }
        }
        return archived;
      });
    },
    restorePaymentById: async (id: string, userId?: string) => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const before = await paymentStates(tenant, [id]);
        const snapshot = await readArchivedPayments(repo, tenant, [id]);
        const restored = await paymentCrud.restoreById(id, userId);
        if (restored) {
          await onPaymentsRestored(repo, tenant, snapshot);
          const [payment] = await repo.findPaymentsByIds(tenant, [id], { includeDeleted: true });
          if (payment) {
            await recordPaymentAudit(tenant, payment, "RESTORE", before.get(id) ?? null);
          }
        }
        return restored;
      });
    },
    bulkSoftDeletePayments: async (ids: string[], deletedBy: string, deletionReason?: string) => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const before = await paymentStates(tenant, ids);
        const result = await paymentCrud.bulkDeleteByIds(ids, deletedBy, deletionReason);
        if (result.succeeded > 0) {
          await onPaymentsArchived(repo, tenant, ids);
          const archived = await repo.findPaymentsByIds(tenant, ids, { includeDeleted: true });
          for (const payment of archived) {
            if (!payment.deletedAt) continue;
            await recordPaymentAudit(
              tenant,
              payment,
              "DELETE",
              before.get(payment.id) ?? null,
              deletionReason,
            );
          }
        }
        return result;
      });
    },
    bulkRestorePayments: async (ids: string[], userId?: string) => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const before = await paymentStates(tenant, ids);
        const snapshot = await readArchivedPayments(repo, tenant, ids);
        const result = await paymentCrud.bulkRestoreByIds(ids, userId);
        if (result.succeeded > 0) {
          await onPaymentsRestored(repo, tenant, snapshot);
          const restored = await repo.findPaymentsByIds(tenant, ids, { includeDeleted: true });
          for (const payment of restored) {
            if (payment.deletedAt) continue;
            await recordPaymentAudit(tenant, payment, "RESTORE", before.get(payment.id) ?? null);
          }
        }
        return result;
      });
    },
  };
}
