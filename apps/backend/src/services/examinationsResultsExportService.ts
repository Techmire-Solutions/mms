import { PassThrough } from "node:stream";
import { once } from "node:events";
import { buildCsvContent, buildTenantExportFilename } from "@mms/shared";
import { NotFoundError } from "../lib/httpErrors.js";
import { throwIfBackgroundJobAborted } from "../lib/backgroundJobAbort.js";
import { resolveTenantExportKey, uploadStreamToStorage } from "../config/storage.js";
import { registerBackgroundJobRunner } from "./backgroundJobWorkerService.js";
import { saveStreamedExportArtifact } from "./exportArtifactService.js";
import { examinationsRepository } from "../examinations/repository/examinationsRepositoryAdapter.js";
import { examEligibilityRepository } from "../examinations/repository/examEligibilityAdapter.js";

/**
 * Broadsheet export (`examinations:results-export`): one exam's marks as CSV.
 *
 * Streams the CSV to storage page by page: the marks are keyset-paged (500), each page is
 * escaped through `buildCsvContent` (neutralising `=`, `+`, `-`, `@`, `|` and whitespace-prefixed
 * formula payloads in student data) and written to a `PassThrough` consumed by the storage upload.
 * The grid is never accumulated in memory — a 50k-row broadsheet would otherwise hold the rows,
 * the joined string and the artifact copy at once in the 512 MB sandbox.
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

/** Writes a chunk, waiting for drain so a slow upload cannot grow the buffer unboundedly. */
async function writeChunk(stream: PassThrough, text: string): Promise<void> {
  if (stream.write(text)) return;
  await once(stream, "drain");
}

export function registerExaminationsResultsExportJobRunner(): void {
  registerBackgroundJobRunner("examinations:results-export", async (payload, ctx) => {
    const data = payload as ResultsExportJobPayload;
    const examId = String(data.examId ?? "").trim();
    if (!examId) throw new NotFoundError("Exam not found");

    const exam = await examinationsRepository.findExamById(ctx.tenant, examId);
    if (!exam) throw new NotFoundError("Exam not found");
    if (!exam.resultsFinalizedAt && data.includeInternal !== true) {
      // A non-grader may not export a draft; the route already answers 404, this guards replays.
      throw new NotFoundError("Exam not found");
    }

    const includeInternal = data.includeInternal === true;
    const roster = await examEligibilityRepository.loadExamRoster(ctx.tenant, examId);
    const rosterByStudent = new Map(roster.map((entry) => [entry.studentId, entry]));

    const header = includeInternal
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
      : ["Roll Number", "Student", "Student ID", "Marks Obtained", "Total Marks", "Exam", "Date"];

    const filename = buildTenantExportFilename(
      ctx.tenant,
      `examinations-results-${exam.name.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 60) || examId}.csv`,
    );
    const key = resolveTenantExportKey(ctx.tenant, filename);
    const stream = new PassThrough();
    const uploadPromise = uploadStreamToStorage(
      ctx.tenant,
      key,
      stream,
      "text/csv; charset=utf-8",
      { signal: ctx.signal },
    );
    // Do not let a storage failure before the first write surface as an unhandled rejection while
    // the page loop awaits the repository.
    void uploadPromise.catch(() => undefined);

    let count = 0;
    try {
      await writeChunk(stream, `${buildCsvContent([header])}\n`);

      let cursor: string | undefined;
      for (;;) {
        throwIfBackgroundJobAborted(ctx.signal);
        const page = await examinationsRepository.listExamResultsPage(ctx.tenant, {
          examId,
          limit: PAGE_SIZE,
          ...(cursor ? { cursor } : {}),
          publishedOnly: !includeInternal,
        });
        const remaining = MAX_ROWS - count;
        const rows: unknown[][] = [];
        for (const result of page.results.slice(0, Math.max(0, remaining))) {
          const entry = rosterByStudent.get(String(result.studentId));
          const baseRow = [
            entry?.rollNumber ?? "",
            entry?.studentName ?? "",
            String(result.studentId),
            result.marksObtained,
          ];
          rows.push(
            includeInternal
              ? [...baseRow, result.graceMarks ?? "", exam.totalMarks, exam.name, exam.date ?? ""]
              : [...baseRow, exam.totalMarks, exam.name, exam.date ?? ""],
          );
        }
        if (rows.length > 0) {
          await writeChunk(stream, `${buildCsvContent(rows)}\n`);
          count += rows.length;
        }
        if (!page.hasMore || count >= MAX_ROWS) break;
        cursor = page.results[page.results.length - 1]?.id;
        if (!cursor) break;
        await ctx.updateProgress(count, Math.max(count, 1));
      }

      throwIfBackgroundJobAborted(ctx.signal);
      stream.end();
      const uploaded = await uploadPromise;
      await saveStreamedExportArtifact(ctx.userId, ctx.jobId, {
        key: uploaded.key,
        storageType: uploaded.storageType,
        filename,
        contentType: "text/csv; charset=utf-8",
      });
      await ctx.complete({
        label: data.label ?? `Exported ${count} marks`,
        progress: { current: count, total: Math.max(count, 1) },
        hasDownload: true,
      });
    } catch (error) {
      stream.destroy(error instanceof Error ? error : new Error(String(error)));
      await uploadPromise.catch(() => undefined);
      throw error;
    }
  });
}
