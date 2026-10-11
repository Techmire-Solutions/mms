import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BackgroundJobsTray } from "./BackgroundJobsTray";
import type { BackgroundJobRecord } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("BackgroundJobsTray", () => {
  it("renders null when jobs array is empty", () => {
    const markup = renderToStaticMarkup(<BackgroundJobsTray jobs={[]} />);
    expect(markup).toBe("");
  });

  it("renders badge and trigger when jobs exist", () => {
    const jobs: BackgroundJobRecord[] = [
      {
        id: "job-1",
        kind: "export",
        label: "Export Contacts",
        status: "running",
        moduleId: "contacts",
        createdAt: "2026-09-27T10:00:00.000Z",
        progress: { current: 5, total: 10 },
      },
    ];

    const markup = renderToStaticMarkup(<BackgroundJobsTray jobs={jobs} activeJobs={jobs} />);
    expect(markup).toContain("backgroundJobs.trayLabel");
    expect(markup).toContain("1");
  });

  it("handles interactions when mounted in DOM", async () => {
    const jobs: BackgroundJobRecord[] = [
      {
        id: "job-1",
        kind: "export",
        label: "Export Contacts",
        status: "completed",
        moduleId: "contacts",
        createdAt: "2026-09-27T10:00:00.000Z",
        hasDownload: true,
      },
    ];

    const onDismiss = vi.fn();
    const onRefresh = vi.fn();
    const onClearFinished = vi.fn();
    const onDownload = vi.fn().mockResolvedValue(undefined);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <BackgroundJobsTray
          jobs={jobs}
          activeJobs={[]}
          onDismiss={onDismiss}
          onRefresh={onRefresh}
          onClearFinished={onClearFinished}
          onDownload={onDownload}
        />,
      );
    });

    const trigger = container.querySelector("button");
    expect(trigger).not.toBeNull();

    // Click trigger to open modal
    await act(async () => {
      trigger?.click();
    });

    // Check modal contents in document
    expect(document.body.textContent).toContain("Export Contacts");

    // Click refresh
    const refreshBtn = Array.from(document.body.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("backgroundJobs.refresh"),
    );
    await act(async () => {
      refreshBtn?.click();
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // Click dismiss
    const dismissBtn = document.body.querySelector("button[aria-label='backgroundJobs.dismiss']");
    await act(async () => {
      (dismissBtn as HTMLButtonElement)?.click();
    });
    expect(onDismiss).toHaveBeenCalledWith("job-1");

    // Click download
    const downloadBtn = document.body.querySelector("button[aria-label='backgroundJobs.download']");
    await act(async () => {
      (downloadBtn as HTMLButtonElement)?.click();
    });
    expect(onDownload).toHaveBeenCalledWith("job-1");

    // Click clear finished
    const clearBtn = Array.from(document.body.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("backgroundJobs.clearFinished"),
    );
    await act(async () => {
      clearBtn?.click();
    });
    expect(onClearFinished).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });
});
