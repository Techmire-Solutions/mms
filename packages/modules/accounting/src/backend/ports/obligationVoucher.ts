import type { ObligationCollection, ObligationDistribution, WakalaType } from "@mms/contracts";

/**
 * The data the accounting ledger posting needs from the obligations domain.
 *
 * Obligations lives in its own module; this port is the only edge accounting may
 * use toward it. The app composition root configures the real obligations
 * repositories here (see `apps/api/src/modules/accounting/configure.ts`).
 */
export interface ObligationVoucherPort {
  findObligationCollectionById(tenant: string, id: string): Promise<ObligationCollection | null>;
  listWakalaTypesByWorkspace(tenant: string): Promise<WakalaType[]>;
  listObligationDistributionsByWorkspace(tenant: string): Promise<ObligationDistribution[]>;
}

let obligationVoucherPort: ObligationVoucherPort | null = null;

export function configureObligationVoucherPort(port: ObligationVoucherPort): void {
  obligationVoucherPort = port;
}

export function getObligationVoucherPort(): ObligationVoucherPort {
  if (!obligationVoucherPort) throw new Error("Obligation voucher port is not configured");
  return obligationVoucherPort;
}
