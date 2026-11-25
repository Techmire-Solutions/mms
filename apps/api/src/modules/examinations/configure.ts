import { configureExaminationsPorts } from "@mms/mod-examinations/backend/ports";
import { getRequestTenant } from "@mms/be-core/http";
import { academicCatalogUseCases } from "@mms/mod-sessions/backend/use-cases";
import {
  enqueueBackgroundJob,
  retryFailedBackgroundJob,
} from "../../services/backgroundJobEnqueue.js";
import {
  findLiveBackgroundJobForEntity,
  getUserBackgroundJob,
  getUserBackgroundJobPayload,
} from "../../services/backgroundJobService.js";
import {
  assertTeacherAnyClassScope,
  assertTeacherClassScope,
  assertTeacherExamScope,
  assertTeacherSectionScope,
} from "@mms/mod-sessions/backend/use-cases";

const catalog = academicCatalogUseCases as unknown as {
  listActive: (tenant: string, kind: string) => Promise<unknown[]>;
  ensure: (tenant: string, kind: string, name: string) => Promise<unknown>;
};

configureExaminationsPorts({
  academicCatalog: {
    listActive: (kind) => catalog.listActive(getRequestTenant() ?? "", kind),
    ensureAcademicCatalogItem: (kind, name) => catalog.ensure(getRequestTenant() ?? "", kind, name),
  },
  enqueueBackgroundJob: enqueueBackgroundJob as never,
  getUserBackgroundJob: getUserBackgroundJob as never,
  getUserBackgroundJobPayload: getUserBackgroundJobPayload as never,
  retryFailedBackgroundJob: retryFailedBackgroundJob as never,
  findLiveBackgroundJobForEntity: findLiveBackgroundJobForEntity as never,
  teacherScope: {
    assertTeacherAnyClassScope: assertTeacherAnyClassScope as never,
    assertTeacherClassScope: assertTeacherClassScope as never,
    assertTeacherExamScope: assertTeacherExamScope as never,
    assertTeacherSectionScope: assertTeacherSectionScope as never,
  },
});
