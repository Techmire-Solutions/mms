/**
 * Unique-field validation seam for Contacts (Clean Architecture).
 *
 * Keeps the historical public import path for `routes/common/auth.ts` and
 * Google sync stable while binding the exported helpers to the composition
 * root's wrapped instance methods.
 */
import { contactUseCases } from "../use-cases/contactUseCases.js";

export const { assertContactUniqueFields } = contactUseCases;

export { ContactUniqueFieldError } from "../use-cases/contactValidationUseCases.js";
