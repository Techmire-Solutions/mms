import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { Contact, ValidationError } from "@mms/shared";
import {
  buildInitialContactDraft,
  contactDraftSnapshot,
} from "@/tenant/features/contacts/hooks/contactFormDraftUtils";
import type { useContactFormDraftOptions } from "@/tenant/features/contacts/hooks/useContactFormDraftOptions";

export interface UseContactDraftResetParams {
  open: boolean;
  contact?: Contact;
  initialDraft?: Partial<Contact>;
  defaultCity: string;
  defaultProvince: string;
  defaultCountry: string;
  optionDefaults: ReturnType<typeof useContactFormDraftOptions>["optionDefaults"];
  socialPlatforms: string[];
  relationshipOptions: string[];
  lookupsLoading: boolean;
  isDirty: boolean;
  setContactDraft: Dispatch<SetStateAction<Partial<Contact>>>;
  setBaselineSnapshot: Dispatch<SetStateAction<string>>;
  setValidationErrors: (next: ValidationError[]) => void;
}

export function useContactDraftReset({
  open,
  contact,
  initialDraft,
  defaultCity,
  defaultProvince,
  defaultCountry,
  optionDefaults,
  socialPlatforms,
  relationshipOptions,
  lookupsLoading,
  isDirty,
  setContactDraft,
  setBaselineSnapshot,
  setValidationErrors,
}: UseContactDraftResetParams): void {
  useEffect(() => {
    if (!open) return;
    const nextDraft = buildInitialContactDraft({
      contact,
      initialDraft,
      defaultCity,
      defaultProvince,
      defaultCountry,
      optionDefaults,
      socialPlatforms,
      relationshipOptions,
    });
    setContactDraft(nextDraft);
    setBaselineSnapshot(contactDraftSnapshot(nextDraft));
    setValidationErrors([]);
    // Intentional dep-array: only reset when the modal opens or the contact identity changes.
    // Including `contact` object would re-fire on every server sync and lose in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contact?.id]);

  // If the form opened before lookups resolved, the draft was built with empty
  // option defaults. Rebuild it once lookups finish loading — but only if the
  // user hasn't started editing, so we never clobber in-progress changes.
  const prevLookupsLoading = useRef(lookupsLoading);
  useEffect(() => {
    if (!open) return;
    const justFinishedLoading = prevLookupsLoading.current && !lookupsLoading;
    prevLookupsLoading.current = lookupsLoading;
    if (!justFinishedLoading) return;
    if (isDirty) return;
    const nextDraft = buildInitialContactDraft({
      contact,
      initialDraft,
      defaultCity,
      defaultProvince,
      defaultCountry,
      optionDefaults,
      socialPlatforms,
      relationshipOptions,
    });
    setContactDraft(nextDraft);
    setBaselineSnapshot(contactDraftSnapshot(nextDraft));
    setValidationErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lookupsLoading]);
}
