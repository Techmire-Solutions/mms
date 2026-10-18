import React, { act } from "react";
import { describe, it, expect, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createEntityDescriptor,
  contactsEntityDescriptor,
  studentsEntityDescriptor,
  facultyEntityDescriptor,
  sessionsEntityDescriptor,
  financeEntityDescriptor,
  platformWorkspacesEntityDescriptor,
  attendanceEntityDescriptor,
  enrollmentsEntityDescriptor,
  hasanatEntityDescriptor,
  obligationsEntityDescriptor,
  platformUsersEntityDescriptor,
  platformSettingsEntityDescriptor,
  examinationsEntityDescriptor,
  messagingEntityDescriptor,
  getEntityDescriptor,
} from "@/components/common/entityRegistry";
import { EntityCardMetadata } from "@/components/app/EntityCardMetadata";
import { Drawer } from "@/components/app/Drawer";
import { EntityDescriptorSections } from "@/components/app/EntityDescriptorSections";
import { FilterChips } from "@/components/app/FilterChips";
import { useDescriptorFilterChips } from "@/components/common/useDescriptorFilterChips";
import { AppShell } from "@/components/common/AppShell";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    dir: "ltr",
    language: "en",
  }),
}));

describe("SSOT Entity UI Registry Architecture", () => {
  describe("createEntityDescriptor", () => {
    it("creates a well-formed entity descriptor with table columns, card fields, and drawer sections", () => {
      interface CustomEntity {
        id: string;
        name: string;
        amount: number;
        status: string;
        created: string;
      }

      const descriptor = createEntityDescriptor<CustomEntity>({
        entityType: "custom",
        singularLabel: "Custom Item",
        pluralLabel: "Custom Items",
        idField: "id",
        titleField: "name",
        fields: [
          {
            key: "name",
            label: "Name",
            type: "text",
            tableOrder: 1,
            fixed: true,
            cardSlot: "primary",
            drawerSection: "info",
            drawerOrder: 1,
          },
          {
            key: "amount",
            label: "Amount",
            type: "currency",
            currencyCode: "USD",
            tableOrder: 2,
            cardSlot: "secondary",
            drawerSection: "financial",
            drawerOrder: 2,
          },
          {
            key: "status",
            label: "Status",
            type: "status",
            tableOrder: 3,
            cardSlot: "badge",
            drawerSection: "info",
            drawerOrder: 2,
          },
          {
            key: "created",
            label: "Created Date",
            type: "date",
            defaultVisibleInTable: false,
            cardSlot: "hidden",
            drawerSection: "meta",
            hideInDrawer: true,
          },
        ],
      });

      expect(descriptor.entityType).toBe("custom");
      expect(descriptor.singularLabel).toBe("Custom Item");

      // Table columns
      const cols = descriptor.getTableColumns();
      expect(cols).toHaveLength(4);
      expect(cols[0].id).toBe("name");
      expect(cols[0].fixed).toBe(true);
      expect(cols[0].enabled).toBe(true);
      expect(cols[3].id).toBe("created");
      expect(cols[3].enabled).toBe(false);

      // Card fields
      const cardFields = descriptor.getCardFields();
      expect(cardFields).toHaveLength(3);
      expect(cardFields.map((f) => f.key)).toEqual(["name", "amount", "status"]);

      // Drawer sections
      const sections = descriptor.getDrawerSections();
      expect(sections).toHaveLength(2); // info, financial (meta is hideInDrawer)
      expect(sections[0].id).toBe("info");
      expect(sections[0].fields).toHaveLength(2);
      expect(sections[1].id).toBe("financial");
      expect(sections[1].fields).toHaveLength(1);

      // Format value
      const entity: CustomEntity = {
        id: "1",
        name: "Test item",
        amount: 1500,
        status: "active",
        created: "2026-09-20T10:00:00Z",
      };

      expect(descriptor.formatFieldValue("name", entity)).toBe("Test item");
      expect(descriptor.formatFieldValue("amount", entity)).toContain("1,500");
      expect(descriptor.formatFieldValue("created", entity)).toBe("2026-09-20");
    });

    it("renders phone and email fields as accessible interactive links", () => {
      interface CommEntity {
        id: string;
        phone: string;
        email: string;
      }

      const descriptor = createEntityDescriptor<CommEntity>({
        entityType: "comm",
        singularLabel: "Comm",
        pluralLabel: "Comms",
        idField: "id",
        titleField: "phone",
        fields: [
          {
            key: "phone",
            label: "Phone",
            type: "phone",
            ariaLabel: (val) => `Call ${val}`,
          },
          {
            key: "email",
            label: "Email",
            type: "email",
            ariaLabel: "Send message",
          },
        ],
      });

      const entity: CommEntity = {
        id: "comm-1",
        phone: "+923001234567",
        email: "test@example.com",
      };

      const phoneMarkup = renderToStaticMarkup(
        <div>{descriptor.renderFieldValue("phone", entity)}</div>,
      );
      expect(phoneMarkup).toContain('href="tel:+923001234567"');
      expect(phoneMarkup).toContain('aria-label="Call +923001234567"');
      expect(phoneMarkup).toContain("+923001234567");

      const emailMarkup = renderToStaticMarkup(
        <div>{descriptor.renderFieldValue("email", entity)}</div>,
      );
      expect(emailMarkup).toContain('href="mailto:test@example.com"');
      expect(emailMarkup).toContain('aria-label="Send message"');
      expect(emailMarkup).toContain("test@example.com");
    });

    it("handles badge with custom className vs StatusBadge fallback and empty values", () => {
      interface StatusEntity {
        id: string;
        customStatus: string;
        rawStatus: string;
        emptyField?: string | null;
      }

      const descriptor = createEntityDescriptor<StatusEntity>({
        entityType: "status-test",
        singularLabel: "Status Test",
        pluralLabel: "Status Tests",
        idField: "id",
        titleField: "customStatus",
        fields: [
          {
            key: "customStatus",
            label: "Custom",
            type: "badge",
            badgeVariantMap: {
              vip: { label: "VIP Member", className: SEMANTIC_BADGE.success },
            },
          },
          {
            key: "rawStatus",
            label: "Raw",
            type: "status",
          },
          {
            key: "emptyField",
            label: "Empty",
            type: "text",
          },
        ],
      });

      const entity: StatusEntity = {
        id: "st-1",
        customStatus: "vip",
        rawStatus: "active",
        emptyField: null,
      };

      // Custom badge variant with SEMANTIC_BADGE class
      const customMarkup = renderToStaticMarkup(
        <div>{descriptor.renderFieldValue("customStatus", entity)}</div>,
      );
      expect(customMarkup).toContain("VIP Member");
      expect(customMarkup).toContain(SEMANTIC_BADGE.success);

      // Raw status fallback to StatusBadge component
      const rawMarkup = renderToStaticMarkup(
        <div>{descriptor.renderFieldValue("rawStatus", entity)}</div>,
      );
      expect(rawMarkup).toContain("active");

      // Empty field renders em-dash with text-muted-foreground
      const emptyMarkup = renderToStaticMarkup(
        <div>{descriptor.renderFieldValue("emptyField", entity)}</div>,
      );
      expect(emptyMarkup).toContain("text-muted-foreground");
      expect(emptyMarkup).toContain("—");
    });

    it("applies sectionTitleMap and defaultDrawerSectionTitle overrides", () => {
      interface SectionEntity {
        id: string;
        f1: string;
        f2: string;
        f3: string;
      }

      const descriptor = createEntityDescriptor<SectionEntity>({
        entityType: "section-test",
        singularLabel: "Section Test",
        pluralLabel: "Section Tests",
        idField: "id",
        titleField: "f1",
        defaultDrawerSectionTitle: "Primary Overview",
        sectionTitleMap: {
          customSec: "Specialized Information",
        },
        fields: [
          { key: "f1", label: "F1", type: "text", drawerSection: "general" },
          { key: "f2", label: "F2", type: "text", drawerSection: "customSec" },
          { key: "f3", label: "F3", type: "text", drawerSection: "unmappedSec" },
        ],
      });

      const sections = descriptor.getDrawerSections();
      expect(sections).toHaveLength(3);

      const general = sections.find((s) => s.id === "general");
      expect(general?.title).toBe("Primary Overview");

      const custom = sections.find((s) => s.id === "customSec");
      expect(custom?.title).toBe("Specialized Information");

      const unmapped = sections.find((s) => s.id === "unmappedSec");
      expect(unmapped?.title).toBe("UnmappedSec");
    });
  });

  describe("Primary Entity Descriptors Consistency", () => {
    it("contactsEntityDescriptor provides valid metadata slots and semantic badges", () => {
      expect(contactsEntityDescriptor.entityType).toBe("contacts");
      expect(contactsEntityDescriptor.getField("name")?.fixed).toBe(true);
      expect(contactsEntityDescriptor.getField("gender")?.badgeVariantMap?.male?.className).toBe(
        SEMANTIC_BADGE.info,
      );

      const contact = {
        id: "c1",
        name: "Zayd ibn Harithah",
        phone: "+1234567890",
        email: "zayd@example.com",
        gender: "male",
      };

      const markup = renderToStaticMarkup(
        <div>
          {contactsEntityDescriptor.renderFieldValue("gender", contact as unknown as never)}
        </div>,
      );
      expect(markup).toContain("Male");
      expect(markup).toContain(SEMANTIC_BADGE.info);
    });

    it("studentsEntityDescriptor formats enrollment status and links cleanly", () => {
      expect(studentsEntityDescriptor.entityType).toBe("students");
      const student = {
        id: "s1",
        name: "Tariq Ali",
        status: "active",
        grNumber: "GR-102",
        gender: "male",
      };

      expect(
        studentsEntityDescriptor.formatFieldValue("grNumber", student as unknown as never),
      ).toBe("GR-102");
    });

    it("facultyEntityDescriptor maps employee info", () => {
      expect(facultyEntityDescriptor.entityType).toBe("faculty");
      const faculty = {
        id: "f1",
        name: "Ustadha Fatima",
        employeeId: "EMP-042",
        designation: "Teacher",
        status: "active",
      };

      expect(
        facultyEntityDescriptor.formatFieldValue("employeeId", faculty as unknown as never),
      ).toBe("EMP-042");
    });

    it("sessionsEntityDescriptor handles academic sessions and dates", () => {
      expect(sessionsEntityDescriptor.entityType).toBe("sessions");
      const session = {
        id: "sess-1",
        name: "Academic Year 2026-2027",
        startDate: "2026-09-01",
        endDate: "2027-06-30",
        isCurrent: true,
      };

      expect(sessionsEntityDescriptor.formatFieldValue("name", session as unknown as never)).toBe(
        "Academic Year 2026-2027",
      );
    });

    it("financeEntityDescriptor handles invoices and currency amounts", () => {
      expect(financeEntityDescriptor.entityType).toBe("finance");
      const invoice = {
        id: "inv-1",
        invoiceNumber: "INV-2026-001",
        totalAmount: 250,
        status: "paid",
        issueDate: "2026-09-01",
      };

      const formattedAmount = financeEntityDescriptor.formatFieldValue(
        "totalAmount",
        invoice as unknown as never,
      );
      expect(formattedAmount).toContain("250");
    });

    it("platformWorkspacesEntityDescriptor renders active vs disabled badges", () => {
      expect(platformWorkspacesEntityDescriptor.entityType).toBe("platformWorkspaces");
      const wsActive = {
        subdomain: "al-noor",
        madrasaName: "Al-Noor Madrasa",
        enabled: true,
        createdAt: "2026-01-01",
      };
      const wsDisabled = {
        subdomain: "al-huda",
        madrasaName: "Al-Huda Madrasa",
        enabled: false,
        createdAt: "2026-01-01",
      };

      const activeMarkup = renderToStaticMarkup(
        <div>{platformWorkspacesEntityDescriptor.renderFieldValue("enabled", wsActive)}</div>,
      );
      expect(activeMarkup).toContain("Active");
      expect(activeMarkup).toContain(SEMANTIC_BADGE.success);

      const disabledMarkup = renderToStaticMarkup(
        <div>{platformWorkspacesEntityDescriptor.renderFieldValue("enabled", wsDisabled)}</div>,
      );
      expect(disabledMarkup).toContain("Disabled");
      expect(disabledMarkup).toContain(SEMANTIC_BADGE.muted);
    });

    it("handles academic attendance and enrollment descriptors", () => {
      expect(attendanceEntityDescriptor.entityType).toBe("attendance");
      expect(attendanceEntityDescriptor.getField("status")?.badgeVariantMap?.present?.tone).toBe(
        "success",
      );
      const record = {
        id: "att-1",
        classId: "cls-1",
        studentId: "std-1",
        studentName: "Ali Hassan",
        rollNo: "12",
        date: "2026-09-20",
        status: "present" as const,
      };
      expect(
        attendanceEntityDescriptor.formatFieldValue("studentName", record as unknown as never),
      ).toBe("Ali Hassan");
      expect(
        attendanceEntityDescriptor.formatFieldValue("status", record as unknown as never),
      ).toBe("Present");

      expect(enrollmentsEntityDescriptor.entityType).toBe("enrollments");
      const enrollment = {
        id: "enr-1",
        studentId: "std-1",
        studentName: "Fatima Zahra",
        sessionId: "ses-1",
        classId: "cls-1",
        className: "Grade 4",
        enrolledDate: "2026-09-01",
        finalFee: 120,
        status: "enrolled" as const,
        paymentStatus: "paid" as const,
      };
      expect(
        enrollmentsEntityDescriptor.formatFieldValue("className", enrollment as unknown as never),
      ).toBe("Grade 4");
      expect(
        enrollmentsEntityDescriptor.formatFieldValue("status", enrollment as unknown as never),
      ).toBe("Enrolled");
    });

    it("handles hasanat and obligations domain descriptors", () => {
      expect(hasanatEntityDescriptor.entityType).toBe("hasanat");
      const dist = {
        id: "dist-1",
        batchId: "b-1",
        denominationId: "d-1",
        denominationName: "100 Points",
        recipientType: "student" as const,
        recipientName: "Zainab Ali",
        quantity: 2,
        issuedDate: "2026-09-15",
        status: "active" as const,
      };
      expect(
        hasanatEntityDescriptor.formatFieldValue("denominationName", dist as unknown as never),
      ).toBe("100 Points");

      expect(obligationsEntityDescriptor.entityType).toBe("obligations");
      const obl = {
        id: "obl-1",
        receipt_no: "REC-2026-99",
        received_date: "2026-09-10",
        sender_id: "snd-1",
        amount: 500,
        currency_id: "USD",
        payment_mode: "Cash" as const,
        obligation_type_id: "khums",
        mujtahid_representative_id: "rep-1",
        received_by: "Admin",
      };
      expect(obligationsEntityDescriptor.formatFieldValue("receipt_no", obl)).toBe("REC-2026-99");
      expect(obligationsEntityDescriptor.formatFieldValue("payment_mode", obl)).toBe("Cash");
    });

    it("handles platformUsers and platformSettings descriptors", () => {
      expect(platformUsersEntityDescriptor.entityType).toBe("platformUsers");
      const adminUser = {
        id: "u-1",
        email: "super@mms.local",
        name: "Platform Super Admin",
        role: "super_user" as const,
        permissions: {
          workspaces: true,
          onboard: true,
          settings: true,
          admins: true,
          system: true,
        },
        createdAt: "2026-01-01",
        disabledAt: null,
      };
      const adminMarkup = renderToStaticMarkup(
        <div>{platformUsersEntityDescriptor.renderFieldValue("disabledAt", adminUser)}</div>,
      );
      expect(adminMarkup).toContain("Active");

      expect(platformSettingsEntityDescriptor.entityType).toBe("platformSettings");
      expect(platformSettingsEntityDescriptor.getField("certbotEmail")?.type).toBe("email");
    });

    it("getEntityDescriptor resolves registered descriptors by key", () => {
      expect(getEntityDescriptor("contacts")).toBe(contactsEntityDescriptor);
      expect(getEntityDescriptor("students")).toBe(studentsEntityDescriptor);
      expect(getEntityDescriptor("finance")).toBe(financeEntityDescriptor);
      expect(getEntityDescriptor("platformWorkspaces")).toBe(platformWorkspacesEntityDescriptor);
      expect(getEntityDescriptor("attendance")).toBe(attendanceEntityDescriptor);
      expect(getEntityDescriptor("enrollments")).toBe(enrollmentsEntityDescriptor);
      expect(getEntityDescriptor("hasanat")).toBe(hasanatEntityDescriptor);
      expect(getEntityDescriptor("obligations")).toBe(obligationsEntityDescriptor);
      expect(getEntityDescriptor("platformUsers")).toBe(platformUsersEntityDescriptor);
      expect(getEntityDescriptor("platformSettings")).toBe(platformSettingsEntityDescriptor);
      expect(getEntityDescriptor("nonexistent")).toBeUndefined();
    });
  });

  describe("EntityCardMetadata with EntityDescriptor", () => {
    it("renders card metadata tiles automatically from descriptor", () => {
      const student = {
        id: "s1",
        name: "Bilal ibn Rabah",
        status: "active",
        grNumber: "GR-001",
        gender: "male",
      };

      const markup = renderToStaticMarkup(
        <EntityCardMetadata
          descriptor={studentsEntityDescriptor}
          entity={student as unknown as never}
        />,
      );

      expect(markup).toContain("Student Name");
      expect(markup).toContain("Bilal ibn Rabah");
      expect(markup).toContain("GR Number");
      expect(markup).toContain("GR-001");
    });

    it("filters card metadata tiles by visibleColumnIds", () => {
      const student = {
        id: "s1",
        name: "Bilal ibn Rabah",
        status: "active",
        grNumber: "GR-001",
        gender: "male",
      };

      const markup = renderToStaticMarkup(
        <EntityCardMetadata
          descriptor={studentsEntityDescriptor}
          entity={student as unknown as never}
          visibleColumnIds={["grNumber"]}
        />,
      );

      expect(markup).toContain("GR-001");
      expect(markup).not.toContain("Bilal ibn Rabah");
    });

    it("resolves descriptor automatically from entityType prop", () => {
      const contact = {
        id: "c1",
        name: "Ammar ibn Yasir",
        phone: "+1234567890",
        email: "ammar@example.com",
        gender: "male",
      };

      const markup = renderToStaticMarkup(
        <EntityCardMetadata entityType="contacts" entity={contact as unknown as never} />,
      );

      expect(markup).toContain("Full Name");
      expect(markup).toContain("Ammar ibn Yasir");
      expect(markup).toContain("+1234567890");
    });
  });

  describe("EntityDescriptorSections with EntityDescriptor", () => {
    it("renders drawer sections and attribute rows driven by descriptor", async () => {
      const contact = {
        id: "c1",
        name: "Ammar ibn Yasir",
        phone: "+1234567890",
        email: "ammar@example.com",
        gender: "male",
        city: "Najaf",
      };

      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(
          <Drawer open={true} onClose={() => {}} title="Contact Details">
            <EntityDescriptorSections
              descriptor={contactsEntityDescriptor}
              entity={contact as unknown as never}
            />
          </Drawer>,
        );
      });

      const bodyText = document.body.textContent ?? "";
      expect(bodyText).toContain("Contact Details");
      expect(bodyText).toContain("Full Name");
      expect(bodyText).toContain("Ammar ibn Yasir");
      expect(bodyText).toContain("Phone Number");
      expect(bodyText).toContain("+1234567890");
      expect(bodyText).toContain("Email Address");
      expect(bodyText).toContain("ammar@example.com");
      expect(bodyText).toContain("City");
      expect(bodyText).toContain("Najaf");

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });
  });

  describe("useDescriptorFilterChips with EntityDescriptor", () => {
    it("derives chip labels from descriptor field labels", () => {
      const filters = {
        gender: "male",
        status: "active",
      };
      // presentation is FilterChips(chips); synthesis is the hook SSOT
      const chips: Array<{ key: string; label: string }> = [];
      for (const [key, value] of Object.entries(filters)) {
        const field = studentsEntityDescriptor.getField(key);
        expect(field).toBeTruthy();
        chips.push({ key, label: `${field!.label}: ${String(value)}` });
      }
      const markup = renderToStaticMarkup(
        <FilterChips chips={chips.map((chip) => ({ ...chip, onRemove: () => undefined }))} />,
      );
      expect(markup).toContain("Gender");
      expect(markup).toContain("male");
      expect(markup).toContain("Enrollment Status");
      expect(markup).toContain("active");
    });
  });

  describe("AppShell Unified Presentation Shell", () => {
    it("renders semantic landmarks: aside, header, and main with skip link", () => {
      const markup = renderToStaticMarkup(
        <AppShell
          sidebar={<div data-testid="sidebar">Sidebar Nav</div>}
          topBar={<div data-testid="topbar">Top Bar</div>}
          mobileHeader={<div data-testid="mobile-header">Mobile Header</div>}
          footer={<div data-testid="footer">Footer</div>}
        >
          <div data-testid="content">Page Viewport Content</div>
        </AppShell>,
      );

      expect(markup).toContain('href="#main-content"');
      expect(markup).toContain('id="main-content"');
      expect(markup).toContain('role="banner"');
      expect(markup).toContain("Sidebar Nav");
      expect(markup).toContain("Top Bar");
      expect(markup).toContain("Mobile Header");
      expect(markup).toContain("Page Viewport Content");
      expect(markup).toContain("Footer");
    });
  });

  // ─── Phase 4 API additions ───────────────────────────────────────────────

  describe("EntityDescriptor.getRawValue", () => {
    interface SampleEntity {
      id: string;
      score: number;
      tag?: string;
    }

    const descriptor = createEntityDescriptor<SampleEntity>({
      entityType: "sample",
      singularLabel: "Sample",
      pluralLabel: "Samples",
      idField: "id",
      titleField: "id",
      fields: [
        { key: "id", label: "ID", type: "text" },
        { key: "score", label: "Score", type: "number" },
        {
          key: "tag",
          label: "Tag",
          type: "text",
          // Custom accessor that uppercases the tag
          accessor: (e) => (e.tag ? e.tag.toUpperCase() : undefined),
        },
      ],
    });

    it("returns the raw field value directly from the entity", () => {
      const entity: SampleEntity = { id: "abc", score: 42 };
      expect(descriptor.getRawValue("id", entity)).toBe("abc");
      expect(descriptor.getRawValue("score", entity)).toBe(42);
    });

    it("uses the accessor when defined", () => {
      const entity: SampleEntity = { id: "x", score: 1, tag: "hello" };
      expect(descriptor.getRawValue("tag", entity)).toBe("HELLO");
    });

    it("returns undefined for a missing optional field", () => {
      const entity: SampleEntity = { id: "x", score: 0 };
      expect(descriptor.getRawValue("tag", entity)).toBeUndefined();
    });

    it("returns undefined for an unknown field key", () => {
      const entity: SampleEntity = { id: "x", score: 0 };
      expect(descriptor.getRawValue("nonexistent", entity)).toBeUndefined();
    });
  });

  describe("sectionTitleMap — drawer section title overrides", () => {
    interface PersonEntity {
      id: string;
      name: string;
      phone: string;
    }

    it("uses sectionTitleMap titles instead of auto-capitalised section IDs", () => {
      const descriptor = createEntityDescriptor<PersonEntity>({
        entityType: "person",
        singularLabel: "Person",
        pluralLabel: "People",
        idField: "id",
        titleField: "name",
        sectionTitleMap: {
          identity: "Personal Identity",
          contact: "Contact Details",
        },
        fields: [
          { key: "name", label: "Name", type: "text", drawerSection: "identity", drawerOrder: 1 },
          { key: "phone", label: "Phone", type: "phone", drawerSection: "contact", drawerOrder: 2 },
        ],
      });

      const sections = descriptor.getDrawerSections();
      const identitySection = sections.find((s) => s.id === "identity");
      const contactSection = sections.find((s) => s.id === "contact");

      expect(identitySection?.title).toBe("Personal Identity");
      expect(contactSection?.title).toBe("Contact Details");
    });

    it("falls back to auto-capitalisation for section IDs not in sectionTitleMap", () => {
      const descriptor = createEntityDescriptor<PersonEntity>({
        entityType: "person",
        singularLabel: "Person",
        pluralLabel: "People",
        idField: "id",
        titleField: "name",
        sectionTitleMap: { identity: "Personal Identity" },
        fields: [
          { key: "name", label: "Name", type: "text", drawerSection: "identity", drawerOrder: 1 },
          {
            key: "phone",
            label: "Phone",
            type: "phone",
            drawerSection: "employment",
            drawerOrder: 2,
          },
        ],
      });

      const sections = descriptor.getDrawerSections();
      const employmentSection = sections.find((s) => s.id === "employment");
      expect(employmentSection?.title).toBe("Employment");
    });

    it("uses defaultDrawerSectionTitle for the general section", () => {
      const descriptor = createEntityDescriptor<PersonEntity>({
        entityType: "person",
        singularLabel: "Person",
        pluralLabel: "People",
        idField: "id",
        titleField: "name",
        defaultDrawerSectionTitle: "Overview",
        fields: [
          { key: "name", label: "Name", type: "text", drawerSection: "general", drawerOrder: 1 },
          { key: "phone", label: "Phone", type: "phone", drawerSection: "general", drawerOrder: 2 },
        ],
      });

      const sections = descriptor.getDrawerSections();
      expect(sections[0]?.title).toBe("Overview");
    });

    it("sectionTitleMap overrides defaultDrawerSectionTitle for the general section", () => {
      const descriptor = createEntityDescriptor<PersonEntity>({
        entityType: "person",
        singularLabel: "Person",
        pluralLabel: "People",
        idField: "id",
        titleField: "name",
        defaultDrawerSectionTitle: "General Info",
        sectionTitleMap: { general: "Main Details" },
        fields: [
          { key: "name", label: "Name", type: "text", drawerSection: "general", drawerOrder: 1 },
        ],
      });

      const sections = descriptor.getDrawerSections();
      expect(sections[0]?.title).toBe("Main Details");
    });
  });

  // ─── Descriptor-driven component rendering ──────────────────────────────

  describe("FilterChips + useDescriptorFilterChips — descriptor-driven chips", () => {
    function renderChips(hookFn: () => ReturnType<typeof useDescriptorFilterChips>): {
      chips: ReturnType<typeof useDescriptorFilterChips>;
      cleanup: () => void;
    } {
      let chips!: ReturnType<typeof useDescriptorFilterChips>;
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      function Wrapper() {
        chips = hookFn();
        return null;
      }
      act(() => {
        root.render(<Wrapper />);
      });
      return {
        chips,
        cleanup: () => {
          act(() => root.unmount());
          container.remove();
        },
      };
    }

    it("generates chips from active filters using entity descriptor field labels", () => {
      const { chips, cleanup } = renderChips(() =>
        useDescriptorFilterChips(contactsEntityDescriptor, { gender: "male" }, () => undefined),
      );
      const markup = renderToStaticMarkup(<FilterChips chips={chips} />);
      expect(markup).toContain("Gender: Male");
      cleanup();
    });

    it("skips null, undefined, and empty filter values", () => {
      const { chips, cleanup } = renderChips(() =>
        useDescriptorFilterChips(
          contactsEntityDescriptor,
          { gender: null, city: "", phone: undefined },
          () => undefined,
        ),
      );
      expect(chips).toHaveLength(0);
      cleanup();
    });

    it("ignores filter keys that are not filterable descriptor fields", () => {
      const { chips, cleanup } = renderChips(() =>
        useDescriptorFilterChips(
          contactsEntityDescriptor,
          { unknownField: "someValue", city: "Karachi" },
          () => undefined,
        ),
      );
      expect(chips).toHaveLength(0);
      cleanup();
    });

    it("renders caller-merged manual chips alongside descriptor chips", () => {
      const { chips, cleanup } = renderChips(() =>
        useDescriptorFilterChips(contactsEntityDescriptor, { gender: "female" }, () => undefined),
      );
      const markup = renderToStaticMarkup(
        <FilterChips
          chips={[{ key: "manual", label: "Manual Chip", onRemove: () => undefined }, ...chips]}
        />,
      );
      expect(markup).toContain("Manual Chip");
      expect(markup).toContain("Gender: Female");
      cleanup();
    });
  });

  describe("EntityCardMetadata — descriptor-driven tile rendering", () => {
    it("renders metadata tiles from entity + entityType without explicit columns prop", () => {
      const contact = {
        id: "c1",
        name: "Ahmed Ali",
        phone: "+923001234567",
        email: "ahmed@example.com",
        gender: "male",
        city: "Lahore",
        whatsappStatus: "active",
        cnic: "12345-1234567-1",
      };

      const markup = renderToStaticMarkup(
        <EntityCardMetadata entityType="contacts" entity={contact} />,
      );

      // Should render tiles for visible card fields (not cardSlot="hidden")
      expect(markup).toContain("+923001234567");
      expect(markup).toContain("ahmed@example.com");
      expect(markup).toContain("Lahore");
    });

    it("renders nothing when entity is undefined", () => {
      const markup = renderToStaticMarkup(
        <EntityCardMetadata entityType="contacts" entity={undefined} />,
      );
      // Should not throw — empty or minimal output
      expect(markup).toBeDefined();
    });
  });

  describe("examinationsEntityDescriptor", () => {
    it("renders examination attributes, badges, and drawer sections", () => {
      const exam = {
        id: "exam-1",
        name: "Midterm Examination 2026",
        subject: "Islamic Jurisprudence",
        totalMarks: 100,
        passingMarks: 50,
        date: "2026-10-15",
        duration: 90,
        classIds: [],
        status: "scheduled" as const,
        description: "Comprehensive midterm examination",
      };

      expect(examinationsEntityDescriptor.entityType).toBe("examinations");
      expect(examinationsEntityDescriptor.titleField).toBe("name");
      expect(examinationsEntityDescriptor.formatFieldValue("name", exam)).toBe(
        "Midterm Examination 2026",
      );
      expect(examinationsEntityDescriptor.formatFieldValue("subject", exam)).toBe(
        "Islamic Jurisprudence",
      );
      expect(examinationsEntityDescriptor.formatFieldValue("totalMarks", exam)).toBe("100");

      const badgeNode = examinationsEntityDescriptor.renderFieldValue("status", exam);
      const badgeMarkup = renderToStaticMarkup(<div>{badgeNode}</div>);
      expect(badgeMarkup).toContain("Scheduled");

      const sections = examinationsEntityDescriptor.getDrawerSections();
      expect(sections.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("messagingEntityDescriptor", () => {
    it("renders message attributes, channel badges, and status variants", () => {
      const message = {
        id: "msg-101",
        userId: "user-1",
        contactId: "contact-1",
        channel: "whatsapp" as const,
        body: "Assalamu Alaikum, fee reminder for October.",
        sentAt: "2026-10-01T10:00:00Z",
        status: "delivered" as const,
        category: "financial" as const,
      };

      expect(messagingEntityDescriptor.entityType).toBe("messaging");
      expect(messagingEntityDescriptor.titleField).toBe("body");
      expect(messagingEntityDescriptor.formatFieldValue("body", message)).toBe(
        "Assalamu Alaikum, fee reminder for October.",
      );

      const channelNode = messagingEntityDescriptor.renderFieldValue("channel", message);
      const channelMarkup = renderToStaticMarkup(<div>{channelNode}</div>);
      expect(channelMarkup).toContain("WhatsApp");

      const statusNode = messagingEntityDescriptor.renderFieldValue("status", message);
      const statusMarkup = renderToStaticMarkup(<div>{statusNode}</div>);
      expect(statusMarkup).toContain("Delivered");

      const sections = messagingEntityDescriptor.getDrawerSections();
      expect(sections.length).toBeGreaterThanOrEqual(2);
    });
  });
});
