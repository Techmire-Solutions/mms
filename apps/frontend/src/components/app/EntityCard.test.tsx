import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EntityCard } from "./EntityCard";
import { EntityCardsGrid } from "./EntityCardsGrid";

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));

describe("EntityCard Component", () => {
  it("renders card content and selection state", () => {
    const html = renderToStaticMarkup(
      <EntityCard isSelected={true} accentClassName="bg-primary">
        <div>Card Body</div>
      </EntityCard>,
    );

    expect(html).toContain("Card Body");
    expect(html).toContain("border-primary/50");
  });

  it("exposes compound components Header, MetaGrid, and Footer", () => {
    expect(EntityCard.Header).toBeDefined();
    expect(EntityCard.MetaGrid).toBeDefined();
    expect(EntityCard.Footer).toBeDefined();
  });

  it("renders compound card composition", () => {
    const html = renderToStaticMarkup(
      <EntityCard>
        <EntityCard.Header
          id="123"
          displayName="Zayd Ahmad"
          isSelected={false}
          onSelect={() => {}}
          selectAriaLabel="Select Zayd"
        />
        <EntityCard.MetaGrid>
          <div>Meta 1</div>
          <div>Meta 2</div>
        </EntityCard.MetaGrid>
        <EntityCard.Footer trailing={<button type="button">Edit</button>} />
      </EntityCard>,
    );

    expect(html).toContain("Zayd Ahmad");
    expect(html).toContain("Meta 1");
    expect(html).toContain("Meta 2");
    expect(html).toContain("Edit");
  });
});

describe("EntityCardsGrid Component", () => {
  it("renders children in responsive grid layout", () => {
    const html = renderToStaticMarkup(
      <EntityCardsGrid cols={3}>
        <div>Card 1</div>
        <div>Card 2</div>
        <div>Card 3</div>
      </EntityCardsGrid>,
    );

    expect(html).toContain("Card 1");
    expect(html).toContain("Card 2");
    expect(html).toContain("Card 3");
    expect(html).toContain("lg:grid-cols-3");
  });

  it("renders parameterized items list", () => {
    const items = [
      { id: "1", title: "Item 1" },
      { id: "2", title: "Item 2" },
    ];

    const html = renderToStaticMarkup(
      <EntityCardsGrid
        items={items}
        renderItem={(item) => <div key={item.id}>{item.title}</div>}
      />,
    );

    expect(html).toContain("Item 1");
    expect(html).toContain("Item 2");
  });
});
