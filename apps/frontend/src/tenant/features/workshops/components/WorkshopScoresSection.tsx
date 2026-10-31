import React, { useMemo, useState } from "react";
import type { WorkshopDetail } from "@mms/shared";
import { Field } from "@/components/app/FormPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { useSaveWorkshopScores } from "../hooks/useWorkshopsApi";

export interface WorkshopScoresSectionProps {
  detail: WorkshopDetail;
  canWrite: boolean;
}

/** Scores for one criterion at a time; saving the same criterion again updates it. */
export function WorkshopScoresSection({
  detail,
  canWrite,
}: WorkshopScoresSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const { workshop, participants, scores } = detail;
  const criteria = useMemo(
    () => [...new Set(scores.map((line) => line.criterionName))].sort(),
    [scores],
  );
  const [criterion, setCriterion] = useState("");
  const [maxScore, setMaxScore] = useState("10");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const save = useSaveWorkshopScores();
  const editable = canWrite && !workshop.deletedAt;

  const pickCriterion = (name: string) => {
    setCriterion(name);
    const lines = scores.filter((line) => line.criterionName === name);
    setMaxScore(String(lines[0]?.maxScore ?? 10));
    setDraft(Object.fromEntries(lines.map((line) => [line.participantId, String(line.score)])));
  };

  const max = Number(maxScore);
  const lines = Object.entries(draft)
    .filter(([, value]) => value.trim() !== "")
    .map(([participantId, value]) => ({ participantId, score: Number(value) }));
  const invalid =
    !criterion.trim() ||
    !(max > 0) ||
    lines.length === 0 ||
    lines.some((line) => !(line.score >= 0 && line.score <= max));

  const handleSave = async () => {
    if (invalid) return;
    try {
      await save.mutateAsync({
        id: workshop.id,
        body: {
          scores: lines.map((line) => ({
            ...line,
            criterionName: criterion.trim(),
            maxScore: max,
          })),
        },
      });
      notify.success(t("workshops.scoresSaved"));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : t("workshops.saveFailed"));
    }
  };

  return (
    <section aria-labelledby="workshop-scores-heading" className="space-y-3">
      <h3 id="workshop-scores-heading" className="text-sm font-semibold text-foreground">
        {t("workshops.scores")}
      </h3>

      {criteria.length > 0 ? (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t("workshops.savedCriteria")}
        >
          {criteria.map((name) => (
            <Button
              key={name}
              type="button"
              size="sm"
              variant={name === criterion ? "default" : "outline"}
              aria-pressed={name === criterion}
              className="min-h-11"
              onClick={() => pickCriterion(name)}
            >
              {name}
            </Button>
          ))}
        </div>
      ) : null}

      {participants.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("workshops.noParticipants")}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem]">
            <Field id="workshop-score-criterion" label={t("workshops.criterion")}>
              <Input
                id="workshop-score-criterion"
                name="criterionName"
                value={criterion}
                disabled={!editable}
                onChange={(e) => setCriterion(e.target.value)}
                placeholder={t("workshops.criterionPlaceholder")}
              />
            </Field>
            <Field id="workshop-score-max" label={t("workshops.maxScore")}>
              <Input
                id="workshop-score-max"
                name="maxScore"
                type="number"
                inputMode="decimal"
                min={0}
                value={maxScore}
                disabled={!editable}
                onChange={(e) => setMaxScore(e.target.value)}
              />
            </Field>
          </div>
          <ul className="divide-y divide-border rounded-md border border-border">
            {participants.map((participant) => {
              const inputId = `workshop-score-${participant.id}`;
              return (
                <li key={participant.id} className="flex items-center gap-3 px-3 py-2">
                  <label
                    htmlFor={inputId}
                    className="min-w-0 flex-1 truncate text-sm text-foreground"
                  >
                    {participant.contactName || participant.contactId}
                  </label>
                  <Input
                    id={inputId}
                    name={inputId}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={max > 0 ? max : undefined}
                    className="w-24"
                    value={draft[participant.id] ?? ""}
                    disabled={!editable}
                    onChange={(e) =>
                      setDraft((current) => ({ ...current, [participant.id]: e.target.value }))
                    }
                  />
                </li>
              );
            })}
          </ul>
          {editable ? (
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={save.isPending || invalid}
              className="min-h-11"
            >
              {t("workshops.saveScores")}
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}
