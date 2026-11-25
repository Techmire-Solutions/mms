import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = resolve(process.cwd(), "src");
const ALLOWED_INPUT_TYPES = new Set(["file", "hidden", "color", "range", "checkbox", "radio"]);

/**
 * Form-scoped files: every FormModal consumer, every contact sub-list tab, and
 * the field/modal sections that own form controls. Keeping this explicit makes
 * the guard deterministic while covering new FormModal forms automatically.
 */
const EXTRA_FORM_FILES = [
  "tenant/features/attendance/components/AttendanceExcuseAttachmentField.tsx",
  "tenant/features/question-bank/components/PaperBlueprintPanel.tsx",
  "tenant/features/question-bank/components/BlueprintRowCard.tsx",
  "tenant/features/question-bank/components/QuestionMediaSection.tsx",
  "tenant/features/examinations/components/ExamEligibilitySection.tsx",
  "tenant/features/faculty/components/FacultyNewUserAccountFields.tsx",
  "tenant/features/tasks/components/TaskFormAssigneePicker.tsx",
  "tenant/features/users/components/AddUserModalStep2.tsx",
  "tenant/features/users/components/AddUserModalStep3.tsx",
  "tenant/features/users/components/EditUserModalFields.tsx",
  "tenant/features/contacts/components/formTabs/ContactBasicAvatarSection.tsx",
  "tenant/features/attendance/components/MarkAttendanceFieldControl.tsx",
  "tenant/features/hasanat/components/DenominationModal.tsx",
  "tenant/features/sessions/components/tabs/class-detail/ClassDetailScholarshipTab.tsx",
  "tenant/features/workshops/components/WorkshopCheckInSection.tsx",
  "tenant/features/workshops/components/WorkshopScoresSection.tsx",
  "tenant/pages/apply/RegistrationFormFields.tsx",
  "platform/features/consolidation/components/ConsolidationMemberRow.tsx",
  "components/reports/pinnedWidgets/WidgetBuilderCardOptions.tsx",
  "components/branding/BrandSaveCustomPresetModal.tsx",
  "components/branding/BrandingImageUploadField.tsx",
  "components/branding/BrandColorImportModal.tsx",
  "components/branding/ThemeSettingsPaletteSection.tsx",
  "tenant/features/settings/components/backup/BackupImportSection.tsx",
  "tenant/features/settings/components/BackupRestoreConfirmModal.tsx",
];

/**
 * Shared form primitives legitimately render the native element they own.
 * They are not consumers and must never be treated as violations.
 */
const SHARED_PRIMITIVE_PATTERNS = [
  /^components\/app\/Form/,
  /^components\/app\/Modal\.tsx$/,
  /^components\/app\/SearchableSelectField\.tsx$/,
  /^components\/app\/OptionSelectPopover\.tsx$/,
  /^components\/app\/RegistryCustomField/,
  /^components\/app\/DatePicker/,
  /^components\/app\/RadioGroup/,
  /^components\/ui\//,
  /^components\/contactLink\//,
  /^components\/template-editor\//,
  /^components\/design-system\//,
];

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) return walk(fullPath);
    return entry.endsWith(".tsx") && !entry.endsWith(".test.tsx") ? [fullPath] : [];
  });
}

function isFormFile(path: string, source: string): boolean {
  if (path.includes("/formTabs/")) return true;
  if (source.includes("components/app/FormModal")) return true;
  return EXTRA_FORM_FILES.includes(path);
}

function isExempt(path: string): boolean {
  return SHARED_PRIMITIVE_PATTERNS.some((pattern) => pattern.test(path));
}

function violations(path: string, source: string): string[] {
  const found: string[] = [];
  if (/<select\b/.test(source)) found.push("raw <select>");
  if (/<textarea\b/.test(source)) found.push("raw <textarea>");
  if (/<label\b/.test(source)) found.push("raw <label>");
  if (/<button\b/.test(source)) found.push("raw <button>");

  const inputPattern = /<input\b([\s\S]*?)(?:\/>|>)/g;
  for (const match of source.matchAll(inputPattern)) {
    const type = /type=["']([^"']+)["']/.exec(match[1] ?? "")?.[1]?.toLowerCase();
    if (!type || !ALLOWED_INPUT_TYPES.has(type)) {
      found.push(`raw <input${type ? ` type="${type}"` : ""}>`);
    }
  }
  return found;
}

describe("form UI primitives", () => {
  it("keeps form copy translated and direction logical", () => {
    const offenders: string[] = [];
    const bannedDirection =
      /(?<![\w-])(?:pl|pr|ml|mr)-\d+|(?<![\w-])(?:text-left|text-right|border-l|border-r|rounded-l|rounded-r)(?![\w-])/;

    for (const file of walk(SRC_ROOT)) {
      const relativePath = relative(SRC_ROOT, file).replaceAll("\\", "/");
      if (isExempt(relativePath)) continue;
      const source = readFileSync(file, "utf8");
      if (!isFormFile(relativePath, source)) continue;
      if (bannedDirection.test(source)) offenders.push(`${relativePath}: physical direction class`);
      if (/placeholder="[A-Za-z]/.test(source)) {
        offenders.push(`${relativePath}: literal placeholder`);
      }
      if (/aria-label="[A-Za-z]/.test(source)) {
        offenders.push(`${relativePath}: literal aria-label`);
      }
      if (/t\("[^"]+"\)\s*\|\|/.test(source)) {
        offenders.push(`${relativePath}: t() fallback chain`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("uses shared controls, labels, and buttons inside form files", () => {
    const offenders: string[] = [];

    for (const file of walk(SRC_ROOT)) {
      const relativePath = relative(SRC_ROOT, file).replaceAll("\\", "/");
      if (isExempt(relativePath)) continue;
      const source = readFileSync(file, "utf8");
      if (!isFormFile(relativePath, source)) continue;
      for (const violation of violations(relativePath, source)) {
        offenders.push(`${relativePath}: ${violation}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
