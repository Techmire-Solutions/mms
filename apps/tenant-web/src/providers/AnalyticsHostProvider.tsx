import React from "react";
import { bindAnalyticsHost } from "@/providers/analyticsHostBindings";

/** Binds the app report collections, widgets and libs into the analytics module host. */
export function AnalyticsHostBridge({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  bindAnalyticsHost();
  return <>{children}</>;
}
