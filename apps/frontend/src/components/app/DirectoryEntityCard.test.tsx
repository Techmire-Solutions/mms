import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DirectoryEntityCard } from "./DirectoryEntityCard";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

interface TestEntity {
  id: string;
  name: string;
  code: string;
  phone?: string;
  email?: string;
}

const mockEntity: TestEntity = {
  id: "item-1",
  name: "Zayd Ahmad",
  code: "STD-100",
  phone: "+1234567890",
  email: "zayd@madrasa.com",
};

describe("DirectoryEntityCard", () => {
  it("renders header with display name, subtitle, and default view button", () => {
    const html = renderToStaticMarkup(
      <DirectoryEntityCard
        entity={mockEntity}
        header={{
          displayName: mockEntity.name,
          subtitle: <span>{mockEntity.code}</span>,
        }}
        onView={vi.fn()}
      />,
    );

    expect(html).toContain("Zayd Ahmad");
    expect(html).toContain("STD-100");
    expect(html).toContain("contacts.actionViewShort");
  });

  it("renders selection checkbox when canSelect is true", () => {
    const html = renderToStaticMarkup(
      <DirectoryEntityCard
        entity={mockEntity}
        selectedIds={["item-1"]}
        canSelect={true}
        header={{
          displayName: mockEntity.name,
        }}
      />,
    );

    expect(html).toContain('role="checkbox"');
    expect(html).toContain('aria-checked="true"');
  });

  it("renders info pills when phone and email are provided", () => {
    const html = renderToStaticMarkup(
      <DirectoryEntityCard
        entity={mockEntity}
        header={{
          displayName: mockEntity.name,
        }}
        infoPills={{
          phone: mockEntity.phone,
          email: mockEntity.email,
        }}
      />,
    );

    expect(html).toContain("+1234567890");
    expect(html).toContain("zayd@madrasa.com");
  });

  it("renders metadata columns using DirectoryCardMetadata", () => {
    const html = renderToStaticMarkup(
      <DirectoryEntityCard
        entity={mockEntity}
        header={{
          displayName: mockEntity.name,
        }}
        columns={[{ key: "code", label: "Student Code" }]}
        keyFor={(col) => col.key}
        labelFor={(col) => col.label}
        renderValue={(col) => mockEntity[col.key as keyof TestEntity]}
      />,
    );

    expect(html).toContain("Student Code");
    expect(html).toContain("STD-100");
  });

  it("renders banner and overflow actions in footer", () => {
    const html = renderToStaticMarkup(
      <DirectoryEntityCard
        entity={mockEntity}
        header={{
          displayName: mockEntity.name,
        }}
        banner={<div data-testid="test-banner">Archived Record</div>}
        overflowActions={<button type="button">More Options</button>}
      />,
    );

    expect(html).toContain("Archived Record");
    expect(html).toContain("More Options");
  });

  it("renders start-edge colored line and inset by default", () => {
    const html = renderToStaticMarkup(
      <DirectoryEntityCard entity={mockEntity} header={{ displayName: mockEntity.name }} />,
    );

    expect(html).toContain("w-1.5");
    expect(html).toContain("bg-primary/50");
    expect(html).toContain("ps-5 sm:ps-6");
  });

  it("renders custom accent stripe class when provided", () => {
    const html = renderToStaticMarkup(
      <DirectoryEntityCard
        entity={mockEntity}
        header={{ displayName: mockEntity.name }}
        accentClassName="bg-success/70"
      />,
    );

    expect(html).toContain("bg-success/70");
    expect(html).toContain("ps-5 sm:ps-6");
  });

  it("omits accent stripe when accentClassName is false", () => {
    const html = renderToStaticMarkup(
      <DirectoryEntityCard
        entity={mockEntity}
        header={{ displayName: mockEntity.name }}
        accentClassName={false}
      />,
    );

    expect(html).not.toContain("bg-primary/50");
    expect(html).not.toContain("ps-5 sm:ps-6");
  });
});
