import React from "react";
import {
  PersonIdentityMeta,
  type PersonIdentityMetaProps,
} from "@/components/app/PersonIdentityMeta";

export type ContactIdentityMetaProps = Omit<PersonIdentityMetaProps, "syedLabel">;

/**
 * Shared gender + Syed meta row for contact table, cards, and detail header.
 * Thin Contacts wrapper over PersonIdentityMeta.
 */
export const ContactIdentityMeta = function ContactIdentityMeta({
  gender,
  isSyed,
  className,
  size = "sm",
  pill = false,
  extraBadges,
  children,
  onGenderClick,
  onSyedClick,
}: ContactIdentityMetaProps): React.JSX.Element | null {
  return (
    <PersonIdentityMeta
      gender={gender}
      isSyed={isSyed}
      className={className}
      size={size}
      pill={pill}
      extraBadges={extraBadges}
      onGenderClick={onGenderClick}
      onSyedClick={onSyedClick}
    >
      {children}
    </PersonIdentityMeta>
  );
};
