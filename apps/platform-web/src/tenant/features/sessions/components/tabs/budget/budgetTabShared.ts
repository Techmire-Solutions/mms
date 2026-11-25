import type { Session, SessionClassBudget } from "@/lib/data/sessionsData";

export interface BudgetItemWithClass extends SessionClassBudget {
  classId: string;
  className: string;
}

export interface DeleteBudgetTarget {
  classId: string;
  budgetId: string;
  detail: string;
}

export interface BudgetTabProps {
  session: Session;
  onUpdate: (session: Session) => void | Promise<void>;
  canMutate?: boolean;
  canWrite?: boolean;
}
