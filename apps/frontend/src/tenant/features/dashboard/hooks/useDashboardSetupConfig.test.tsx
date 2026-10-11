import React from "react";
import { describe, expect, it } from "vitest";
import {
  useDashboardPreferencesQuery,
  useDashboardWidgetsQuery,
  useDashboardPreferencesMutation,
  useDashboardWidgetsMutation,
  useDashboardWidgetDeleteMutation,
} from "./useDashboardSetupConfig";

describe("useDashboardSetupConfig exports", () => {
  it("instantiates hook exports correctly in a React element context", () => {
    function TestSetupConfigComponent() {
      const prefsQuery = useDashboardPreferencesQuery();
      const widgetsQuery = useDashboardWidgetsQuery();
      const prefsMut = useDashboardPreferencesMutation();
      const widgetsMut = useDashboardWidgetsMutation();
      const delMut = useDashboardWidgetDeleteMutation();
      return (
        <div>
          {prefsQuery.status}-{widgetsQuery.status}-{prefsMut.status}-{widgetsMut.status}-
          {delMut.status}
        </div>
      );
    }

    const element = <TestSetupConfigComponent />;
    expect(element.type).toBe(TestSetupConfigComponent);
  });
});
