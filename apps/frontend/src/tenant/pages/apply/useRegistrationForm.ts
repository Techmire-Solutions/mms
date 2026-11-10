import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  evaluateEligibility,
  REGISTRATION_INELIGIBLE_ERROR_TYPE,
  registrationSubmitSchema,
  todayISO,
  type EligibilityReason,
  type PublicRegistrationView,
} from "@mms/shared";
import { isApiError } from "@/lib/apiError";
import {
  PUBLIC_REGISTRATION_QUERY_KEY,
  submitRegistrationMutationOptions,
} from "@/lib/query/registrationQueries";

export interface RegistrationFormDraft {
  classId: string;
  fullName: string;
  guardianName: string;
  dateOfBirth: string;
  gender: "" | "male" | "female";
  phone: string;
  email: string;
  address: string;
  previousMadrasa: string;
  /** Honeypot — hidden from people, filled only by bots. */
  website: string;
}

const EMPTY: RegistrationFormDraft = {
  classId: "",
  fullName: "",
  guardianName: "",
  dateOfBirth: "",
  gender: "",
  phone: "",
  email: "",
  address: "",
  previousMadrasa: "",
  website: "",
};

export type SubmitOutcome =
  | { kind: "idle" }
  | { kind: "success"; reference: string; status: string }
  | { kind: "error"; reasons: EligibilityReason[]; message: string; type?: string };

/** Draft, instant eligibility feedback (same shared rule the server enforces) and submission. */
export function useRegistrationForm(slug: string, view: PublicRegistrationView | undefined) {
  const [draft, setDraft] = useState<RegistrationFormDraft>(EMPTY);
  const [outcome, setOutcome] = useState<SubmitOutcome>({ kind: "idle" });
  const [errors, setErrors] = useState<Partial<Record<keyof RegistrationFormDraft, string>>>({});
  const queryClient = useQueryClient();
  const mutation = useMutation({
    ...submitRegistrationMutationOptions(slug),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PUBLIC_REGISTRATION_QUERY_KEY });
    },
  });
  const selectedClass = view?.classes.find((cls) => cls.id === draft.classId);

  const eligibility = useMemo(() => {
    if (!selectedClass || !draft.dateOfBirth || !draft.gender) return null;
    return evaluateEligibility({
      applicant: { dateOfBirth: draft.dateOfBirth, gender: draft.gender },
      cls: { ...selectedClass, maxStudents: 0, sections: undefined },
      session: { status: "open", startDate: view?.startDate },
      asOf: todayISO(),
    });
  }, [selectedClass, draft.dateOfBirth, draft.gender, view?.startDate]);

  const update = <K extends keyof RegistrationFormDraft>(
    key: K,
    value: RegistrationFormDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const complete = Boolean(
    draft.classId &&
    draft.fullName.trim() &&
    draft.guardianName.trim() &&
    draft.dateOfBirth &&
    draft.gender &&
    draft.phone.trim(),
  );
  const canSubmit = complete && eligibility?.eligible !== false && !mutation.isPending;

  const submit = async () => {
    if (!canSubmit || !draft.gender) return;
    try {
      // Validate with the same shared schema the server uses so field-format errors are
      // inline instead of a post-submit 400.
      const parsed = registrationSubmitSchema.safeParse({
        classId: draft.classId,
        fullName: draft.fullName,
        guardianName: draft.guardianName,
        dateOfBirth: draft.dateOfBirth,
        gender: draft.gender,
        phone: draft.phone,
        email: draft.email || null,
        address: draft.address || null,
        previousMadrasa: draft.previousMadrasa || null,
        ...(draft.website ? { website: draft.website } : {}),
      });
      if (!parsed.success) {
        const fieldErrors: Partial<Record<keyof RegistrationFormDraft, string>> = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path[0];
          if (typeof field === "string" && !(field in fieldErrors)) {
            fieldErrors[field as keyof RegistrationFormDraft] = issue.message;
          }
        }
        setErrors(fieldErrors);
        setOutcome({
          kind: "error",
          reasons: [],
          message: parsed.error.issues[0]?.message ?? "",
          type: "validation_error",
        });
        return;
      }
      const result = await mutation.mutateAsync(parsed.data);
      setOutcome({ kind: "success", reference: result.reference, status: result.status });
    } catch (error) {
      const ineligible = isApiError(error) && error.type === REGISTRATION_INELIGIBLE_ERROR_TYPE;
      setOutcome({
        kind: "error",
        reasons: ineligible ? (error.message.split(",") as EligibilityReason[]) : [],
        message: error instanceof Error ? error.message : "",
        type: isApiError(error) ? (error.type ?? String(error.status)) : undefined,
      });
    }
  };

  return {
    draft,
    update,
    eligibility,
    canSubmit,
    submit,
    outcome,
    errors,
    isPending: mutation.isPending,
    seatsLeft: selectedClass?.seatsLeft ?? null,
  };
}
