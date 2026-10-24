/**
 * Cross-module public surface for Workshops Query hooks.
 * Other features and shared UI must import from here — not `@/tenant/features/workshops/hooks/*`.
 */
export {
  WORKSHOPS_QUERY_KEY,
  WORKSHOPS_LIST_QUERY_KEY,
  WORKSHOP_DETAIL_QUERY_KEY,
} from "@/tenant/features/workshops/hooks/workshopsQueryKeys";

export {
  useWorkshops,
  useWorkshopDetail,
  useWorkshopMetrics,
  useCreateWorkshop,
  useUpdateWorkshop,
  useDeleteWorkshop,
  useRestoreWorkshop,
  useAddWorkshopParticipant,
  useRemoveWorkshopParticipant,
  useSaveWorkshopAttendance,
  useSaveWorkshopScores,
  invalidateWorkshopsQueries,
} from "@/tenant/features/workshops/hooks/useWorkshopsApi";
