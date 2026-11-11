import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExamLifecycleState } from "../examinations/repository/examEligibilityPort.js";

const repo = vi.hoisted(() => ({
  findExamLifecycleState: vi.fn(),
  countExamResultsForExam: vi.fn(),
  findOwningSessionStatuses: vi.fn(),
  setExamResultsFinalized: vi.fn(),
}));

vi.mock("../examinations/repository/examEligibilityAdapter.js", () => ({
  examEligibilityRepository: repo,
}));

const { publishExamResults, unpublishExamResults } =
  await import("../examinations/use-cases/examLifecycleUseCases.js");

const TENANT = "demo";
const EXAM = "ex-1";
const ACTOR = "user-1";

function state(overrides: Partial<ExamLifecycleState> = {}): ExamLifecycleState {
  return {
    id: EXAM,
    status: "ongoing",
    resultsFinalizedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  repo.findExamLifecycleState.mockResolvedValue(state());
  repo.countExamResultsForExam.mockResolvedValue(3);
  repo.findOwningSessionStatuses.mockResolvedValue(["open"]);
  repo.setExamResultsFinalized.mockImplementation(
    async (_tenant: string, input: { resultsFinalizedAt: Date | null; status: string }) => ({
      examId: EXAM,
      resultsFinalizedAt: input.resultsFinalizedAt,
      status: input.status,
    }),
  );
});

describe("publishExamResults", () => {
  it("publishes with the completed status the lifecycle decides", async () => {
    const result = await publishExamResults(TENANT, { examId: EXAM, actorId: ACTOR });

    expect(repo.setExamResultsFinalized).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({ examId: EXAM, status: "completed", actorId: ACTOR }),
    );
    const call = repo.setExamResultsFinalized.mock.calls[0]?.[1] as {
      resultsFinalizedAt: Date | null;
    };
    expect(call.resultsFinalizedAt).toBeInstanceOf(Date);
    expect(result.status).toBe("completed");
  });

  it("404s for an unknown exam", async () => {
    repo.findExamLifecycleState.mockResolvedValue(null);
    await expect(
      publishExamResults(TENANT, { examId: EXAM, actorId: ACTOR }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("refuses an archived exam", async () => {
    repo.findExamLifecycleState.mockResolvedValue(state({ deletedAt: new Date() }));
    await expect(
      publishExamResults(TENANT, { examId: EXAM, actorId: ACTOR }),
    ).rejects.toMatchObject({ statusCode: 409, type: "exam_archived" });
    expect(repo.setExamResultsFinalized).not.toHaveBeenCalled();
  });

  it("refuses a cancelled sitting", async () => {
    repo.findExamLifecycleState.mockResolvedValue(state({ status: "cancelled" }));
    await expect(
      publishExamResults(TENANT, { examId: EXAM, actorId: ACTOR }),
    ).rejects.toMatchObject({ statusCode: 409, type: "exam_cancelled" });
  });

  it("refuses to publish twice", async () => {
    repo.findExamLifecycleState.mockResolvedValue(
      state({ resultsFinalizedAt: new Date("2026-03-01T00:00:00Z"), status: "completed" }),
    );
    await expect(
      publishExamResults(TENANT, { examId: EXAM, actorId: ACTOR }),
    ).rejects.toMatchObject({ statusCode: 409, type: "exam_already_published" });
  });

  it("refuses to publish an exam nobody sat", async () => {
    repo.countExamResultsForExam.mockResolvedValue(0);
    await expect(
      publishExamResults(TENANT, { examId: EXAM, actorId: ACTOR }),
    ).rejects.toMatchObject({ statusCode: 409, type: "exam_no_results" });
    expect(repo.setExamResultsFinalized).not.toHaveBeenCalled();
  });
});

describe("unpublishExamResults", () => {
  const published = () =>
    state({ resultsFinalizedAt: new Date("2026-03-01T00:00:00Z"), status: "completed" });

  it("requires a reason — the unlock is audited", async () => {
    repo.findExamLifecycleState.mockResolvedValue(published());
    await expect(
      unpublishExamResults(TENANT, { examId: EXAM, actorId: ACTOR, reason: "  " }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.setExamResultsFinalized).not.toHaveBeenCalled();
  });

  it("refuses when the results are not published", async () => {
    await expect(
      unpublishExamResults(TENANT, { examId: EXAM, actorId: ACTOR, reason: "correct a mark" }),
    ).rejects.toMatchObject({ statusCode: 409, type: "exam_not_published" });
  });

  it("refuses once an owning session is completed — the evidence was already consumed", async () => {
    repo.findExamLifecycleState.mockResolvedValue(published());
    repo.findOwningSessionStatuses.mockResolvedValue(["open", "completed"]);
    await expect(
      unpublishExamResults(TENANT, { examId: EXAM, actorId: ACTOR, reason: "correct a mark" }),
    ).rejects.toMatchObject({ statusCode: 409, type: "unpublish_blocked_session_completed" });
    expect(repo.setExamResultsFinalized).not.toHaveBeenCalled();
  });

  it("re-opens to ongoing (never leaving the stale completed status) and records the reason", async () => {
    repo.findExamLifecycleState.mockResolvedValue(published());

    const result = await unpublishExamResults(TENANT, {
      examId: EXAM,
      actorId: ACTOR,
      reason: "correct a mark",
    });

    expect(repo.setExamResultsFinalized).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({
        examId: EXAM,
        resultsFinalizedAt: null,
        status: "ongoing",
        reason: "correct a mark",
      }),
    );
    expect(result.status).toBe("ongoing");
    expect(result.resultsFinalizedAt).toBeNull();
  });
});
