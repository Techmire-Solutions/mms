import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  admissionsMetricsSchema,
  publicRegistrationViewSchema,
  registrationApplicationListQuerySchema,
  registrationApplicationSchema,
  registrationLinkSchema,
  registrationLinkWriteSchema,
  registrationReviewResultSchema,
  registrationReviewSchema,
  registrationSubmitResultSchema,
  registrationSubmitSchema,
} from '../registrationTypes.js';

const c = initContract();
const errorResponse = z.unknown();
const linkParams = z.object({ sessionId: z.string().min(1).max(64), id: z.string().min(1).max(64) });

/** Sessions-owned public registration links. */
export const registrationLinksContract = c.router({
  list: {
    method: 'GET',
    path: '/api/sessions/:sessionId/registration-links',
    pathParams: z.object({ sessionId: z.string().min(1).max(64) }),
    responses: { 200: z.object({ items: z.array(registrationLinkSchema) }), 403: errorResponse, 404: errorResponse, 500: errorResponse },
    summary: 'List registration links of a session',
  },
  save: {
    method: 'PUT',
    path: '/api/sessions/:sessionId/registration-links/:id',
    pathParams: linkParams,
    body: registrationLinkWriteSchema,
    responses: { 200: z.object({ item: registrationLinkSchema }), 400: errorResponse, 403: errorResponse, 404: errorResponse, 500: errorResponse },
    summary: 'Create or update a registration link (slug is generated server-side)',
  },
  remove: {
    method: 'DELETE',
    path: '/api/sessions/:sessionId/registration-links/:id',
    pathParams: linkParams,
    body: z.object({}).optional(),
    responses: { 200: z.object({ success: z.literal(true) }), 403: errorResponse, 404: errorResponse, 500: errorResponse },
    summary: 'Soft-delete a registration link',
  },
});

/** Enrollments-owned admissions queue. */
export const admissionsContract = c.router({
  list: {
    method: 'GET',
    path: '/api/enrollments/applications',
    query: registrationApplicationListQuerySchema,
    responses: {
      200: z.object({ items: z.array(registrationApplicationSchema), total: z.number().int(), page: z.number().int(), limit: z.number().int() }),
      400: errorResponse, 403: errorResponse, 500: errorResponse,
    },
    summary: 'List registration applications',
  },
  metrics: {
    method: 'GET',
    path: '/api/enrollments/applications/metrics',
    query: z.object({ sessionId: z.string().max(64).optional() }).strict().optional(),
    responses: { 200: admissionsMetricsSchema, 403: errorResponse, 500: errorResponse },
    summary: 'Admissions funnel counts',
  },
  review: {
    method: 'POST',
    path: '/api/enrollments/applications/review',
    body: registrationReviewSchema,
    responses: { 200: registrationReviewResultSchema, 400: errorResponse, 403: errorResponse, 500: errorResponse },
    summary: 'Approve, reject, waitlist or reopen applications (approval creates the student and enrollment)',
  },
});

/** Unauthenticated registration endpoints on the tenant subdomain. */
export const publicRegistrationContract = c.router({
  openSessions: {
    method: 'GET',
    path: '/api/public/registrations',
    responses: { 200: z.object({ items: z.array(publicRegistrationViewSchema) }), 404: errorResponse, 500: errorResponse },
    summary: 'Open registration links of this madrasa',
  },
  view: {
    method: 'GET',
    path: '/api/public/registrations/:slug',
    pathParams: z.object({ slug: z.string().min(8).max(64) }),
    responses: { 200: publicRegistrationViewSchema, 404: errorResponse, 500: errorResponse },
    summary: 'Public details of a registration link (no personal data)',
  },
  submit: {
    method: 'POST',
    path: '/api/public/registrations/:slug',
    pathParams: z.object({ slug: z.string().min(8).max(64) }),
    body: registrationSubmitSchema,
    responses: { 201: registrationSubmitResultSchema, 400: errorResponse, 404: errorResponse, 409: errorResponse, 422: errorResponse, 429: errorResponse, 500: errorResponse },
    summary: 'Submit an application',
  },
});
