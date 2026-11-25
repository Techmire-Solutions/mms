/**
 * Cross-module seam the obligations backend needs: the accounting chart of
 * accounts (module→module edges are disallowed; the app wires this once).
 */
export interface ObligationsPorts {
  listAccountsByWorkspace(
    tenant: string,
  ): Promise<Array<{ id: string; code: string; name: string }>>;
  syncObligationJournal: (...args: any[]) => Promise<any>;
  tryPostObligationArchiveJournal: (...args: any[]) => Promise<any>;
  tryPostObligationJournal: (...args: any[]) => Promise<any>;
  tryPostObligationRestoreJournal: (...args: any[]) => Promise<any>;
  findObligationJournalEntry: (...args: any[]) => Promise<any>;
}

let ports: ObligationsPorts | null = null;

export function configureObligationsPorts(next: ObligationsPorts): void {
  ports = next;
}

function requirePorts(): ObligationsPorts {
  if (!ports)
    throw new Error("Obligations ports are not configured (call configureObligationsPorts)");
  return ports;
}

export function obligationsListAccountsByWorkspace(tenant: string) {
  return requirePorts().listAccountsByWorkspace(tenant);
}
export function obligationsSyncObligationJournal(...args: any[]) {
  return requirePorts().syncObligationJournal(...args);
}
export function obligationsTryPostObligationArchiveJournal(...args: any[]) {
  return requirePorts().tryPostObligationArchiveJournal(...args);
}
export function obligationsTryPostObligationJournal(...args: any[]) {
  return requirePorts().tryPostObligationJournal(...args);
}
export function obligationsTryPostObligationRestoreJournal(...args: any[]) {
  return requirePorts().tryPostObligationRestoreJournal(...args);
}
export function obligationsFindObligationJournalEntry(...args: any[]) {
  return requirePorts().findObligationJournalEntry(...args);
}
