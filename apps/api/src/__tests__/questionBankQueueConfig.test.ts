import { describe, expect, it } from "vitest";
import {
  QUEUE_QUESTION_BANK,
  resolveJobExecutionTimeoutMs,
  SANDBOXED_EXPORT_QUEUES,
} from "../worker/queues/queueConfig.js";
import { resolveQueueNameForJob } from "../worker/queues/index.js";

describe("question bank queue wiring", () => {
  it("routes questionBank jobs to their own sandboxed queue", () => {
    expect(resolveQueueNameForJob("questionBank", "import")).toBe(QUEUE_QUESTION_BANK);
    expect(resolveQueueNameForJob("QuestionBank", "export")).toBe(QUEUE_QUESTION_BANK);
    expect(SANDBOXED_EXPORT_QUEUES).toContain(QUEUE_QUESTION_BANK);
  });

  it("gives imports and exports a ten-minute budget, not the 60s default", () => {
    expect(resolveJobExecutionTimeoutMs("questionBank", "import")).toBe(10 * 60_000);
    expect(resolveJobExecutionTimeoutMs("questionBank", "export")).toBe(10 * 60_000);
    expect(resolveJobExecutionTimeoutMs("questionBank", "item-analysis")).toBe(10 * 60_000);
  });
});
