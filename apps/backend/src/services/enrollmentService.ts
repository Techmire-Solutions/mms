import { enrollmentsUseCases } from "../enrollments/use-cases/enrollmentsUseCases.js";

/**
 * Thin re-export of the enrollments use-cases facade.
 *
 * Kept for backward compatibility with existing importers (report/export routes,
 * tests). New code should depend on `enrollments/use-cases/enrollmentsUseCases.js`
 * directly.
 */
export const createEnrollment = enrollmentsUseCases.createEnrollment;
export const updateEnrollmentById = enrollmentsUseCases.updateEnrollmentById;
export const deleteEnrollmentById = enrollmentsUseCases.deleteEnrollmentById;
export const restoreEnrollmentById = enrollmentsUseCases.restoreEnrollmentById;
export const bulkSoftDeleteEnrollments = enrollmentsUseCases.bulkSoftDeleteEnrollments;
export const bulkRestoreEnrollments = enrollmentsUseCases.bulkRestoreEnrollments;
export const loadEnrollmentsPage = enrollmentsUseCases.loadEnrollmentsPage;
export const loadEnrollmentById = enrollmentsUseCases.loadEnrollmentById;
export const loadEnrollmentsByIds = enrollmentsUseCases.loadEnrollmentsByIds;
export const countEnrollments = enrollmentsUseCases.countEnrollments;
export const loadEnrollmentsCommandMetrics = enrollmentsUseCases.loadEnrollmentsCommandMetrics;
export const loadEnrollmentsWidgetAggregates = enrollmentsUseCases.loadEnrollmentsWidgetAggregates;
export const loadEnrollmentsReportAggregates = enrollmentsUseCases.loadEnrollmentsReportAggregates;
