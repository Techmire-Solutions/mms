import { buildCsvContent, buildTenantExportFilename } from "@mms/shared";
import { NotFoundError } from "../lib/httpErrors.js";
import { throwIfBackgroundJobAborted } from "../lib/backgroundJobAbort.js";
import { registerBackgroundJobRunner } from "./backgroundJobWorkerService.js";
import { saveExportArtifact } from "./exportArtifactService.js";
import { examinationsRepository } from "../examinations/repository/examinationsRepositoryAdapter.js";
import { examEligibilityRepository } from "../examinations/repository/examEligibilityAdapter.js";

/**
 * Broadsheet export (`examinations:results-export`): one exam's marks as CSV.
 *
 * Reads the keyset-paginated marks page (never a full-table load), joins the roster for roll
 * number/student name, and writes through `buildCsvContent` — so `=`, `+`, `-`, `@`, `|` and
 * whitespace-prefixed formula payloads in student data are neutralised on the way out.
 *
 * Buffered by design: a single exam's broadsheet is bounded (50k marks ≈ a few MB); the row cap
 * aborts rather than letting a pathological tenant fill the 512 MB sandbox.
 */

const PAGE_SIZE = 500;
const MAX_ROWS = 50_000;

export interface ResultsExportJobPayload {
  examId: string;
  label?: string;
  /**
   * Graders receive the full broadsheet (draft marks + the moderation adjustment). Any other
   * caller is published-only, matching `GET /results`; older queued jobs default to the safe mode.
   */
  includeInternal?: boolean;
}

export function registerExaminationsResultsExportJobRunner(): void {
  registerBackgroundJobRunner("examinations:results-export", async (payload, ctx) => {
    const data = payload as ResultsExportJobPayload;
    const examId = String(data.examId ?? "").trim();
    if (!examId) throw new NotFoundError("Exam not found");

    const exam = await examinationsRepository.findExamById(ctx.tenant, examId);
    if (!exam) throw new NotFoundError("Exam not found");

    const includeInternal = data.includeInternal === true;
    if (!includeInternal && !exam.resultsFinalizedAt) {
      // A non-grader may not export a draft; the route already answers 404, this guards replays.
      throw new NotFoundError("Exam not found");
    }

    const roster = await examEligibilityRepository.loadExamRoster(ctx.tenant, examId);
    const rosterByStudent = new Map(roster.map((entry) => [entry.studentId, entry]));

    const grid: unknown[][] = [
      includeInternal
        ? [
            "Roll Number",
            "Student",
            "Student ID",
            "Marks Obtained",
            "Grace Marks",
            "Total Marks",
            "Exam",
            "Date",
          ]
        : ["Roll Number", "Student", "Student ID", "Marks Obtained", "Total Marks", "Exam", "Date"],
    ];
    let cursor: string | undefined;
    let count = 0;
    for (;;) {
      throwIfBackgroundJobAborted(ctx.signal);
      const page = await examinationsRepository.listExamResultsPage(ctx.tenant, {
        examId,
        limit: PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
        publishedOnly: !includeInternal,
      });
      for (const result of page.results) {
        const entry = rosterByStudent.get(String(result.studentId));
        const baseRow = [
          entry?.rollNumber ?? "",
          entry?.studentName ?? "",
          String(result.studentId),
          result.marksObtained,
        ];
        grid.push(
          includeInternal
            ? [...baseRow, result.graceMarks ?? "", exam.totalMarks, exam.name, exam.date ?? ""]
            : [...baseRow, exam.totalMarks, exam.name, exam.date ?? ""],
        );
        count += 1;
      }
      if (!page.hasMore) break;
      cursor = page.results[page.results.length - 1]?.id;
      if (!cursor || count >= MAX_ROWS) break;
      await ctx.updateProgress(count, Math.max(count, 1));
    }

    throwIfBackgroundJobAborted(ctx.signal);
    const filename = buildTenantExportFilename(
      ctx.tenant,
      `examinations-results-${exam.name.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 60) || examId}.csv`,
    );
    await saveExportArtifact(ctx.userId, ctx.jobId, buildCsvContent(grid), filename);
    await ctx.complete({
      label: data.label ?? `Exported ${count} marks`,
      progress: { current: count, total: Math.max(count, 1) },
      hasDownload: true,
    });
  });
}
