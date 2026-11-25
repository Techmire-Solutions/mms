import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { Contact, ValidationError } from "@mms/contracts";
import { buildInitialContactDraft, contactDraftSnapshot } from "./contactFormDraftUtils.js";
import type { useContactFormDraftOptions } from "./useContactFormDraftOptions.js";

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
  const buildDraft = () =>
    buildInitialContactDraft({
      contact,
      initialDraft,
      defaultCity,
      defaultProvince,
      defaultCountry,
      optionDefaults,
      socialPlatforms,
      relationshipOptions,
    });

  // Latest builder closure, refreshed after every commit. The reset effects below
  // depend only on their true triggers (modal open / contact identity / lookups
  // settle); the ref keeps them reading current option values without re-firing on
  // every parent render — which would clobber in-progress edits.
  const buildDraftRef = useRef(buildDraft);
  useEffect(() => {
    buildDraftRef.current = buildDraft;
  });

  // Reset only when the modal opens or the contact identity changes. `contact` is
  // intentionally not a dep: its object identity changes on every server sync and
  // a reset then would lose in-progress edits.
  useEffect(() => {
    if (!open) return;
    const nextDraft = buildDraftRef.current();
    setContactDraft(nextDraft);
    setBaselineSnapshot(contactDraftSnapshot(nextDraft));
    setValidationErrors([]);
  }, [open, contact?.id, setContactDraft, setBaselineSnapshot, setValidationErrors]);

  // If the form opened before lookups resolved, the draft was built with empty
  // option defaults. Rebuild it once lookups finish loading — but only if the
  // user hasn't started editing, so we never clobber in-progress changes.
  const prevLookupsLoading = useRef(lookupsLoading);
  useEffect(() => {
    if (!open) return;
    const justFinishedLoading = prevLookupsLoading.current && !lookupsLoading;
    prevLookupsLoading.current = lookupsLoading;
    if (!justFinishedLoading || isDirty) return;
    const nextDraft = buildDraftRef.current();
    setContactDraft(nextDraft);
    setBaselineSnapshot(contactDraftSnapshot(nextDraft));
    setValidationErrors([]);
  }, [open, lookupsLoading, isDirty, setContactDraft, setBaselineSnapshot, setValidationErrors]);
}
