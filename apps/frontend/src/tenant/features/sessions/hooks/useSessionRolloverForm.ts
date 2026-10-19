import { useState } from "react";
import {
  addIsoDays,
  defaultPromotionClassMap,
  isoDayOffset,
  type PromotionOutcome,
  type PromotionPreviewRow,
  type Session,
  type SessionRolloverInput,
} from "@mms/shared";

export type RolloverMode = SessionRolloverInput["mode"];
export type RolloverCopyKey = keyof SessionRolloverInput["copy"];
export type RolloverCopy = Record<RolloverCopyKey, boolean>;

const DEFAULT_COPY: RolloverCopy = {
  fees: true,
  discounts: true,
  scholarships: true,
  workingDays: true,
  staff: true,
  calendar: false,
};

/** Next session dates: starts the day after this one ends and lasts as long. */
function nextDates(session: Session): { startDate: string; endDate: string } {
  const end = session.endDate?.slice(0, 10);
  if (!end) return { startDate: "", endDate: "" };
  const startDate = addIsoDays(end, 1);
  return { startDate, endDate: addIsoDays(startDate, isoDayOffset(session.startDate, end)) };
}

/** Wizard state for duplicating / promoting a session into a new draft. */
export function useSessionRolloverForm(session: Session, initialMode: RolloverMode) {
  const [mode, setMode] = useState<RolloverMode>(initialMode);
  const [name, setName] = useState("");
  const [dates, setDates] = useState(() => nextDates(session));
  const [copy, setCopy] = useState<RolloverCopy>(DEFAULT_COPY);
  const [classMap, setClassMap] = useState(() => defaultPromotionClassMap(session.classes));
  const [outcomes, setOutcomes] = useState<Record<string, PromotionOutcome>>({});
  const [preview, setPreview] = useState<PromotionPreviewRow[] | null>(null);

  const body: SessionRolloverInput = {
    mode,
    target: { name: name.trim(), startDate: dates.startDate, endDate: dates.endDate },
    copy,
    classMap: mode === "promote" ? classMap : [],
    outcomes:
      mode === "promote"
        ? Object.entries(outcomes).map(([enrollmentId, outcome]) => ({ enrollmentId, outcome }))
        : [],
  };
  const datesValid = Boolean(dates.startDate && dates.endDate && dates.endDate >= dates.startDate);
  const valid = name.trim().length > 0 && datesValid;

  return {
    mode,
    setMode: (next: RolloverMode) => {
      setMode(next);
      setPreview(null);
    },
    name,
    setName,
    dates,
    setStartDate: (startDate: string) => setDates((current) => ({ ...current, startDate })),
    setEndDate: (endDate: string) => setDates((current) => ({ ...current, endDate })),
    datesValid,
    copy,
    toggleCopy: (key: RolloverCopyKey, checked: boolean) =>
      setCopy((current) => ({ ...current, [key]: checked })),
    classMap,
    setNextClass: (sourceClassId: string, nextClassId: string | null) => {
      setClassMap((current) =>
        current.map((row) => (row.sourceClassId === sourceClassId ? { ...row, nextClassId } : row)),
      );
      setPreview(null);
    },
    outcomes,
    setOutcome: (enrollmentId: string, outcome: PromotionOutcome) => {
      setOutcomes((current) => ({ ...current, [enrollmentId]: outcome }));
      setPreview((rows) =>
        rows
          ? rows.map((row) => (row.enrollmentId === enrollmentId ? { ...row, outcome } : row))
          : rows,
      );
    },
    preview,
    setPreview,
    body,
    valid,
    isDirty: name.trim().length > 0,
  };
}

export type SessionRolloverForm = ReturnType<typeof useSessionRolloverForm>;
