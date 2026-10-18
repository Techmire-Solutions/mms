import { backgroundJobUpsertSchema } from "../schemas/backgroundJob.dto.js";
export { backgroundJobUpsertSchema };
/** Cross-module background job record. */
export type BackgroundJobStatus = "pending" | "running" | "completed" | "failed";

export interface BackgroundJobRecord {
  id: string;
  moduleId: string;
  kind: string;
  status: BackgroundJobStatus;
  label: string;
  progress?: { current: number; total: number };
  error?: string;
  /** When true, GET /api/background-jobs/:id/download serves a server-generated file. */
  hasDownload?: boolean;
  createdAt: string;
  completedAt?: string;
}

/** REST API base endpoint route for managing background job states and downloads. */
export const BACKGROUND_JOBS_API_PATH = "/api/background-jobs" as const;

/** Maximum allowed active or retained background jobs per tenant user. */
export const BACKGROUND_JOBS_MAX_PER_USER = 50;

/** WebSocket PubSub payload for background job events. */
export interface BackgroundJobEventMessage {
  event: "job-progress" | "job-completed" | "job-failed";
  tenantId: string;
  userId?: string;
  jobId: string;
  moduleId?: string;
  kind?: string;
  label?: string;
  progress?: { current: number; total: number; percent: number };
  hasDownload?: boolean;
  error?: string;
  completedAt?: string;
}
