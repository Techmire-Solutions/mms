import type {
  QuestionBankPaperSection,
  QuestionBankQuestion as Question,
  QuestionBankTest,
} from "@mms/shared";
import { escapeHtml } from "@/lib/escapeHtml";
import {
  PRINT_COLORS,
  PRINT_SECTION_NOTE,
  PRINT_RULE,
  PRINT_BORDER,
  PRINT_LABEL,
} from "@/lib/printTemplateStyles";

// Quarantined print-only CSS stylesheet string for physical A4 exam paper generation.
// Per mms-ui-ux-design.mdc §2, physical print styles (A4/PDF) are quarantined from application UI chrome tokens.
// Hex values sourced from lib/printTemplateStyles.ts SSOT — do not re-declare inline.
export const PAPER_PRINT_STYLES = `
  .qpaper { width: 210mm; min-height: 297mm; margin: 0 auto; background: ${PRINT_COLORS.white}; color: ${PRINT_COLORS.black}; font-family: Inter, Arial, sans-serif; padding: 18mm; box-sizing: border-box; }
  .qpaper-header { text-align: center; border-bottom: 2px solid ${PRINT_COLORS.black}; padding-bottom: 10px; margin-bottom: 14px; }
  .qpaper-title { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0; }
  .qpaper-subtitle { margin: 6px 0 0; font-size: 12px; color: ${PRINT_COLORS.darkGray}; }
  .qpaper-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0 14px; font-size: 11px; }
  .qpaper-meta-cell { border: 1px solid ${PRINT_BORDER}; padding: 7px 8px; min-height: 30px; }
  .qpaper-meta-label { display: block; color: ${PRINT_LABEL}; font-size: 9px; text-transform: uppercase; margin-bottom: 2px; }
  .qpaper-instructions { border: 1px solid ${PRINT_BORDER}; padding: 8px 10px; margin-bottom: 14px; font-size: 11px; line-height: 1.45; }
  .qpaper-section { break-inside: avoid; page-break-inside: avoid; margin: 16px 0 10px; }
  .qpaper-section-title { border-bottom: 1px solid ${PRINT_RULE}; font-size: 13px; font-weight: 800; margin: 0 0 6px; padding-bottom: 4px; }
  .qpaper-section-note { color: ${PRINT_SECTION_NOTE}; font-size: 11px; line-height: 1.45; margin: 0 0 10px; }
  .qpaper-question { break-inside: avoid; page-break-inside: avoid; margin-bottom: 15px; }
  .qpaper-question-text { display: flex; gap: 8px; font-size: 13px; font-weight: 700; line-height: 1.5; margin-bottom: 8px; }
  .qpaper-question-number { min-width: 24px; font-weight: 800; }
  .qpaper-options { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 12px; margin-inline-start: 32px; font-size: 12px; }
  .qpaper-option { display: flex; gap: 6px; align-items: flex-start; }
  .qpaper-lines { margin-inline-start: 32px; padding-top: 4px; }
  .qpaper-line { border-bottom: 1px solid ${PRINT_RULE}; height: 20px; margin-bottom: 8px; }
  .qpaper-matching { margin-inline-start: 32px; width: calc(100% - 32px); border-collapse: collapse; font-size: 12px; }
  .qpaper-matching td { border: 1px solid ${PRINT_BORDER}; padding: 7px 8px; vertical-align: top; }
  .qpaper-footer { margin-top: 18px; display: flex; justify-content: space-between; color: ${PRINT_LABEL}; font-size: 10px; }
  @page { size: A4; margin: 0; }
  @media print {
    html, body { background: ${PRINT_COLORS.white}; margin: 0; }
    .qpaper { width: 210mm; min-height: 297mm; margin: 0; box-shadow: none; }
  }
`;

export const ANSWER_LINE_COUNT_BY_TYPE: Record<Question["type"], number> = {
  mcq: 0,
  true_false: 1,
  short: 3,
  fill_blank: 2,
  matching: 0,
  numeric: 2,
  ordering: 2,
};

export const ALL_FILTER = "all";

export type DifficultyFilter = typeof ALL_FILTER | Question["difficulty"];

export interface PaperConfig {
  name: string;
  examClass: string;
  totalMarks: number;
  duration: number;
  instructions: string;
}

export type PaperSection = QuestionBankPaperSection;

export function coercePaperNumberInput(value: string, fallback: number, min: number): number {
  if (!value.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.trunc(parsed));
}

export function createPaperSection(index: number, title: string): PaperSection {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${index}`;
  return {
    id: `section-${randomId}`,
    title,
    instructions: "",
    questionIds: [],
  };
}

export function getPaperQuestionIds(sections: readonly PaperSection[]): string[] {
  return sections.flatMap((section) => section.questionIds);
}

export function getPaperQuestionCount(sections: readonly PaperSection[]): number {
  return getPaperQuestionIds(sections).length;
}

export function normalizePaperSections(
  sections: readonly PaperSection[],
  defaultSectionTitle: (sectionNumber: number) => string = (sectionNumber) =>
    `Section ${sectionNumber}`,
): PaperSection[] {
  return sections
    .map((section, sectionIndex) => ({
      ...section,
      title: section.title.trim() || defaultSectionTitle(sectionIndex + 1),
      instructions: section.instructions.trim(),
      questionIds: section.questionIds.filter(Boolean),
    }))
    .filter((section) => section.questionIds.length > 0);
}

export function createPaperDraftFromTest(
  test: QuestionBankTest,
  defaultSectionTitle: (sectionNumber: number) => string,
): { config: PaperConfig; sections: PaperSection[] } {
  const fallbackSections: PaperSection[] = [
    {
      id: `${test.id}-section-1`,
      title: defaultSectionTitle(1),
      instructions: "",
      questionIds: test.questionIds,
    },
  ];

  return {
    config: {
      name: test.name,
      examClass: test.examClass ?? "",
      totalMarks: test.totalMarks ?? 100,
      duration: test.duration,
      instructions: test.instructions ?? "",
    },
    sections: normalizePaperSections(
      test.sections && test.sections.length > 0 ? test.sections : fallbackSections,
      defaultSectionTitle,
    ),
  };
}

export { escapeHtml };

export function openPaperPrintWindow(content: HTMLElement, title: string): boolean {
  const printWindow = window.open("", "_blank", "width=900,height=800");
  if (!printWindow) return false;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>${escapeHtml(title)}</title>
      <style>${PAPER_PRINT_STYLES}</style>
    </head>
    <body>
      ${content.innerHTML}
      <script>
        function triggerPrint() {
          window.focus();
          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function() { window.print(); }).catch(function() { window.print(); });
          } else {
            window.print();
          }
        }
        if (document.readyState === 'complete') {
          triggerPrint();
        } else {
          window.addEventListener('load', triggerPrint);
        }
        window.onafterprint = function() { window.close(); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
  return true;
}
