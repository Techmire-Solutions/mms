import { ExternalLink } from "lucide-react";
import { formatSocialPlatformUrl, type Contact } from "@mms/contracts";
import { useTranslation } from "@/hooks/useTranslation";
import { resolveSocialPlatformLabel } from "@/lib/contacts/contactI18n";
import { ContactDetailExternalLinkSection } from "./ContactDetailExternalLinkSection";

export interface ContactDetailSocialsSectionProps {
  contact: Contact;
  socialPlatforms: string[];
}

export function ContactDetailSocialsSection({
  contact,
  socialPlatforms,
}: ContactDetailSocialsSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const socials = contact.socials ?? [];

  return (
    <ContactDetailExternalLinkSection
      title={t("contacts.detail.socials")}
      emptyMessage={t("contacts.detail.emptySocials")}
      emptyDash={t("contacts.table.emptyDash")}
      actionIcon={ExternalLink}
      actionTitle={t("contacts.detail.visitSocialProfile")}
      rows={socials.map((social, socialIndex) => {
        const handle = String(social.url || "");
        const url = handle ? formatSocialPlatformUrl(social.platform, handle) : "";
        return {
          key: `social-${socialIndex}`,
          label: resolveSocialPlatformLabel(social.platform, socialPlatforms, t),
          value: handle,
          href: url || undefined,
        };
      })}
    />
  );
}
