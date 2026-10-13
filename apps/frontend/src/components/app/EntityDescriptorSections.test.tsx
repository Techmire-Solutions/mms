import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EntityDescriptorSections } from "@/components/app/EntityDescriptorSections";
import { createEntityDescriptor } from "@/components/common/entityDescriptorFactory";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

interface SampleEntity {
  id: string;
  name: string;
  status: "active" | "archived";
}

const sampleDescriptor: EntityDescriptor<SampleEntity> = createEntityDescriptor<SampleEntity>({
  entityType: "sample",
  singularLabel: "Sample",
  pluralLabel: "Samples",
  idField: "id",
  titleField: "name",
  fields: [
    {
      key: "name",
      label: "Full Name",
      type: "text",
      fixed: true,
      defaultVisibleInTable: true,
      tableOrder: 10,
      cardSlot: "primary",
      drawerSection: "identity",
      drawerOrder: 10,
    },
    {
      key: "status",
      label: "Status",
      type: "text",
      fixed: true,
      defaultVisibleInTable: true,
      tableOrder: 20,
      cardSlot: "badge",
      drawerSection: "identity",
      drawerOrder: 20,
    },
  ],
});

const sampleEntity: SampleEntity = { id: "1", name: "Ahmad", status: "active" };

describe("EntityDescriptorSections", () => {
  it("given descriptor and entity, should render section titles and field values", () => {
    const html = renderToStaticMarkup(
      <EntityDescriptorSections descriptor={sampleDescriptor} entity={sampleEntity} />,
    );

    expect(html).toContain("Full Name");
    expect(html).toContain("Ahmad");
    expect(html).toContain("Status");
    expect(html).toContain("active");
  });

  it("given no descriptor, should render nothing", () => {
    const html = renderToStaticMarkup(<EntityDescriptorSections entity={sampleEntity} />);
    expect(html).toBe("");
  });
});
