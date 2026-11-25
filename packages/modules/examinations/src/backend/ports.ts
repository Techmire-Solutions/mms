import type { AcademicCatalogKind } from "@mms/contracts";

/**
 * Cross-module seams the examinations backend needs from the app composition
 * root: academic-catalog use-cases (sessions domain) and the marks-transfer
 * background job enqueuer.
 */
export interface ExaminationsPorts {
  academicCatalog: {
    listActive(kind: AcademicCatalogKind): Promise<unknown[]>;
    ensureAcademicCatalogItem(
      tenant: string,
      kind: AcademicCatalogKind,
      name: string,
    ): Promise<unknown>;
  };
  enqueueBackgroundJob: (...args: any[]) => Promise<any>;
  getUserBackgroundJob: (...args: any[]) => Promise<any>;
  getUserBackgroundJobPayload: (...args: any[]) => Promise<any>;
  retryFailedBackgroundJob: (...args: any[]) => Promise<any>;
  findLiveBackgroundJobForEntity: (...args: any[]) => Promise<any>;
  teacherScope: {
    assertTeacherClassScope: (...args: any[]) => Promise<any>;
    assertTeacherExamScope: (...args: any[]) => Promise<any>;
    assertTeacherSectionScope: (...args: any[]) => Promise<any>;
    assertTeacherAnyClassScope: (...args: any[]) => Promise<any>;
  };
}

let ports: ExaminationsPorts | null = null;

/** Composition-root binding; called once from `apps/api` before routes load. */
export function configureExaminationsPorts(next: ExaminationsPorts): void {
  ports = next;
}

function requirePorts(): ExaminationsPorts {
  if (!ports)
    throw new Error("Examinations ports are not configured (call configureExaminationsPorts)");
  return ports;
}

export function examinationsAcademicCatalog(): ExaminationsPorts["academicCatalog"] {
  return requirePorts().academicCatalog;
}

export function examinationsEnqueueBackgroundJob(
  ...args: Parameters<ExaminationsPorts["enqueueBackgroundJob"]>
) {
  return requirePorts().enqueueBackgroundJob(...args);
}
export function examinationsGetUserBackgroundJob(
  ...args: Parameters<ExaminationsPorts["getUserBackgroundJob"]>
) {
  return requirePorts().getUserBackgroundJob(...args);
}
export function examinationsGetUserBackgroundJobPayload(
  ...args: Parameters<ExaminationsPorts["getUserBackgroundJobPayload"]>
) {
  return requirePorts().getUserBackgroundJobPayload(...args);
}
export function examinationsRetryFailedBackgroundJob(
  ...args: Parameters<ExaminationsPorts["retryFailedBackgroundJob"]>
) {
  return requirePorts().retryFailedBackgroundJob(...args);
}
export function examinationsFindLiveBackgroundJobForEntity(
  ...args: Parameters<ExaminationsPorts["findLiveBackgroundJobForEntity"]>
) {
  return requirePorts().findLiveBackgroundJobForEntity(...args);
}
export function examinationsTeacherScope(): ExaminationsPorts["teacherScope"] {
  return requirePorts().teacherScope;
}

export type ClassSectionDate = {
  classId: string;
  sectionId: string | null;
  onDate: string;
};
