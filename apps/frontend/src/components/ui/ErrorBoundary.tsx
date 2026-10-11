import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { reportClientError } from "@/lib/clientErrorReporting";
import { useTranslation } from "@/hooks/useTranslation";

const LazyErrorState = React.lazy(() =>
  import("@/components/ui/ErrorState").then((m) => ({ default: m.ErrorState })),
);

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

function ErrorBoundaryFallback({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className={`${WORK_SURFACE} p-6 my-4`}>
      <React.Suspense
        fallback={
          <div className="p-4 text-center text-muted-foreground">{t("common.loading")}</div>
        }
      >
        <LazyErrorState
          title={t("errors.boundary.title")}
          description={error?.message || t("errors.boundary.description")}
          onRetry={onRetry}
        />
      </React.Suspense>
    </div>
  );
}

/**
 * ErrorBoundary component that catches runtime errors in child components
 * and displays a fallback user interface instead of crashing the application.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    reportClientError(error, { componentStack: errorInfo.componentStack });
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <ErrorBoundaryFallback error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}
