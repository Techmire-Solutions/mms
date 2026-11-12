import type { WorkshopEvent, WorkshopParticipant } from "@mms/shared";
import { escapeHtml } from "@/lib/escapeHtml";
import { printHtmlDocument } from "@/lib/ui/printHtmlDocument";
import { formatWorkshopDates } from "../components/workshopsWorkColumns";

/** A single roster never prints more than this many rows (memory/print bound). */
export const MAX_ROSTER_PRINT_ROWS = 500;
/** Name badges print in bounded batches of this size. */
export const MAX_BADGES_PER_PRINT = 100;

export interface WorkshopPrintLabels {
  rosterTitle: string;
  signInTitle: string;
  badgesTitle: string;
  name: string;
  status: string;
  signature: string;
  date: string;
  number: string;
}

export interface WorkshopPrintResult {
  printed: number;
  total: number;
}

const e = escapeHtml;

function rosterRows(participants: WorkshopParticipant[], withSignature: boolean): string {
  return participants
    .map(
      (participant, index) => `<tr>
  <td>${index + 1}</td>
  <td>${e(participant.contactName || participant.contactId)}</td>
  <td>${e(participant.status)}</td>
  ${withSignature ? `<td class="sig"></td><td class="date"></td>` : ""}
</tr>`,
    )
    .join("");
}

function rosterTable(
  participants: WorkshopParticipant[],
  labels: WorkshopPrintLabels,
  withSignature: boolean,
): string {
  return `<table>
  <thead><tr>
    <th class="num">${e(labels.number)}</th>
    <th>${e(labels.name)}</th>
    <th>${e(labels.status)}</th>
    ${withSignature ? `<th>${e(labels.signature)}</th><th>${e(labels.date)}</th>` : ""}
  </tr></thead>
  <tbody>${rosterRows(participants, withSignature)}</tbody>
</table>`;
}

function printablePage(title: string, subtitle: string, body: string): string {
  return `<section class="sheet">
  <header>
    <h1>${e(title)}</h1>
    <p>${e(subtitle)}</p>
  </header>
  ${body}
</section>
<style>
  .sheet { font-family: inherit; color: #111; padding: 24px; }
  header { text-align: center; margin-bottom: 18px; }
  h1 { font-size: 22px; margin: 0 0 6px; }
  header p { font-size: 12px; color: #444; margin: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #999; padding: 6px 8px; text-align: start; }
  th { background: #eee; }
  .num { width: 36px; text-align: center; }
  .sig { min-width: 160px; }
  .date { width: 110px; }
  tr { page-break-inside: avoid; }
</style>`;
}

export function buildWorkshopRosterHtml(
  workshop: Pick<WorkshopEvent, "title" | "startDate" | "endDate">,
  participants: WorkshopParticipant[],
  labels: WorkshopPrintLabels,
): { html: string; result: WorkshopPrintResult } {
  const printed = participants.slice(0, MAX_ROSTER_PRINT_ROWS);
  return {
    html: printablePage(
      labels.rosterTitle,
      `${workshop.title} · ${formatWorkshopDates(workshop)}`,
      rosterTable(printed, labels, false),
    ),
    result: { printed: printed.length, total: participants.length },
  };
}

export function buildWorkshopSignInSheetHtml(
  workshop: Pick<WorkshopEvent, "title" | "startDate" | "endDate">,
  participants: WorkshopParticipant[],
  labels: WorkshopPrintLabels,
): { html: string; result: WorkshopPrintResult } {
  const printed = participants.slice(0, MAX_ROSTER_PRINT_ROWS);
  return {
    html: printablePage(
      labels.signInTitle,
      `${workshop.title} · ${formatWorkshopDates(workshop)}`,
      rosterTable(printed, labels, true),
    ),
    result: { printed: printed.length, total: participants.length },
  };
}

export function buildWorkshopNameBadgesHtml(
  workshop: Pick<WorkshopEvent, "title" | "startDate" | "endDate">,
  participants: WorkshopParticipant[],
  labels: WorkshopPrintLabels,
): { html: string; result: WorkshopPrintResult } {
  const printed = participants.slice(0, MAX_BADGES_PER_PRINT);
  const cards = printed
    .map(
      (participant) => `<article class="badge">
  <p class="badge-workshop">${e(workshop.title)}</p>
  <p class="badge-name">${e(participant.contactName || participant.contactId)}</p>
  <p class="badge-dates">${e(formatWorkshopDates(workshop))}</p>
</article>`,
    )
    .join("");
  return {
    html: `<section class="badges">
  <h1 class="badges-title">${e(labels.badgesTitle)}</h1>
  <div class="badges-grid">${cards}</div>
</section>
<style>
  .badges { padding: 12px; color: #111; }
  .badges-title { text-align: center; font-size: 16px; margin: 0 0 10px; }
  .badges-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .badge { border: 2px solid #333; border-radius: 8px; padding: 14px; text-align: center; page-break-inside: avoid; }
  .badge-workshop { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #555; margin: 0 0 6px; }
  .badge-name { font-size: 22px; font-weight: 700; margin: 0 0 6px; }
  .badge-dates { font-size: 10px; color: #444; margin: 0; }
</style>`,
    result: { printed: printed.length, total: participants.length },
  };
}

type PrintOptions = {
  workshop: Pick<WorkshopEvent, "title" | "startDate" | "endDate">;
  participants: WorkshopParticipant[];
  labels: WorkshopPrintLabels;
  language: string;
  isRtl: boolean;
};

function print(title: string, html: string, language: string, isRtl: boolean): void {
  printHtmlDocument(title, html, { language, isRtl });
}

export function printWorkshopRoster(options: PrintOptions): WorkshopPrintResult {
  const { html, result } = buildWorkshopRosterHtml(
    options.workshop,
    options.participants,
    options.labels,
  );
  print(options.labels.rosterTitle, html, options.language, options.isRtl);
  return result;
}

export function printWorkshopSignInSheet(options: PrintOptions): WorkshopPrintResult {
  const { html, result } = buildWorkshopSignInSheetHtml(
    options.workshop,
    options.participants,
    options.labels,
  );
  print(options.labels.signInTitle, html, options.language, options.isRtl);
  return result;
}

export function printWorkshopNameBadges(options: PrintOptions): WorkshopPrintResult {
  const { html, result } = buildWorkshopNameBadgesHtml(
    options.workshop,
    options.participants,
    options.labels,
  );
  print(options.labels.badgesTitle, html, options.language, options.isRtl);
  return result;
}
