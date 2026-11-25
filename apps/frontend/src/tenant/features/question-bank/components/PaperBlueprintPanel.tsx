import { useMemo, useState } from "react";
import {
  assemblePaperBlueprint,
  BLUEPRINT_LIMITS,
  type BlueprintCandidate,
  type QuestionBankQuestion,
  type QuestionBankTest,
} from "@mms/contracts";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldErrorMessage,
  FormCollectionShell,
  FormListFieldCard,
} from "@/components/app/FormPrimitives";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/app/FormSelect";
import { FORM_INPUT, WORK_SURFACE } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  BlueprintRowCard,
  type BlueprintRowValue,
} from "@/tenant/features/question-bank/components/BlueprintRowCard";
import { PaperBlueprintPreview } from "@/tenant/features/question-bank/components/PaperBlueprintPreview";
import { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";
import { useQuestionBankMutations } from "@/tenant/features/question-bank/hooks/useQuestionBankMutations";

interface BlueprintRow extends BlueprintRowValue {
  id: string;
}

interface AssembleResult {
  selectedCount: number;
  totalMarks: number;
  deficits: Array<{ bucketIndex: number; requestedCount: number; selectedCount: number }>;
}

// Monotonic fallback for environments without `crypto.randomUUID`; the row id is
// only a React key / row identity, so a counter is sufficient and keeps render pure.
let blueprintRowFallbackId = 0;

function createBlueprintRow(): BlueprintRow {
  blueprintRowFallbackId += 1;
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `bp_${blueprintRowFallbackId}`,
    categoryId: "",
    difficulty: "",
    type: "",
    count: "5",
  };
}
const MAX_BUCKETS = BLUEPRINT_LIMITS.maxBuckets;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseCount(raw: string): number | null {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 ? value : null;
}

interface PaperBlueprintPanelProps {
  questions: QuestionBankQuestion[];
  tests: QuestionBankTest[];
  canWrite: boolean;
}

/**
 * Blueprint → deterministic assembly (migration 0242).
 *
 * The panel previews the paper with the same shared engine the server runs: available counts, selected
 * count/marks and deficit buckets update as the rows change. "Assemble" commits it server-side; the
 * preview is a computation over the loaded bank snapshot, not a reservation.
 */
export function PaperBlueprintPanel({
  questions,
  tests,
  canWrite,
}: PaperBlueprintPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const { categories } = useQuestionBankConfig(questions);
  const { assemblePaper } = useQuestionBankMutations();
  const [paperId, setPaperId] = useState("");
  const [recencyDays, setRecencyDays] = useState("0");
  // `Date.now()` is stamped at the input event, not during render, so the candidate
  // preview stays pure. The preview window is an approximation anyway: the server
  // stamps its own window authoritatively when the paper is assembled.
  const [recencyStamp, setRecencyStamp] = useState(0);
  const [rows, setRows] = useState<BlueprintRow[]>(() => [createBlueprintRow()]);
  const [result, setResult] = useState<AssembleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paperOptions = useMemo(
    () => tests.map((test) => ({ value: test.id, label: test.name })),
    [tests],
  );

  const handleRecencyChange = (value: string): void => {
    setRecencyDays(value);
    setRecencyStamp(Date.now());
  };

  const recency = Math.max(0, Math.min(365, Number(recencyDays) || 0));
  const invalidRows = rows.some((row) => parseCount(row.count) === null);

  // Approved, non-deleted candidates with the same recency exclusion the server applies
  // (`tests.createdAt` within the window).
  const candidates = useMemo<BlueprintCandidate[]>(() => {
    const cutoff = recency > 0 && recencyStamp > 0 ? recencyStamp - recency * DAY_MS : null;
    const recentlyUsed = new Set<string>();
    if (cutoff) {
      for (const test of tests) {
        const createdAt = new Date(test.createdAt).getTime();
        if (Number.isFinite(createdAt) && createdAt >= cutoff) {
          for (const questionId of test.questionIds) recentlyUsed.add(questionId);
        }
      }
    }
    return questions
      .filter(
        (question) =>
          question.status === "approved" && !question.deletedAt && !recentlyUsed.has(question.id),
      )
      .map((question) => ({
        id: question.id,
        difficulty: question.difficulty,
        type: question.type,
        marks: question.marks ?? 1,
        categoryIds: question.categoryIds,
      }));
  }, [questions, tests, recency, recencyStamp]);

  const preview = useMemo(() => {
    if (!paperId || invalidRows) return null;
    try {
      return assemblePaperBlueprint({
        seed: paperId,
        blueprint: {
          seed: paperId,
          excludeRecentlyUsedDays: recency,
          buckets: rows.map((row) => ({
            ...(row.categoryId ? { categoryId: row.categoryId } : {}),
            ...(row.difficulty
              ? { difficulty: row.difficulty as BlueprintCandidate["difficulty"] }
              : {}),
            ...(row.type ? { type: row.type as BlueprintCandidate["type"] } : {}),
            count: parseCount(row.count) ?? 1,
          })),
        },
        candidates,
      });
    } catch {
      return null;
    }
  }, [paperId, invalidRows, rows, recency, candidates]);

  const availableFor = (row: BlueprintRow): number =>
    candidates.filter(
      (candidate) =>
        (!row.categoryId || candidate.categoryIds.includes(row.categoryId)) &&
        (!row.difficulty || candidate.difficulty === row.difficulty) &&
        (!row.type || candidate.type === row.type),
    ).length;

  const updateRow = (id: string, patch: Partial<BlueprintRow>): void => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const assemble = async (): Promise<void> => {
    if (!paperId || invalidRows || assemblePaper.isPending) return;
    setError(null);
    try {
      const response = await assemblePaper.mutateAsync(paperId, {
        seed: paperId,
        excludeRecentlyUsedDays: recency,
        buckets: rows.map((row) => ({
          ...(row.categoryId ? { categoryId: row.categoryId } : {}),
          ...(row.difficulty ? { difficulty: row.difficulty } : {}),
          ...(row.type ? { type: row.type } : {}),
          count: parseCount(row.count) ?? 1,
        })),
      });
      setResult((response as { body?: AssembleResult }).body ?? null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      notify.error(t("questionBank.blueprintAssembleFailed"), { description: message });
    }
  };

  return (
    <section className={`${WORK_SURFACE} flex flex-col gap-4 p-4 sm:p-5`}>
      <div>
        <h2 className="m-0 text-sm font-bold text-foreground">
          {t("questionBank.blueprintTitle")}
        </h2>
        <p className="m-0 text-xs text-muted-foreground">{t("questionBank.blueprintSubtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="qb-blueprint-paper" label={t("questionBank.blueprintPaper")}>
          <FormSelect
            id="qb-blueprint-paper"
            name="blueprintPaper"
            className={FORM_INPUT}
            value={paperId}
            onChange={setPaperId}
            options={paperOptions}
            placeholder={t("questionBank.blueprintPaper")}
          />
        </Field>
        <Field id="qb-blueprint-recency" label={t("questionBank.blueprintRecency")}>
          <Input
            id="qb-blueprint-recency"
            name="blueprintRecency"
            type="number"
            inputMode="numeric"
            min={0}
            max={365}
            className={FORM_INPUT}
            value={recencyDays}
            onChange={(event) => handleRecencyChange(event.target.value)}
          />
        </Field>
      </div>

      <FormCollectionShell
        addLabel={t("common.add")}
        onAdd={() => setRows((current) => [...current, createBlueprintRow()])}
        addDisabled={rows.length >= MAX_BUCKETS}
        listKey="qb-blueprint-rows"
      >
        {rows.map((row, index) => (
          <FormListFieldCard
            key={row.id}
            id={row.id}
            index={index}
            label={t("questionBank.blueprintRow", { n: index + 1 })}
            removeLabel={t("common.delete")}
            canRemove={rows.length > 1}
            onRemove={() => setRows((current) => current.filter((item) => item.id !== row.id))}
          >
            <BlueprintRowCard
              row={row}
              rowId={row.id}
              index={index}
              categories={categories}
              availableCount={availableFor(row)}
              onUpdate={(patch) => updateRow(row.id, patch)}
            />
          </FormListFieldCard>
        ))}
      </FormCollectionShell>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!canWrite || !paperId || invalidRows || assemblePaper.isPending}
          onClick={() => void assemble()}
        >
          {assemblePaper.isPending
            ? t("questionBank.blueprintAssembling")
            : t("questionBank.blueprintAssemble")}
        </Button>
      </div>

      <FieldErrorMessage
        message={invalidRows ? t("questionBank.blueprintInvalidCount") : undefined}
      />
      {error && (
        <p role="alert" className="m-0 text-xs text-destructive">
          {t("questionBank.blueprintAssembleFailed")}: {error}
        </p>
      )}

      <PaperBlueprintPreview
        preview={
          preview
            ? {
                selectedCount: preview.selected.length,
                totalMarks: preview.totalMarks,
                deficits: preview.deficits,
              }
            : null
        }
        result={result}
      />
    </section>
  );
}
