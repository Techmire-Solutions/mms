import type { BackgroundJobRecord } from "@mms/contracts";

export interface AccountingJobEnqueuer {
  getUserJob(userId: string, jobId: string): Promise<BackgroundJobRecord | null>;
  enqueueJob(
    tenant: string,
    userId: string,
    job: BackgroundJobRecord,
    payload: unknown,
  ): Promise<BackgroundJobRecord>;
  enqueueCsvExport(input: {
    tenant: string;
    userId: string;
    moduleId: string;
    kind?: string;
    label: string;
    query: Record<string, unknown>;
    filename?: string;
    viewerRole: string;
    allowDeleted: boolean;
    idempotencyKey?: string;
  }): Promise<BackgroundJobRecord>;
  isQueueUnavailable(error: unknown): boolean;
}

let enqueuer: AccountingJobEnqueuer | null = null;

export function configureAccountingJobEnqueuer(port: AccountingJobEnqueuer): void {
  enqueuer = port;
}

export function getAccountingJobEnqueuer(): AccountingJobEnqueuer {
  if (!enqueuer) throw new Error("Accounting job enqueuer is not configured");
  return enqueuer;
}
