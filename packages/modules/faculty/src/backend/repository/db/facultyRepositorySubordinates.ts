/**
 * Faculty subordinate / reporting helpers — re-exports split modules to stay under LOC cap.
 */
export {
  countSubordinates,
  countSubordinatesBatch,
  reassignSubordinates,
  resolveSupervisorPrimaryPositionId,
} from "./facultyRepositorySubordinateCounts.js";

export {
  findSubordinates,
  findDirectSupervisorsBatch,
  findAncestorChain,
} from "./facultyRepositoryAncestors.js";
