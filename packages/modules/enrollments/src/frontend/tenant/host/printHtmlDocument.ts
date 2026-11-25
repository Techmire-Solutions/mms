import { getEnrollmentsHost } from "../host.js";

export function printHtmlDocument(...args: any[]): any {
  return (getEnrollmentsHost() as any).printHtmlDocument(...args);
}
