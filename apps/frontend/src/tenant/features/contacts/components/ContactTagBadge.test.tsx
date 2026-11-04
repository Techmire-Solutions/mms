import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact, ContactSystemTag } from "@mms/shared";
import { ContactTagBadge, ContactTagList } from "./ContactTagBadge";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const studentTag: ContactSystemTag = {
  name: "Student",
  source: "student",
  systemKey: "student:self",
  archived: false,
};

describe("ContactTagBadge Component", () => {
  it("renders a lock and accessible label for a system tag", () => {
    const html = renderToStaticMarkup(<ContactTagBadge tag="Student" system={studentTag} />);

    expect(html).toContain("Student");
    expect(html).toContain("lucide-lock");
    expect(html).toContain('aria-label="Student · contacts.tags.systemManaged"');
    expect(html).toContain('title="Student · contacts.tags.systemManaged"');
    expect(html).not.toContain("contacts.tags.archived");
  });

  it("appends the archived label for a former system tag", () => {
    const html = renderToStaticMarkup(
      <ContactTagBadge tag="Former Student" system={{ ...studentTag, archived: true }} />,
    );

    expect(html).toContain("lucide-lock");
    expect(html).toContain(
      'aria-label="Former Student · contacts.tags.systemManaged · contacts.tags.archived"',
    );
    expect(html).not.toContain("line-through");
  });

  it("keeps the primary tone and no lock for a manual tag", () => {
    const html = renderToStaticMarkup(<ContactTagBadge tag="VIP" />);

    expect(html).toContain("VIP");
    expect(html).toContain("bg-primary/10");
    expect(html).not.toContain("lucide-lock");
    expect(html).not.toContain("contacts.tags.systemManaged");
  });
});

describe("ContactTagList Component", () => {
  it("resolves system metadata by name and locks only system tags", () => {
    const contact: Contact = {
      id: "cnt-tags-1",
      name: "Tagged Contact",
      firstName: "Tagged",
      tags: ["VIP", "Student"],
      systemTags: [studentTag],
    };

    const html = renderToStaticMarkup(<ContactTagList contact={contact} />);

    expect(html).toContain("VIP");
    expect(html).toContain("Student");
    expect((html.match(/lucide-lock/g) ?? []).length).toBe(1);
  });
});
