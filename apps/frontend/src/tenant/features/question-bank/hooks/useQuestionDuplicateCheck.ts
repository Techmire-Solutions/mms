import { useEffect, useState } from "react";
import { apiContract } from "@/lib/api";
import { hasComparableStem } from "@mms/shared";

export interface DuplicateMatch {
  id: string;
  text: string;
  difficulty: string;
  categoryIds: string[];
  score: number;
}

/**
 * Debounced near-duplicate lookup for the authoring form.
 *
 * Advisory only: the server returns ranked matches and the author decides. Very short stems are
 * skipped locally (the server would return nothing anyway).
 */
export function useQuestionDuplicateCheck(
  text: string,
  excludeId?: string,
  limit = 3,
): DuplicateMatch[] {
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const trimmed = text.trim();
  const eligible = hasComparableStem(trimmed);

  useEffect(() => {
    if (!eligible) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void apiContract.questionBank
        .checkQuestionDuplicates({
          body: { text: trimmed, excludeId, limit },
        })
        .then((response) => {
          if (
            !cancelled &&
            response.status === 200 &&
            response.body &&
            typeof response.body === "object" &&
            "matches" in response.body
          ) {
            setMatches((response.body as { matches?: DuplicateMatch[] }).matches ?? []);
          }
        })
        .catch(() => {
          if (!cancelled) setMatches([]);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [eligible, trimmed, excludeId, limit]);

  return eligible ? matches : [];
}
