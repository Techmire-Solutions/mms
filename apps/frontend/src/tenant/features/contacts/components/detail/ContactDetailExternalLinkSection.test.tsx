import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MapPin } from "lucide-react";
import { ContactDetailExternalLinkSection } from "./ContactDetailExternalLinkSection";

describe("ContactDetailExternalLinkSection Component", () => {
  it("renders external link section rows with map/link actions", () => {
    const html = renderToStaticMarkup(
      <ContactDetailExternalLinkSection
        title="Addresses"
        emptyMessage="No addresses"
        emptyDash="-"
        actionIcon={MapPin}
        actionTitle="Open in Google Maps"
        rows={[
          {
            key: "addr-1",
            label: "Home",
            value: "123 Main St",
            href: "https://maps.google.com/?q=123+Main+St",
          },
        ]}
      />,
    );

    expect(html).toContain("Addresses");
    expect(html).toContain("Home");
    expect(html).toContain("123 Main St");
  });
});
