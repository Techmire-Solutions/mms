import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  renderEducationSubField,
  renderExperienceSubField,
  renderSkillsSubField,
} from "./contactMetadataSubFields";
import type { Contact } from "@mms/shared";

const mockContact: Contact = {
  id: "c-1",
  name: "Ahmad Hassan",
  firstName: "Ahmad",
  lastName: "Hassan",
  gender: "male",
  roles: ["student"],
  phones: [],
  emails: [],
  education: [
    {
      degree: "BSc Computer Science",
      institution: "Madrasa University",
      fieldOfStudy: "Computing",
      year: "2024",
      grade: "A+",
    },
  ],
  experience: [
    {
      title: "Senior Instructor",
      organization: "Darul Uloom",
      employmentType: "Full-Time",
      location: "Cairo",
    },
  ],
  skills: [
    {
      name: "Tajweed Rules",
      category: "Quranic Sciences",
      proficiency: "Master",
      yearsOfExperience: "7",
      isCertified: true,
      issuer: "Al-Azhar",
    },
  ],
};

const renderJoinedList = (items: (string | undefined | null)[], showTitle = false) => {
  const valid = items.filter(Boolean) as string[];
  return <span title={showTitle ? valid.join(", ") : undefined}>{valid.join(", ")}</span>;
};

const t = (k: string) => k;
const emptyNode = <span>—</span>;

describe("contactMetadataSubFields", () => {
  describe("renderEducationSubField", () => {
    it("renders education sub-fields correctly", () => {
      const degreeHtml = renderToStaticMarkup(
        <div>{renderEducationSubField("education_degree", mockContact, renderJoinedList)}</div>,
      );
      expect(degreeHtml).toContain("BSc Computer Science");

      const instHtml = renderToStaticMarkup(
        <div>{renderEducationSubField("educationInstitution", mockContact, renderJoinedList)}</div>,
      );
      expect(instHtml).toContain("Madrasa University");

      const fieldHtml = renderToStaticMarkup(
        <div>
          {renderEducationSubField("education_fieldOfStudy", mockContact, renderJoinedList)}
        </div>,
      );
      expect(fieldHtml).toContain("Computing");
    });

    it("returns null for non-education colId", () => {
      expect(renderEducationSubField("skills_name", mockContact, renderJoinedList)).toBeNull();
    });
  });

  describe("renderExperienceSubField", () => {
    it("renders experience sub-fields correctly", () => {
      const titleHtml = renderToStaticMarkup(
        <div>{renderExperienceSubField("experience_title", mockContact, renderJoinedList)}</div>,
      );
      expect(titleHtml).toContain("Senior Instructor");

      const orgHtml = renderToStaticMarkup(
        <div>
          {renderExperienceSubField("experienceOrganization", mockContact, renderJoinedList)}
        </div>,
      );
      expect(orgHtml).toContain("Darul Uloom");

      const locHtml = renderToStaticMarkup(
        <div>{renderExperienceSubField("experience_location", mockContact, renderJoinedList)}</div>,
      );
      expect(locHtml).toContain("Cairo");
    });

    it("returns null for non-experience colId", () => {
      expect(
        renderExperienceSubField("education_degree", mockContact, renderJoinedList),
      ).toBeNull();
    });
  });

  describe("renderSkillsSubField", () => {
    it("renders skill sub-fields and certified badge", () => {
      const nameHtml = renderToStaticMarkup(
        <div>
          {renderSkillsSubField({
            colId: "skills_name",
            contact: mockContact,
            renderJoinedList,
            emptyNode,
            t,
          })}
        </div>,
      );
      expect(nameHtml).toContain("Tajweed Rules");

      const certHtml = renderToStaticMarkup(
        <div>
          {renderSkillsSubField({
            colId: "skills_isCertified",
            contact: mockContact,
            renderJoinedList,
            emptyNode,
            t,
          })}
        </div>,
      );
      expect(certHtml).toContain("contacts.columns.skillsIsCertified");
    });

    it("returns emptyNode when skill is not certified", () => {
      const uncertifiedContact = {
        ...mockContact,
        skills: [{ ...mockContact.skills![0]!, isCertified: false }],
      };
      const certHtml = renderToStaticMarkup(
        <div>
          {renderSkillsSubField({
            colId: "skills_isCertified",
            contact: uncertifiedContact,
            renderJoinedList,
            emptyNode,
            t,
          })}
        </div>,
      );
      expect(certHtml).toContain("—");
    });

    it("returns null for non-skills colId", () => {
      expect(
        renderSkillsSubField({
          colId: "unknown_col",
          contact: mockContact,
          renderJoinedList,
          emptyNode,
          t,
        }),
      ).toBeNull();
    });
  });
});
