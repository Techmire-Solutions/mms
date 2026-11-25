import React from "react";
import { AppPageShell as UiAppPageShell, type AppPageShellProps } from "@mms/ui";
import { ErrorBoundary } from "./ErrorBoundary";

export type { AppPageShellProps };

/** App adapter: supplies the console error boundary to the UI layout shell. */
export function AppPageShell(props: AppPageShellProps): React.JSX.Element {
  return <UiAppPageShell {...props} ErrorBoundaryComponent={ErrorBoundary} />;
}
