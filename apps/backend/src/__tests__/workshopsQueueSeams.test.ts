import { describe, expect, it } from "vitest";
import { backgroundJobModuleAction } from "../lib/backgroundJobModuleAccess.js";
import { resolveQueueNameForJob } from "../worker/queues/index.js";
import {
  QUEUE_WORKSHOPS,
  WORKSHOPS_IMPORT_TIMEOUT_MS,
  resolveJobExecutionTimeoutMs,
} from "../worker/queues/queueConfig.js";

describe("workshop queue seams", () => {
  it("classifies import and notification jobs as write actions", () => {
    for (const kind of [
      "import",
      "reminder",
      "waitlist-alert",
      "certificate-dispatch",
      "feedback-dispatch",
    ]) {
      expect(backgroundJobModuleAction(kind), kind).toBe("write");
    }
    expect(backgroundJobModuleAction("export")).toBe("export");
  });

  it("routes workshop jobs to their own queue with the long import budget", () => {
    expect(resolveQueueNameForJob("workshops", "import")).toBe(QUEUE_WORKSHOPS);
    expect(resolveQueueNameForJob("Workshops", "reminder")).toBe(QUEUE_WORKSHOPS);
    expect(resolveJobExecutionTimeoutMs("workshops", "import")).toBe(WORKSHOPS_IMPORT_TIMEOUT_MS);
  });
});
