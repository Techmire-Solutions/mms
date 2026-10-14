import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ERD_DOMAINS,
  filterErdDomainByTable,
  getErdDomain,
  isErdDomainId,
  listErdTableNames,
  type AppTranslationKey,
  type ErdDomain,
  type ErdDomainId,
  type PlatformErdResponse,
} from "@mms/shared";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { PLATFORM_QUERY_KEYS } from "@/platform/lib/platformQueryKeys";

const DEFAULT_DOMAIN: ErdDomainId = "accounting";
const ALL_TABLES = "";

export interface ErdDomainOption {
  value: ErdDomainId;
  labelKey: AppTranslationKey;
}

export function useErdPageController(): {
  domainId: ErdDomainId;
  focusTable: string;
  domain: ErdDomain;
  visible: ErdDomain;
  tableNames: string[];
  domainOptions: ErdDomainOption[];
  isLoading: boolean;
  isLive: boolean;
  totalTables: number;
  setDomainId: (id: string) => void;
  setFocusTable: (table: string) => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: dynamicData, isLoading } = useQuery<PlatformErdResponse>({
    queryKey: PLATFORM_QUERY_KEYS.erd,
    queryFn: async ({ signal }) => {
      const response = await apiContract.platform.getErd({ signal, fetchOptions: { signal } });
      if (response.status !== 200) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to load schema ERD",
          errorBody?.type,
        );
      }
      return response.body as PlatformErdResponse;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const domains = useMemo(() => {
    if (dynamicData?.domains && dynamicData.domains.length > 0) {
      return dynamicData.domains;
    }
    return ERD_DOMAINS;
  }, [dynamicData]);

  const domainOptions = useMemo<ErdDomainOption[]>(() => {
    return domains.map((item) => ({
      value: item.id,
      labelKey: item.labelKey,
    }));
  }, [domains]);

  const rawDomain = searchParams.get("domain") ?? DEFAULT_DOMAIN;
  const domainId = (
    domains.some((d) => d.id === rawDomain) ? rawDomain : DEFAULT_DOMAIN
  ) as ErdDomainId;

  const domain = useMemo(() => {
    return domains.find((d) => d.id === domainId) ?? getErdDomain(domainId);
  }, [domains, domainId]);

  const tableNames = useMemo(() => listErdTableNames(domain.tables), [domain.tables]);
  const requestedTable = searchParams.get("table") ?? ALL_TABLES;
  const focusTable = tableNames.includes(requestedTable) ? requestedTable : ALL_TABLES;
  const visible = useMemo(() => {
    return focusTable ? filterErdDomainByTable(domain, focusTable) : domain;
  }, [domain, focusTable]);

  const replaceParams = (nextDomain: ErdDomainId, nextTable: string): void => {
    const next = new URLSearchParams(searchParams);
    next.set("domain", nextDomain);
    if (nextTable) {
      next.set("table", nextTable);
    } else {
      next.delete("table");
    }
    setSearchParams(next, { replace: true });
  };

  return {
    domainId,
    focusTable,
    domain,
    visible,
    tableNames,
    domainOptions,
    isLoading,
    isLive: Boolean(dynamicData?.success),
    totalTables: dynamicData?.totalTables ?? domain.tables.length,
    setDomainId: (id) => {
      replaceParams(isErdDomainId(id) ? id : DEFAULT_DOMAIN, ALL_TABLES);
    },
    setFocusTable: (table) => {
      replaceParams(domainId, table);
    },
  };
}

export const ERD_DOMAIN_OPTIONS = ERD_DOMAINS.map((item) => ({
  value: item.id,
  labelKey: item.labelKey,
}));
