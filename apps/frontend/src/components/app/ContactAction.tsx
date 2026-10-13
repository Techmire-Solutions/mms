import React from "react";
import {
  ContactEmailAction,
  type ContactEmailActionProps,
} from "../contact-action/ContactEmailAction";
import {
  ContactLinkAction,
  type ContactLinkActionProps,
} from "../contact-action/ContactLinkAction";
import {
  ContactLocationAction,
  type ContactLocationActionProps,
} from "../contact-action/ContactLocationAction";
import {
  ContactPhoneAction,
  type ContactPhoneActionProps,
} from "../contact-action/ContactPhoneAction";

export type { ContactActionVariant } from "../contact-action/contactActionShared";
export {
  ContactPhoneAction,
  type ContactPhoneActionProps,
} from "../contact-action/ContactPhoneAction";
export {
  ContactEmailAction,
  type ContactEmailActionProps,
} from "../contact-action/ContactEmailAction";
export {
  ContactLocationAction,
  type ContactLocationActionProps,
} from "../contact-action/ContactLocationAction";
export {
  ContactLinkAction,
  type ContactLinkActionProps,
} from "../contact-action/ContactLinkAction";

export type ContactActionProps =
  | ({ type: "phone" } & ContactPhoneActionProps)
  | ({ type: "email" } & ContactEmailActionProps)
  | ({ type: "location" } & ContactLocationActionProps)
  | ({ type: "link" } & ContactLinkActionProps);

/**
 * Unified contact action component for Phone, Email, Location, and Link channels with Call, SMS, WhatsApp, Mail, Maps, ExternalLink, and Copy actions.
 */
export const ContactAction = function ContactAction(
  props: ContactActionProps,
): React.JSX.Element | null {
  if (props.type === "phone") {
    const { type: _, ...rest } = props;
    return <ContactPhoneAction {...rest} />;
  }
  if (props.type === "email") {
    const { type: _, ...rest } = props;
    return <ContactEmailAction {...rest} />;
  }
  if (props.type === "location") {
    const { type: _, ...rest } = props;
    return <ContactLocationAction {...rest} />;
  }
  const { type: _, ...rest } = props;
  return <ContactLinkAction {...rest} />;
};
