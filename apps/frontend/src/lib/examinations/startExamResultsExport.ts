import { apiJson } from "@/lib/apiClient";

/**
 * Queues the broadsheet export for one exam.
 *
 * Lives in `src/lib` because the export route is a plain Fastify endpoint (the module's CSV
 * transfer routes are not part of the ts-rest contract); tenant components must not import the raw
 * transport directly.
 */
export async function startExamResultsExport(examId: string): Promise<void> {
  await apiJson(`/api/examinations/exams/${examId}/results/export`, { method: "POST" });
}
