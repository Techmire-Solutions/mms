import { getSessionsHost } from "../host.js";

export function printHtmlDocument(...args: any[]): any {
  return (getSessionsHost() as any).printHtmlDocument(...args);
}
