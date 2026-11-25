/** Default period for "new records" command-centre metrics (globle1 §2.1). */
export const CONTACT_METRICS_DEFAULT_PERIOD_DAYS = 30;

export interface ContactsCommandMetricsSnapshot {
  total: number;
  newThisPeriod: number;
  whatsappCount: number;
  incompleteCount: number;
  duplicatePairCount: number;
}
