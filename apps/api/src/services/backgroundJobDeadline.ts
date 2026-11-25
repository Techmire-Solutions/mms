import { configureJobTimeoutResolver } from "@mms/be-core/jobs/backgroundJobDeadline";
import { resolveJobExecutionTimeoutMs } from "../worker/queues/queueConfig.js";

configureJobTimeoutResolver(resolveJobExecutionTimeoutMs);

export * from "@mms/be-core/jobs/backgroundJobDeadline";
