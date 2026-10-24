import { WORKSHOPS_MODULE_MANIFEST } from "@mms/shared";

export const WORKSHOPS_QUERY_KEY = [WORKSHOPS_MODULE_MANIFEST.moduleId] as const;

export const WORKSHOPS_LIST_QUERY_KEY = (params: { includeDeleted: boolean; search: string }) =>
  [...WORKSHOPS_QUERY_KEY, "list", params] as const;

export const WORKSHOP_DETAIL_QUERY_KEY = (id: string) =>
  [...WORKSHOPS_QUERY_KEY, "detail", id] as const;
