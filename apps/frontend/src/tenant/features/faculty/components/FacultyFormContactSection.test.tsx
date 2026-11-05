/**
 * Faculty create/edit contact card.
 *
 * Contacts already linked to another faculty member are excluded from the
 * picker; opening it then says "No contacts found" with no explanation.
 */
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { FieldDefinition } from "@mms/shared";

const captured = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/contactLink/ContactPicker", () => ({
  default: (props: Record<string, unknown>) => {
    captured.props = props;
    return null;
  },
}));

vi.mock("@/tenant/features/faculty/components/FacultyContactBackgroundSection", () => ({
  FacultyContactBackgroundSection: () => null,
}));

import { FacultyContactSection } from "./FacultyFormContactSection";

const fields: Record<string, FieldDefinition[]> = {
  basic: [{ key: "contactId", label: "Contact", enabled: true } as unknown as FieldDefinition],
};

function render(linkedFacultyContactIds: string[]) {
  return renderToStaticMarkup(
    <FacultyContactSection
      facultyDraft={{ contactId: "" }}
      linkedFacultyContactIds={linkedFacultyContactIds}
      errors={{}}
      fields={fields}
      isFieldEnabled={() => true}
      isFieldRequired={() => false}
      onDraftChange={vi.fn()}
    />,
  );
}

describe("FacultyContactSection contact picker", () => {
  beforeEach(() => {
    captured.props = null;
  });

  it("explains exclusions instead of a bare 'no contacts' when faculty links hide everyone", () => {
    render(["contact-linked-elsewhere"]);

    expect(captured.props?.emptyHint).toBe("faculty.form.contactExclusionHint");
  });

  it("keeps the generic hint when nothing is excluded", () => {
    render([]);

    expect(captured.props?.emptyHint).toBe("faculty.form.noContactsHint");
  });
});
