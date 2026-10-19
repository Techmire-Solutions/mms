import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ErrorState } from "@/components/app/ErrorState";
import { ListPagination } from "@/components/app/ListPagination";
import { TableSkeleton, CardSkeleton } from "@shared/ui";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export type ModuleWorkListViewMode = "table" | "cards";

export interface ModuleWorkListPageData {
  page: number;
  total: number;
  limit: number;
  hasMore: boolean;
}

export interface ModuleWorkListStateShellProps {
  isError: boolean;
  isLoading: boolean;
  isFetching: boolean;
  onRetry: () => void;
  errorTitle: string;
  errorHint: string;
  viewMode: ModuleWorkListViewMode;
  skeletonColumnCount: number;
  useServerWork: boolean;
  pageData: ModuleWorkListPageData | null | undefined;
  onPageChange: (page: number) => void;
  /** Module id for pagination i18n keys (e.g. `contacts`, `students`). */
  i18nNamespace: string;
  paginationVariant?: "range" | "summary";
  showPagination: boolean;
  loadingLabel: string;
  children: ReactNode;
}

/** Shared Work directory error / skeleton / list frame / pagination / fetching chrome. */
export function ModuleWorkListStateShell({
  isError,
  isLoading,
  isFetching,
  onRetry,
  errorTitle,
  errorHint,
  viewMode,
  skeletonColumnCount,
  useServerWork,
  pageData,
  onPageChange,
  i18nNamespace,
  paginationVariant = "range",
  showPagination,
  loadingLabel,
  children,
}: ModuleWorkListStateShellProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    if (isError) {
      return (
        <div>
          <ErrorState title={errorTitle} description={errorHint} onRetry={onRetry} />
        </div>
      );
    }
    if (isLoading) {
      return (
        <div aria-busy="true" role="status" aria-live="polite">
          {viewMode === "cards" ? (
            <CardSkeleton count={6} className="grid-cols-1 sm:grid-cols-2" />
          ) : (
            <TableSkeleton rows={6} cols={skeletonColumnCount} />
          )}
          <span className="sr-only">{loadingLabel}</span>
        </div>
      );
    }
    return (
      <div aria-busy={useServerWork && isFetching ? true : undefined}>
        <ErrorBoundary>
          {children}
          {useServerWork && pageData && showPagination ? (
            <ListPagination
              page={pageData.page}
              total={pageData.total}
              limit={pageData.limit}
              hasMore={pageData.hasMore}
              onPageChange={onPageChange}
              i18nNamespace={i18nNamespace}
              variant={paginationVariant}
            />
          ) : null}
          {useServerWork && isFetching ? (
            <p className="text-xs text-muted-foreground px-1" role="status" aria-live="polite">
              {loadingLabel}
            </p>
          ) : null}
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {isError ? (
        <motion.div
          key="error"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <ErrorState title={errorTitle} description={errorHint} onRetry={onRetry} />
        </motion.div>
      ) : isLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-busy="true"
          role="status"
          aria-live="polite"
        >
          {viewMode === "cards" ? (
            <CardSkeleton count={6} className="grid-cols-1 sm:grid-cols-2" />
          ) : (
            <TableSkeleton rows={6} cols={skeletonColumnCount} />
          )}
          <span className="sr-only">{loadingLabel}</span>
        </motion.div>
      ) : (
        <motion.div
          key="list-view"
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          aria-busy={useServerWork && isFetching ? true : undefined}
        >
          <ErrorBoundary>
            {children}
            {useServerWork && pageData && showPagination ? (
              <ListPagination
                page={pageData.page}
                total={pageData.total}
                limit={pageData.limit}
                hasMore={pageData.hasMore}
                onPageChange={onPageChange}
                i18nNamespace={i18nNamespace}
                variant={paginationVariant}
              />
            ) : null}
            {useServerWork && isFetching ? (
              <p className="text-xs text-muted-foreground px-1" role="status" aria-live="polite">
                {loadingLabel}
              </p>
            ) : null}
          </ErrorBoundary>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
