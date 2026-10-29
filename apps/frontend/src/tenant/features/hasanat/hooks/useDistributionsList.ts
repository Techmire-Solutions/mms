import { useEffect, useState } from "react";
import type { Distribution } from "@/lib/data/hasanatData";
import { HASANAT_MODULE_MANIFEST } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useDebounce } from "@/hooks/useDebounce";
import { useHasanatContractList } from "@/tenant/features/hasanat/hooks/useHasanatQueries";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";

type DistributionStatus = Distribution["status"];
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";

const DISTRIBUTION_SEARCH_DEBOUNCE_MS = 300;

export interface UseDistributionsListStateOptions {
  onCreate: (distribution: Distribution) => void | Promise<void>;
  onUpdate: (distribution: Distribution) => void | Promise<void>;
  onFilteredCountChange?: (count: number) => void;
  canWrite?: boolean;
  showDeleted?: boolean;
  createRequestKey?: number;
}

export function useDistributionsList({
  onCreate,
  onUpdate,
  onFilteredCountChange,
  canWrite = true,
  showDeleted = false,
  createRequestKey = 0,
}: UseDistributionsListStateOptions) {
  const { t } = useTranslation();
  const statusLabels = (() => ({
    active: t("hasanat.status.active"),
    redeemed: t("hasanat.status.redeemed"),
    returned: t("hasanat.status.returned"),
  }))();
  const statusConfig = (() => ({
    active: { label: statusLabels.active, cls: SEMANTIC_BADGE.info },
    redeemed: { label: statusLabels.redeemed, cls: "bg-primary/10 text-primary border-primary/20" },
    returned: { label: statusLabels.returned, cls: SEMANTIC_BADGE.muted },
  }))() as Record<DistributionStatus, StatusBadgeConfigItem>;
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<DistributionStatus[]>([]);
  const [listPage, setListPage] = useState(1);

  const debouncedSearch = useDebounce(search, DISTRIBUTION_SEARCH_DEBOUNCE_MS);

  // Server-side filter/page reset whenever a filter dimension changes.
  const filterKey = `${debouncedSearch}|${filterStatus.join(",")}|${String(showDeleted)}`;
  const [previousFilterKey, setPreviousFilterKey] = useState(filterKey);
  if (previousFilterKey !== filterKey) {
    setPreviousFilterKey(filterKey);
    setListPage(1);
  }

  // Open the distribute modal during render when the caller bumps the create request key.
  const [previousCreateRequestKey, setPreviousCreateRequestKey] = useState(0);
  if (previousCreateRequestKey !== createRequestKey) {
    setPreviousCreateRequestKey(createRequestKey);
    if (createRequestKey > 0 && canWrite && !showDeleted) setShowModal(true);
  }

  const pageQuery = useHasanatContractList({
    page: listPage,
    limit: HASANAT_MODULE_MANIFEST.defaultPageSize,
    search: debouncedSearch,
    status: filterStatus.length ? filterStatus.join(",") : undefined,
    includeDeleted: showDeleted,
  });

  const pageDistributions: Distribution[] = (pageQuery.data?.body?.distributions ??
    []) as Distribution[];
  const serverTotal = pageQuery.data?.body?.total ?? 0;
  const serverPage = pageQuery.data?.body?.page ?? listPage;
  const serverLimit = pageQuery.data?.body?.limit ?? HASANAT_MODULE_MANIFEST.defaultPageSize;
  const serverHasMore = pageQuery.data?.body?.hasMore ?? false;

  useEffect(() => {
    onFilteredCountChange?.(serverTotal);
  }, [onFilteredCountChange, serverTotal]);

  const toggleStatus = (status: DistributionStatus) =>
    setFilterStatus((selectedStatuses) => {
      const nextSet = new Set(selectedStatuses);
      if (nextSet.has(status)) {
        nextSet.delete(status);
      } else {
        nextSet.add(status);
      }
      return [...nextSet];
    });

  const handleDistribute = async (dist: Distribution) => {
    await onCreate(dist);
    setShowModal(false);
  };

  const changeStatus = (id: string, status: DistributionStatus) => {
    const distribution = pageDistributions.find((item) => item.id === id);
    if (distribution) void onUpdate({ ...distribution, status });
  };

  return {
    t,
    statusLabels,
    statusConfig,
    showModal,
    setShowModal,
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    listPage,
    setListPage,
    pageDistributions,
    pageQuery,
    serverTotal,
    serverPage,
    serverLimit,
    serverHasMore,
    toggleStatus,
    handleDistribute,
    changeStatus,
  };
}
