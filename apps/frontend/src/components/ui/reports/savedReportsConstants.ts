import { SEMANTIC_BADGE } from "@/lib/semanticTone";

export const SAVED_REPORT_CATEGORY_BADGE_CLS: Record<string, string> = {
  financial: SEMANTIC_BADGE.success,
  students: SEMANTIC_BADGE.info,
  contacts: "bg-primary/10 text-primary border-primary/20",
  attendance: SEMANTIC_BADGE.warning,
  academic: "bg-primary/10 text-primary border-primary/20",
  hasanat: "bg-primary/10 text-primary border-primary/20",
  sessions: SEMANTIC_BADGE.info,
  faculty: SEMANTIC_BADGE.secondary,
};
