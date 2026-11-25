import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ContactsPage from "./ContactsPage.js";

vi.mock("./hooks/useContactsPageController.js", () => ({
  useContactsPageController: () => ({
    activeTab: "work",
    workProps: {},
    reportsProps: {},
    setupProps: {},
    overlayProps: {},
  }),
}));

vi.mock("./components/ContactsPageView.js", () => ({
  ContactsPageView: () => <div data-testid="contacts-page-view">Contacts Page View</div>,
}));

describe("ContactsPage Component", () => {
  it("renders ContactsPageView using controller hook", () => {
    const html = renderToStaticMarkup(<ContactsPage />);
    expect(html).toContain("Contacts Page View");
  });
});
