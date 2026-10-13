import { describe, expect, it } from "vitest";
import { createModuleStatusUi } from "@/lib/moduleStatusUi";

const t = (key: string) => (key === "student.status.active" ? "Active" : key);

const ui = createModuleStatusUi({
  translationPrefix: "student.status",
  resolveStatuses: (statuses) => statuses ?? ["active", "inactive"],
  toneForStatus: (status) => (status === "active" ? "bg-success" : "bg-muted"),
  metricAccentForStatus: (status) => (status === "active" ? "success" : "muted"),
});

describe("createModuleStatusUi", () => {
  it("statusLabel returns translated label or Title Case fallback", () => {
    expect(ui.statusLabel(t, "active")).toBe("Active");
    expect(ui.statusLabel(t, "inactive")).toBe("Inactive");
  });

  it("statusOptions maps resolved statuses to value/label pairs", () => {
    const options = ui.statusOptions(t, ["active", "inactive"]);
    expect(options).toEqual([
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
    ]);
  });

  it("statusOptions falls back to default statuses when none provided", () => {
    const options = ui.statusOptions(t);
    expect(options).toHaveLength(2);
    expect(options[0].value).toBe("active");
  });

  it("statusBadgeConfig builds a config per status", () => {
    const config = ui.statusBadgeConfig(t, ["active", "inactive"]);
    expect(config.active).toEqual({ label: "Active", cls: "bg-success" });
    expect(config.inactive).toEqual({ label: "Inactive", cls: "bg-muted" });
  });

  it("statusMetricAccent returns the mapped accent or muted fallback", () => {
    expect(ui.statusMetricAccent("active")).toBe("success");
    expect(ui.statusMetricAccent("inactive")).toBe("muted");
  });
});
