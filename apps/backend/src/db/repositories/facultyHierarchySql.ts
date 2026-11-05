import { ValidationError } from "../../lib/httpErrors.js";

export function validateHierarchyDepth(maxDepth: number): void {
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 20) {
    throw new ValidationError("Hierarchy depth must be an integer between 1 and 20");
  }
}
