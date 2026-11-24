/**
 * Composition adapter for the faculty domain.
 *
 * The tenant auth guard needs to know whether a linked faculty account is
 * soft-deleted. `middleware/authenticate.ts` may not import a domain, so the
 * faculty repository is bound to the middleware port here, and
 * `routes/index.ts` (the composition root) calls this once at module load.
 */
import { facultyRepository } from "../../faculty/repository/facultyRepositoryAdapter.js";
import { configureAccountDeletionGuard } from "../../middleware/accountDeletionGuard.js";

export function configureFacultyAccountDeletionGuard(): void {
  configureAccountDeletionGuard((tenant: string, userId: string) =>
    facultyRepository.isDeletedByUserId(tenant, userId),
  );
}
