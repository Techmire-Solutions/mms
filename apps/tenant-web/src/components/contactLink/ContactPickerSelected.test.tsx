import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/contracts";
import { ContactPickerSelected } from "@/components/contactLink/ContactPickerSelected";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "common.dismiss": "Dismiss",
        "contacts.gender.male": "Male",
        "contacts.gender.female": "Female",
        "account.changePhoto": "Change Photo",
      };
      return labels[key] ?? key;
    },
  }),
}));

const mockContact: Contact = {
  id: "cnt-99",
  name: "Ali Raza",
  firstName: "Ali",
  lastName: "Raza",
  phone: "+1 555-0199",
  email: "ali.raza@madrasa.com",
  gender: "male",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactPickerSelected Component", () => {
  it("renders selected contact details, avatar, and clear button", () => {
    const fileRef = { current: null };
    const html = renderToStaticMarkup(
      <ContactPickerSelected
        selected={mockContact}
        label="Teacher Contact"
        required={true}
        value="cnt-99"
        resolvedId="teacher-contact"
        resolvedName="teacherContactId"
        avatarInputId="avatar-file"
        fileInputRef={fileRef}
        onClear={vi.fn()}
        onFileChange={vi.fn()}
      />,
    );

    expect(html).toContain("Teacher Contact");
    expect(html).toContain("text-destructive"); // required asterisk
    expect(html).toContain("Ali Raza");
    expect(html).toContain("+1 555-0199");
    expect(html).toContain("ali.raza@madrasa.com");
    expect(html).toContain("Male");
    expect(html).toContain('aria-label="Dismiss"');
    expect(html).toContain('value="cnt-99"');
  });

  it("renders interactive photo upload trigger when onAvatarChange is supplied", () => {
    const fileRef = { current: null };
    const html = renderToStaticMarkup(
      <ContactPickerSelected
        selected={mockContact}
        label="Contact"
        value="cnt-99"
        resolvedId="contact"
        resolvedName="contactId"
        avatarInputId="avatar-file"
        fileInputRef={fileRef}
        onAvatarChange={vi.fn()}
        onClear={vi.fn()}
        onFileChange={vi.fn()}
      />,
    );

    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Change Photo"');
    expect(html).toContain("lucide-camera");
  });
});
