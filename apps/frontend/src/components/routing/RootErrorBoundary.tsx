import React from "react";
import { translateAppParams } from "@mms/shared";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";

import { Button } from "@/components/ui/button";

export default function RootErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="text-center max-w-md space-y-4">
            <h2 className="text-xl font-bold text-foreground">
              {translateAppParams("errors.boundary.title", "en")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {translateAppParams("errors.boundary.description", "en")}
            </p>
            <Button onClick={() => window.location.reload()}>
              {translateAppParams("common.retry", "en")}
            </Button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
