import { getSessionsHost } from "../host.js";

export function completionCertificateHtml(...args: any[]): any {
  return (getSessionsHost() as any).completionCertificateHtml(...args);
}
