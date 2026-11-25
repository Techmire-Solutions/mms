import { getEnrollmentsHost } from "../host.js";

export function completionCertificateHtml(...args: any[]): any {
  return (getEnrollmentsHost() as any).completionCertificateHtml(...args);
}
