import type { Contact } from "@mms/shared";
import { SEED_10_CONTACTS_PART1 } from "./seed-20-contacts-part1.js";
import { SEED_10_CONTACTS_PART2 } from "./seed-20-contacts-part2.js";

export const SEED_20_DUMMY_CONTACTS: Omit<Contact, "id">[] = [
  ...SEED_10_CONTACTS_PART1,
  ...SEED_10_CONTACTS_PART2,
];
