import { getEnrollmentsHost } from "../host.js";

const host = () => (getEnrollmentsHost() as any).enrollmentImpactInvalidation;

export function invalidateEnrollmentImpacts(...args: any[]): any {
  return host()?.invalidateEnrollmentImpacts?.(...args);
}

export const enrollmentImpactInvalidation = {
  invalidateEnrollmentImpacts,
};

export default enrollmentImpactInvalidation;
