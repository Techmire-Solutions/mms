#!/usr/bin/env bash
#
# Stage ONLY the faculty module-review change-set (P0/P1 fixes + FAC-m2).
#
# ⚠️  DO NOT run `git add -A` in this repo right now: the working tree also
# contains an unrelated concurrent change-set (contacts/dashboard/platform/
# finance + i18n, plus the rename in facultyHydrateUseCases.ts). This script
# stages exactly the faculty files owned by this review/fix effort.
#
# Usage:
#   bash scripts/stage-faculty-fixes.sh             # stage the files
#   bash scripts/stage-faculty-fixes.sh --dry-run   # show what WOULD be staged
#
set -euo pipefail

PATHS=(
  # --- backend production ---
  apps/api/src/db/repositories/facultyCatalogTrashRepository.ts
  apps/api/src/db/repositories/facultyDesignationAssignmentRepository.ts
  apps/api/src/db/repositories/facultyEmployDesignationRepository.ts
  apps/api/src/db/repositories/facultyEmployDesignationSync.ts
  apps/api/src/db/repositories/facultyEmploymentRepository.ts
  apps/api/src/db/repositories/facultyRepositoryColumns.ts
  apps/api/src/faculty/errors.ts
  apps/api/src/faculty/use-cases/facultyEmployeeIdGenerator.ts
  apps/api/src/faculty/use-cases/facultyEmployeeIdPreview.ts
  apps/api/src/faculty/use-cases/facultyEmployeeIdService.ts
  apps/api/src/faculty/use-cases/facultyOperationUseCases.ts
  apps/api/src/faculty/use-cases/facultyWriteUseCases.ts
  apps/api/src/faculty/use-cases/facultyHierarchyValidator.ts
  apps/api/src/lib/moduleRouteActionRules.ts
  apps/api/src/routes/tenant/faculty/facultyAssignmentRouteHandlers.ts
  apps/api/src/routes/tenant/faculty/facultyCatalogErrorResponse.ts
  apps/api/src/routes/tenant/faculty/facultyCatalogRouteAuth.ts
  apps/api/src/routes/tenant/faculty/facultyMutationRouteHandlers.ts

  # --- backend tests ---
  apps/api/src/__tests__/facultyAssignmentRoutes.test.ts
  apps/api/src/__tests__/facultyAssignmentsCycle.test.ts
  apps/api/src/__tests__/facultyCatalogErrorMapping.test.ts
  apps/api/src/__tests__/facultyEmployeeIdPreview.test.ts
  apps/api/src/__tests__/facultyEmployeeIdService.test.ts
  apps/api/src/__tests__/facultyHierarchy.integration.test.ts
  apps/api/src/__tests__/facultyOperationUseCases.test.ts
  apps/api/src/__tests__/facultyReportingSoftStop.test.ts
  apps/api/src/__tests__/facultyUseCases.test.ts
  apps/api/src/__tests__/facultyWriteSsot.integration.test.ts
  apps/api/src/__tests__/moduleAccessCoverage.test.ts

  # --- shared package ---
  packages/contracts/src/contracts/faculty.contract.ts
  packages/contracts/src/__tests__/facultyContract.test.ts

  # --- agent standards (canonical source + all mirrors) ---
  .agent/skills/mms-faculty-domain/SKILL.md
  .agent/skills/mms-faculty-domain/references/faculty-hierarchy-rules.md
  .cursor/skills/mms-faculty-domain/SKILL.md
  .cursor/skills/mms-faculty-domain/references/faculty-hierarchy-rules.md
  .claude/skills/mms-faculty-domain/SKILL.md
  .claude/skills/mms-faculty-domain/references/faculty-hierarchy-rules.md
  .dsh/skills/mms-faculty-domain/SKILL.md
  .dsh/skills/mms-faculty-domain/references/faculty-hierarchy-rules.md

  # --- review report (optional; may be committed separately) ---
  docs/reviews/faculty-module-review.md
)

if [[ "${1:-}" == "--dry-run" ]]; then
  git add -A --dry-run -- "${PATHS[@]}"
else
  git add -A -- "${PATHS[@]}"
fi

echo
echo "Done. Review with:  git status --short"
echo "Commit with:       git commit -m 'fix(faculty): close module-review P0/P1 findings'"
