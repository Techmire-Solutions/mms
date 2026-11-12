import { and, eq, isNotNull, sql } from "drizzle-orm";
import { assessmentResults, questions, testQuestions, tests } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { ConflictError, NotFoundError } from "../../lib/httpErrors.js";
import { auditQuestionBankEntity } from "./questionBankAudit.js";
import { testSelectFields } from "./questionBankTestsHydrate.js";

/** Paper publication changes (publish freezes a snapshot; unpublish is refused after results). */
export interface PaperPublicationChange {
  readonly testId: string;
  readonly published: boolean;
  readonly actorId: string;
}

export async function setPaperPublished(
  tenant: string,
  change: PaperPublicationChange,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    const [paper] = await tx
      .select(testSelectFields)
      .from(tests)
      .where(and(eq(tests.workspaceSubdomain, subdomain), eq(tests.id, change.testId)))
      .for("update");
    if (!paper) throw new NotFoundError(`Paper ${change.testId} not found`);
    if (paper.deletedAt) {
      throw new ConflictError(
        `Paper ${change.testId} is archived — restore it before publishing`,
        "paper_archived",
        { testId: change.testId },
      );
    }

    if (!change.published) {
      const [result] = await tx
        .select({ id: assessmentResults.id })
        .from(assessmentResults)
        .where(
          and(
            eq(assessmentResults.workspaceSubdomain, subdomain),
            eq(assessmentResults.testId, change.testId),
          ),
        )
        .limit(1);
      if (result) {
        throw new ConflictError(
          `Paper ${change.testId} already has assessment results — it cannot be unpublished`,
          "paper_has_results",
          { testId: change.testId },
        );
      }
      await tx
        .update(tests)
        .set({ publishedAt: null, publishedBy: null, updatedAt: new Date() })
        .where(and(eq(tests.workspaceSubdomain, subdomain), eq(tests.id, change.testId)));
      await auditQuestionBankEntity(tx, {
        subdomain,
        tableName: "tests",
        recordId: change.testId,
        actionType: "UPDATE",
        actorId: change.actorId,
        oldState: { publishedAt: paper.publishedAt?.toISOString() ?? null },
        newState: { publishedAt: null, publishedBy: null },
      });
      return;
    }

    const [link] = await tx
      .select({ questionId: testQuestions.questionId })
      .from(testQuestions)
      .where(
        and(
          eq(testQuestions.workspaceSubdomain, subdomain),
          eq(testQuestions.testId, change.testId),
        ),
      )
      .limit(1);
    if (!link) {
      throw new ConflictError(`Paper ${change.testId} has no questions to publish`, "paper_empty", {
        testId: change.testId,
      });
    }

    const [archived] = await tx
      .select({ questionId: questions.id })
      .from(testQuestions)
      .innerJoin(
        questions,
        and(
          eq(questions.workspaceSubdomain, testQuestions.workspaceSubdomain),
          eq(questions.id, testQuestions.questionId),
        ),
      )
      .where(
        and(
          eq(testQuestions.workspaceSubdomain, subdomain),
          eq(testQuestions.testId, change.testId),
          isNotNull(questions.deletedAt),
        ),
      )
      .limit(1);
    if (archived) {
      throw new ConflictError(
        `Paper ${change.testId} references an archived question (${archived.questionId}) — restore or replace it first`,
        "paper_question_archived",
        { testId: change.testId, questionId: archived.questionId },
      );
    }

    await tx
      .update(tests)
      .set({ publishedAt: new Date(), publishedBy: change.actorId, updatedAt: new Date() })
      .where(and(eq(tests.workspaceSubdomain, subdomain), eq(tests.id, change.testId)));

    await tx.execute(sql`
      UPDATE test_questions tq
         SET question_snapshot = jsonb_build_object(
               'id', q.id,
               'type', q.type,
               'text', q.text,
               'answer', q.answer,
               'marks', q.marks,
               'difficulty', q.difficulty,
               'options', COALESCE((
                 SELECT jsonb_agg(qo.option_text ORDER BY qo.option_index)
                   FROM question_options qo
                  WHERE qo.workspace_subdomain = q.workspace_subdomain
                    AND qo.question_id = q.id
               ), '[]'::jsonb)
             )
        FROM questions q
       WHERE tq.workspace_subdomain = ${subdomain}
         AND tq.test_id = ${change.testId}
         AND q.workspace_subdomain = tq.workspace_subdomain
         AND q.id = tq.question_id
    `);

    await auditQuestionBankEntity(tx, {
      subdomain,
      tableName: "tests",
      recordId: change.testId,
      actionType: "UPDATE",
      actorId: change.actorId,
      oldState: { publishedAt: paper.publishedAt?.toISOString() ?? null },
      newState: { publishedAt: new Date().toISOString(), publishedBy: change.actorId },
    });
  });
}
