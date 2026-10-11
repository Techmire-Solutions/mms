import { describe, expect, it } from "vitest";
import { contactsWidgetToWorkDrillDown } from "./contactsWidgetWorkDrillDown";

describe("contactsWidgetToWorkDrillDown", () => {
  it("returns null for non-contacts collections", () => {
    expect(contactsWidgetToWorkDrillDown({ collection: "students" })).toBeNull();
  });

  it("maps gender filter to Work gender", () => {
    expect(
      contactsWidgetToWorkDrillDown({
        collection: "contacts",
        filterField: "gender",
        filterValue: "male",
      }),
    ).toEqual({ gender: "male" });
  });

  it("maps whatsappStatus to quickFilter whatsapp", () => {
    expect(
      contactsWidgetToWorkDrillDown({
        collection: "contacts",
        filterField: "whatsappStatus",
        filterValue: "REGISTERED",
      }),
    ).toEqual({ quickFilter: "whatsapp" });
  });

  it("returns empty drill-down for unfiltered contacts widgets", () => {
    expect(contactsWidgetToWorkDrillDown({ collection: "contacts" })).toEqual({});
  });
});
