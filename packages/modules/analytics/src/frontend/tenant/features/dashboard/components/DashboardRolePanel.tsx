import React from "react";
import QuickActionsPanel from "./QuickActionsPanel";
import NotificationsPanel from "./NotificationsPanel";
import type { DashboardRole } from "../../../lib/dashboardRole";
import type { buildDashboardNotifications } from "../../../lib/buildDashboardNotifications";
import { useDashboardQuickActions } from "../hooks/useDashboardQuickActions";
import { useOpenTenantNotification } from "../../../host/collections";
import { useNotificationReadState } from "../../../host/collections";

interface DashboardRolePanelProps {
  dashboardRole: DashboardRole;
  notifications: ReturnType<typeof buildDashboardNotifications>;
}

/** Quick actions + notifications strip for the active dashboard layout role. */
export function DashboardRolePanel({
  dashboardRole,
  notifications,
}: DashboardRolePanelProps): React.JSX.Element {
  const openNotification = useOpenTenantNotification();
  const { markRead } = useNotificationReadState();
  const quickActions = useDashboardQuickActions(dashboardRole);
  // Keep the 2/1 split only when there is a quick-actions panel to fill it;
  // otherwise notifications take the whole row instead of leaving a blank hole.
  const hasQuickActions = quickActions.length > 0;

  return (
    <div
      className={
        hasQuickActions ? "grid grid-cols-1 lg:grid-cols-3 gap-4" : "grid grid-cols-1 gap-4"
      }
    >
      {hasQuickActions ? (
        <div className="lg:col-span-2">
          <QuickActionsPanel actions={quickActions} />
        </div>
      ) : null}
      <div>
        <NotificationsPanel
          items={notifications}
          onOpen={(item: any) => {
            markRead(item);
            openNotification(item.target);
          }}
        />
      </div>
    </div>
  );
}

export default DashboardRolePanel;
