/**
 * @file taskNotificationI18n.ts
 * @description Minimal server-side localization for task notification copy.
 *
 * The outbox consumer runs in the worker (no request locale), so the surrounding
 * prose is rendered from a small per-language map keyed by the workspace's
 * configured `language`. Task titles are tenant-authored and stay verbatim.
 */

export type TaskNotificationLanguage = "en" | "ar" | "ur" | "fa";

const ASSIGNED: Record<TaskNotificationLanguage, (title: string) => string> = {
  en: (title) => `You were assigned a task: ${title}`,
  ar: (title) => `تم إسناد مهمة إليك: ${title}`,
  ur: (title) => `آپ کو ایک ٹاسک تفویض کیا گیا: ${title}`,
  fa: (title) => `وظیفه‌ای به شما واگذار شد: ${title}`,
};

const STATUS_CHANGED: Record<TaskNotificationLanguage, (title: string, status: string) => string> =
  {
    en: (title, status) => `Task "${title}" status changed to ${status}.`,
    ar: (title, status) => `تغيّرت حالة المهمة "${title}" إلى ${status}.`,
    ur: (title, status) => `ٹاسک "${title}" کی حیثیت ${status} میں بدل گئی۔`,
    fa: (title, status) => `وضعیت وظیفه "${title}" به ${status} تغییر کرد.`,
  };

const STATUS_LABELS: Record<TaskNotificationLanguage, Record<string, string>> = {
  en: {
    todo: "To Do",
    in_progress: "In Progress",
    in_review: "In Review",
    blocked: "Blocked",
    completed: "Completed",
    cancelled: "Cancelled",
  },
  ar: {
    todo: "قيد الانتظار",
    in_progress: "قيد التنفيذ",
    in_review: "قيد المراجعة",
    blocked: "محظور",
    completed: "مكتمل",
    cancelled: "ملغي",
  },
  ur: {
    todo: "کرنے کے کام",
    in_progress: "جاری",
    in_review: "زیر جائزہ",
    blocked: "روکا ہوا",
    completed: "مکمل",
    cancelled: "منسوخ",
  },
  fa: {
    todo: "انجام‌نشده",
    in_progress: "در حال انجام",
    in_review: "در حال بررسی",
    blocked: "مسدود",
    completed: "تکمیل‌شده",
    cancelled: "لغو‌شده",
  },
};

export function normalizeTaskLanguage(raw: string | null | undefined): TaskNotificationLanguage {
  const key = (raw ?? "").trim().toLowerCase();
  return key === "ar" || key === "ur" || key === "fa" ? key : "en";
}

export function localizeTaskStatus(status: string, language: string): string {
  return STATUS_LABELS[normalizeTaskLanguage(language)][status] ?? status;
}

export function localizeTaskMessage(
  reason: "assignment" | "status_change",
  title: string,
  status: string,
  language: string,
): string {
  const normalized = normalizeTaskLanguage(language);
  const taskTitle = title?.trim() || "Untitled task";
  return reason === "assignment"
    ? ASSIGNED[normalized](taskTitle)
    : STATUS_CHANGED[normalized](taskTitle, status);
}
