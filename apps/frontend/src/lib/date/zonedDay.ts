/** Workspace-timezone day boundaries for forms that send ISO instants. */
function offsetMsAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - instant.getTime();
}

function zonedInstant(
  day: string,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const [year, month, date] = day.split("-").map(Number);
  const naive = Date.UTC(year, month - 1, date, hour, minute, second);
  let instant = new Date(naive - offsetMsAt(new Date(naive), timeZone));
  instant = new Date(naive - offsetMsAt(instant, timeZone));
  return instant;
}

export function startOfDayInstant(day: string, timeZone: string): string | null {
  if (!day) return null;
  return zonedInstant(day, 0, 0, 0, timeZone || "UTC").toISOString();
}

export function endOfDayInstant(day: string, timeZone: string): string | null {
  if (!day) return null;
  return zonedInstant(day, 23, 59, 59, timeZone || "UTC").toISOString();
}

export function dateInTimeZone(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || "UTC" }).format(
    new Date(instant),
  );
}
