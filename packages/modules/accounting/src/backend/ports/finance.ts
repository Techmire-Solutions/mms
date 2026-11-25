export interface AccountingFinancePort {
  createInvoice(input: Record<string, unknown>): Promise<{ id: string }>;
  createPayment(input: Record<string, unknown>): Promise<{ id: string }>;
}

let financePort: AccountingFinancePort | null = null;
export function configureAccountingFinancePort(port: AccountingFinancePort): void {
  financePort = port;
}
export function getAccountingFinancePort(): AccountingFinancePort {
  if (!financePort) throw new Error("Accounting finance port is not configured");
  return financePort;
}
