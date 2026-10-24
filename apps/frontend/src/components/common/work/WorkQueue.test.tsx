import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkQueue, type WorkQueuePriority } from "./WorkQueue";
import { TranslationContext, type TranslationFunction } from "@/lib/contexts/TranslationContext";
import { translateAppParams } from "@mms/shared";

const mockContext = {
  language: "en",
  t: ((
    key: Parameters<typeof translateAppParams>[0],
    ...args: [Record<string, string | number>?]
  ) => translateAppParams(key, "en", ...args)) as TranslationFunction,
  isLoading: false,
  dir: "ltr" as const,
  isRtl: false,
};

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <TranslationContext.Provider value={mockContext}>{children}</TranslationContext.Provider>;
}

describe("WorkQueue", () => {
  interface SampleTask {
    id: string;
    title: string;
    description: string;
    priority: WorkQueuePriority;
    status: string;
  }

  const sampleTasks: SampleTask[] = [
    {
      id: "task-1",
      title: "Review Grade Submissions",
      description: "Grade submissions for Quran Class A",
      priority: "urgent",
      status: "Pending",
    },
    {
      id: "task-2",
      title: "Approve Leave Request",
      description: "Teacher leave request from Ustadh Bilal",
      priority: "normal",
      status: "In Review",
    },
  ];

  it("renders queue title, items, priority badges, and status badges", () => {
    const html = renderToStaticMarkup(
      <TestWrapper>
        <WorkQueue
          title="Daily Task Queue"
          description="Pending operational reviews"
          items={sampleTasks}
          getItemTitle={(t) => t.title}
          getItemDescription={(t) => t.description}
          priorityField={(t) => t.priority}
          statusField={(t) => ({ label: t.status, tone: "warning" })}
        />
      </TestWrapper>,
    );

    expect(html).toContain("Daily Task Queue");
    expect(html).toContain("Pending operational reviews");
    expect(html).toContain("Review Grade Submissions");
    expect(html).toContain("Approve Leave Request");
    expect(html).toContain("Urgent");
    expect(html).toContain("Normal");
    expect(html).toContain("Pending");
    expect(html).toContain("In Review");
  });

  it("renders selection controls and footer summary counts", () => {
    const html = renderToStaticMarkup(
      <TestWrapper>
        <WorkQueue
          items={sampleTasks}
          getItemTitle={(t) => t.title}
          selection={{
            selectedIds: ["task-1"],
            onSelectOne: vi.fn(),
            onSelectAll: vi.fn(),
            allSelected: false,
            someSelected: true,
            selectAllAriaLabel: "Select all tasks",
          }}
          footerCount={{
            pageCountLabel: "Showing 2 tasks",
            selectedCountLabel: "1 task selected",
          }}
        />
      </TestWrapper>,
    );

    expect(html).toContain("Select all tasks");
    expect(html).toContain("Showing 2 tasks");
    expect(html).toContain("1 task selected");
  });

  it("filters out optimistically deleted items", () => {
    const html = renderToStaticMarkup(
      <TestWrapper>
        <WorkQueue
          items={sampleTasks}
          getItemTitle={(t) => t.title}
          optimisticDeletedIds={new Set(["task-1"])}
        />
      </TestWrapper>,
    );

    expect(html).not.toContain("Review Grade Submissions");
    expect(html).toContain("Approve Leave Request");
  });

  it("renders empty state when items list is empty", () => {
    const html = renderToStaticMarkup(
      <TestWrapper>
        <WorkQueue
          items={[]}
          emptyState={<div data-testid="empty">All operational tasks are completed!</div>}
        />
      </TestWrapper>,
    );

    expect(html).toContain("All operational tasks are completed!");
  });
});
