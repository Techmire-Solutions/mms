import React from "react";
import { Navigate, useParams } from "react-router-dom";
import { isSettingsSection, ROUTES } from "@/lib/config/routes";
import { settingsTabPath } from "@/lib/config/settingsDeepLink";

/**
 * `/settings/:section` bookmarks resolve to the canonical `?tab=` deep link
 * instead of silently dropping the requested section on `/settings`.
 */
export default function SettingsSectionRedirect(): React.JSX.Element {
  const { section } = useParams<{ section: string }>();
  const target = section && isSettingsSection(section) ? settingsTabPath(section) : ROUTES.settings;
  return <Navigate to={target} replace />;
}
