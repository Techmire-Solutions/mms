/**
 * Minimal RFC 5545 writer: TEXT escaping, CRLF line endings, 75-octet folding (UTF-8 aware),
 * stable UIDs and either all-day DATE or UTC DATE-TIME values. User text only ever lands in
 * escaped TEXT values, so calendar titles/notes cannot inject extra iCalendar properties.
 */
import { addIsoDays, formatIcalUtc } from "./zonedTime.js";

export interface AllDayIcalEvent {
  uid: string;
  startOn: string; // inclusive YYYY-MM-DD
  endOn: string; // inclusive YYYY-MM-DD
  summary: string;
  description?: string | null;
  categories?: string[];
}

export interface TimedIcalEvent {
  uid: string;
  startUtc: Date;
  endUtc: Date;
  summary: string;
  description?: string | null;
  location?: string | null;
  categories?: string[];
}

export interface IcalCalendarOptions {
  name: string;
  /** IANA zone for display clients; event instants are still emitted as UTC. */
  timeZone: string;
  prodId?: string;
}

/** Escapes a value for an iCalendar TEXT property (RFC 5545 §3.3.11). */
export function escapeIcalText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Folds a content line at 75 octets; continuation lines start with one space. */
export function foldIcalLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const chunks: string[] = [];
  let offset = 0;
  let limit = 75;
  while (offset < bytes.length) {
    let end = Math.min(offset + limit, bytes.length);
    // Never split a multi-byte UTF-8 sequence.
    while (end > offset && end < bytes.length && (bytes[end] & 0b1100_0000) === 0b1000_0000)
      end -= 1;
    chunks.push(bytes.subarray(offset, end).toString("utf8"));
    offset = end;
    limit = 74; // continuation lines spend one octet on the leading space
  }
  return chunks.join("\r\n ");
}

function line(value: string): string {
  return `${foldIcalLine(value)}\r\n`;
}

function descriptionLine(description: string | null | undefined): string {
  return description && description.trim()
    ? line(`DESCRIPTION:${escapeIcalText(description)}`)
    : "";
}

function categoriesLine(categories: string[] | undefined): string {
  return categories && categories.length > 0
    ? line(`CATEGORIES:${categories.map(escapeIcalText).join(",")}`)
    : "";
}

export function buildIcalAllDayEvent(event: AllDayIcalEvent): string {
  return (
    line("BEGIN:VEVENT") +
    line(`UID:${escapeIcalText(event.uid)}`) +
    line(`DTSTAMP:${formatIcalUtc(new Date())}`) +
    line(`DTSTART;VALUE=DATE:${event.startOn.replace(/-/g, "")}`) +
    line(`DTEND;VALUE=DATE:${addIsoDays(event.endOn, 1).replace(/-/g, "")}`) +
    line(`SUMMARY:${escapeIcalText(event.summary)}`) +
    descriptionLine(event.description) +
    categoriesLine(event.categories) +
    line("END:VEVENT")
  );
}

export function buildIcalTimedEvent(event: TimedIcalEvent): string {
  return (
    line("BEGIN:VEVENT") +
    line(`UID:${escapeIcalText(event.uid)}`) +
    line(`DTSTAMP:${formatIcalUtc(new Date())}`) +
    line(`DTSTART:${formatIcalUtc(event.startUtc)}`) +
    line(`DTEND:${formatIcalUtc(event.endUtc)}`) +
    line(`SUMMARY:${escapeIcalText(event.summary)}`) +
    descriptionLine(event.description) +
    (event.location ? line(`LOCATION:${escapeIcalText(event.location)}`) : "") +
    categoriesLine(event.categories) +
    line("END:VEVENT")
  );
}

/** Async-friendly chunk generator; the caller can write each string with backpressure. */
export function* streamIcalCalendar(
  options: IcalCalendarOptions,
  events: Iterable<AllDayIcalEvent | TimedIcalEvent>,
): Generator<string, void, undefined> {
  yield line("BEGIN:VCALENDAR");
  yield line("VERSION:2.0");
  yield line(`PRODID:${escapeIcalText(options.prodId ?? "-//MMS//Sessions Calendar//EN")}`);
  yield line("CALSCALE:GREGORIAN");
  yield line("METHOD:PUBLISH");
  yield line(`X-WR-CALNAME:${escapeIcalText(options.name)}`);
  yield line(`X-WR-TIMEZONE:${escapeIcalText(options.timeZone)}`);
  for (const event of events) {
    yield "startUtc" in event ? buildIcalTimedEvent(event) : buildIcalAllDayEvent(event);
  }
  yield line("END:VCALENDAR");
}
