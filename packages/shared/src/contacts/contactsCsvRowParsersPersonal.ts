import type {
  Address,
  EmailAddress,
  PhoneNumber,
  SocialLink,
  WhatsAppStatus,
} from "./contactEntityTypes.js";
import { parseBool, splitList, type ParseContactsRowContext } from "./contactsCsvRowParserTypes.js";

export function buildPhones(ctx: ParseContactsRowContext): PhoneNumber[] {
  const nums = splitList(ctx.getVal("phone_number"));
  const labels = splitList(ctx.getVal("phone_label"));
  const countryCodes = splitList(ctx.getVal("phone_countryCode"));
  const isPrimaries = splitList(ctx.getVal("phone_isPrimary"));
  const whatsappStatuses = splitList(ctx.getVal("phone_whatsappStatus"));

  return nums.map((num, idx) => ({
    label: labels[idx] || labels[0] || ctx.defaultPhoneLabel || "Mobile",
    number: num,
    isPrimary: isPrimaries[idx] ? parseBool(isPrimaries[idx]) : idx === 0,
    ...(countryCodes[idx] ? { countryCode: countryCodes[idx] } : {}),
    ...(whatsappStatuses[idx] ? { whatsappStatus: whatsappStatuses[idx] as WhatsAppStatus } : {}),
  }));
}

export function buildEmails(ctx: ParseContactsRowContext): EmailAddress[] {
  const addrs = splitList(ctx.getVal("email_address"));
  const labels = splitList(ctx.getVal("email_label"));
  const isPrimaries = splitList(ctx.getVal("email_isPrimary"));
  const isVerifieds = splitList(ctx.getVal("email_isVerified"));

  return addrs.map((addr, idx) => ({
    label: labels[idx] || labels[0] || ctx.defaultEmailLabel || "Personal",
    address: addr,
    isPrimary: isPrimaries[idx] ? parseBool(isPrimaries[idx]) : idx === 0,
    ...(isVerifieds[idx] ? { isVerified: parseBool(isVerifieds[idx]) } : {}),
  }));
}

export function buildAddresses(ctx: ParseContactsRowContext): Address[] {
  const line1s = splitList(ctx.getVal("line1"));
  const cities = splitList(ctx.getVal("city"));
  const states = splitList(ctx.getVal("state"));
  const countries = splitList(ctx.getVal("country"));
  const labels = splitList(ctx.getVal("address_label"));
  const isPrimaries = splitList(ctx.getVal("address_isPrimary"));
  const count = Math.max(line1s.length, cities.length, states.length, countries.length);

  return Array.from({ length: count }, (_, i) => ({
    label: labels[i] || labels[0] || ctx.defaultAddressLabel || "Home",
    line1: line1s[i] || "",
    city: cities[i] || "",
    state: states[i] || "",
    country: countries[i] || "",
    isPrimary: isPrimaries[i] ? parseBool(isPrimaries[i]) : i === 0,
  }));
}

export function buildSocials(ctx: ParseContactsRowContext): SocialLink[] {
  const platforms = splitList(ctx.getVal("socials_platform"));
  const urls = splitList(ctx.getVal("socials_url"));
  return Array.from({ length: Math.max(platforms.length, urls.length) }, (_, i) => ({
    platform: platforms[i] || "Other",
    url: urls[i] || "",
  })).filter((s) => s.url.length > 0 || s.platform !== "Other");
}
