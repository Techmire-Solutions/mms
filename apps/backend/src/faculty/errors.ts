/**
 * @file errors.ts
 * @description Domain errors for the Faculty module.
 */

/** Raised when a catalog write collides with an existing live row (maps to HTTP 409). */
export class FacultyCatalogConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FacultyCatalogConflictError";
  }
}
