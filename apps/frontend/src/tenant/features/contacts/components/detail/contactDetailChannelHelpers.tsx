import {
  ensureSinglePrimaryFlag,
  type Contact,
  type EmailAddress,
  type PhoneNumber,
} from "@mms/shared";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

const DETAIL_COLLECTION_EMPTY_CLASS: Record<"plain" | "bordered" | "borderedRelaxed", string> = {
  plain: "items-start px-3 py-3 text-start",
  bordered: "items-start rounded-xl border border-border/60 bg-muted/20 px-3 py-3 text-start",
  borderedRelaxed: "items-start rounded-xl border border-border bg-muted/20 px-4 py-6 text-start",
};

/** Dense empty hint inside detail collection sections (EmptyState SSOT). */
export function DetailCollectionEmpty({
  title,
  variant = "plain",
  className,
}: {
  title: string;
  variant?: keyof typeof DETAIL_COLLECTION_EMPTY_CLASS;
  className?: string;
}): React.JSX.Element {
  return (
    <EmptyState
      title={title}
      compact
      icon={null}
      className={cn(DETAIL_COLLECTION_EMPTY_CLASS[variant], className)}
    />
  );
}

export function withPrimaryPhone(contact: Contact, phone: PhoneNumber): Contact {
  const others = (contact.phones ?? []).filter(
    (entry) => !(entry.number === phone.number && entry.countryCode === phone.countryCode),
  );
  return {
    ...contact,
    phones: ensureSinglePrimaryFlag([{ ...phone, isPrimary: true }, ...others]),
  };
}

export function withPrimaryEmail(contact: Contact, email: EmailAddress): Contact {
  const address = String(email.address || "").trim();
  const others = (contact.emails ?? []).filter(
    (entry) =>
      String(entry.address || "")
        .trim()
        .toLowerCase() !== address.toLowerCase(),
  );
  return {
    ...contact,
    email: address,
    emails: ensureSinglePrimaryFlag([{ ...email, address, isPrimary: true }, ...others]),
  };
}
