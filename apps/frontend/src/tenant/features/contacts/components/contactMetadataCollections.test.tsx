import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import {
  renderSocialMetadata,
  renderRelationshipMetadata,
  renderEducationMetadata,
  renderExperienceMetadata,
  renderSkillsMetadata,
} from "./contactMetadataCollections";

const mockContact: Contact = {
  id: "cnt-1",
  name: "Zayd Harith",
  firstName: "Zayd",
  lastName: "Harith",
  socials: [{ platform: "github", url: "https://github.com/zayd" }],
  education: [{ degree: "BS CS", institution: "FAST" }],
  experience: [{ title: "Software Engineer", organization: "Tech Corp" }],
  skills: [{ name: "TypeScript", proficiency: "Expert" }],
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("contactMetadataCollections helpers", () => {
  const t = (key: string) => key;

  it("renders social links", () => {
    const html = renderToStaticMarkup(
      <>{renderSocialMetadata({ contact: mockContact, emptyNode: "-", t: t as never })}</>,
    );
    expect(html).toContain("github.com/zayd");
  });

  it("renders education items", () => {
    const html = renderToStaticMarkup(
      <>{renderEducationMetadata({ contact: mockContact, emptyNode: "-" })}</>,
    );
    expect(html).toContain("BS CS");
    expect(html).toContain("FAST");
  });

  it("renders experience items", () => {
    const html = renderToStaticMarkup(
      <>{renderExperienceMetadata({ contact: mockContact, emptyNode: "-" })}</>,
    );
    expect(html).toContain("Software Engineer");
    expect(html).toContain("Tech Corp");
  });

  it("renders skills items", () => {
    const html = renderToStaticMarkup(
      <>{renderSkillsMetadata({ contact: mockContact, emptyNode: "-" })}</>,
    );
    expect(html).toContain("TypeScript");
    expect(html).toContain("Expert");
  });

  it("renders relationship items", () => {
    const html = renderToStaticMarkup(
      <>
        {renderRelationshipMetadata({
          contact: mockContact,
          contactsMap: new Map(),
          emptyNode: <span>-</span>,
          renderJoinedList: (items) => items.join(", "),
          t: t as never,
        })}
      </>,
    );
    expect(html).toContain("-");
  });
});
