import type { JobsOptions } from "bullmq";

export const TENANT_PRIORITY_BANDS = {
  BAND_1_LOW_LOAD: 1,
  BAND_2_NORMAL_LOAD: 2,
  BAND_3_HIGH_LOAD: 3,
} as const;

/** Shared BullMQ job defaults (retry/backoff/retention). */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000,
  },
  removeOnComplete: {
    count: 100,
    age: 3600,
  },
  removeOnFail: {
    count: 500,
    age: 86400,
  },
};
