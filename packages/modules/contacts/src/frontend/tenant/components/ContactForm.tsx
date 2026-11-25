import type React from "react";
import { useCallback, useEffect, useRef, useState, useMemo, useId } from "react";
import { User } from "lucide-react";
import { FormModal } from "@mms/fe-core/components/FormModal";
import { useTranslation } from "@mms/fe-core/i18n";
import type { Contact } from "@mms/contracts";
import { getScopedBrandingSettings } from "@mms/fe-core/lib/settingsPreviewStore";
import { useContactFormDraft } from "../hooks/useContactFormDraft";
import { useContactConfig } from "@mms/mod-contacts/frontend/tenant/components/ContactConfigContext";
import { ContactFormTabContent } from "./ContactFormTabContent.js";
import { ContactFormFooterStart } from "./ContactFormFooterStart.js";
import {
  computeContactTabErrorCounts,
  buildContactFormVisibleTabs,
  buildContactValidationErrorItems,
} from "../lib/contactFormTabUtils";
import { focusContactField } from "@mms/mod-contacts/frontend/tenant/lib/contactFormFocus";

export interface ContactFormProps {
  open?: boolean;
  contact?: Contact;
  onClose: () => void;
  onSave: (contact: Contact) => void | Promise<void>;
  defaultCountry?: string;
  defaultCity?: string;
  defaultProvince?: string;
  initialDraft?: Partial<Contact>;
  lockGender?: boolean;
  /** Raise above other modals (e.g. create from ContactPicker inside a form). */
  nested?: boolean;
  priority?: boolean;
}

export function ContactForm({
  open = true,
  contact,
  onClose,
  onSave,
  defaultCountry = "",
  defaultCity = "",
  defaultProvince = "",
  initialDraft,
  lockGender = false,
  nested = false,
  priority = false,
}: ContactFormProps): React.JSX.Element {
  const { t, dir } = useTranslation();
  const formDomId = `contact-form-${useId().replace(/:/g, "")}`;
  const { enabledTabIds, isTabFieldEnabled, formTabs } = useContactConfig();
  const firstNameRequired = isTabFieldEnabled("basic", "firstName");
  const [tab, setTab] = useState("basic");
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setTab("basic");
    }
  }

  const branding = getScopedBrandingSettings();
  const effectiveCountry = defaultCountry || branding.country || "";
  const effectiveCity = defaultCity || branding.city || "";
  const effectiveProvince = defaultProvince || branding.region || "";

  /** Set from the draft hook below; the focus callback is created before it. */
  const formInstanceIdRef = useRef<string>("new");
  const handleValidationTab = useCallback((tabId: string, fieldId?: string, index?: number) => {
    setTab(tabId);
    // The tab body mounts in this commit; the helper waits two frames plus a
    // retry before focusing, so the control exists by then.
    focusContactField({
      formInstanceId: formInstanceIdRef.current,
      tabId,
      fieldId,
      index,
    });
  }, []);

  const draft = useContactFormDraft({
    open,
    contact,
    initialDraft,
    defaultCountry: effectiveCountry,
    defaultCity: effectiveCity,
    defaultProvince: effectiveProvince,
    onSave,
    onClose,
    onValidationTab: handleValidationTab,
  });

  useEffect(() => {
    formInstanceIdRef.current = draft.formInstanceId;
  }, [draft.formInstanceId]);

  const tabErrorCounts = useMemo(
    () => computeContactTabErrorCounts(draft.validationErrors),
    [draft.validationErrors],
  );

  const visibleTabs = useMemo(
    () =>
      buildContactFormVisibleTabs({
        enabledTabIds,
        collectionCounts: draft.collectionCounts,
        tabErrorCounts,
        formTabs,
        t,
      }),
    [draft.collectionCounts, tabErrorCounts, enabledTabIds, formTabs, t],
  );

  const activeTab = visibleTabs.some((tabItem) => tabItem.key === tab)
    ? tab
    : (visibleTabs[0]?.key ?? "basic");

  const validationErrorItems = useMemo(
    () => buildContactValidationErrorItems(Boolean(draft.lookupsError), draft.validationErrors, t),
    [draft.lookupsError, draft.validationErrors, t],
  );
  const validationErrorSummary = useMemo(
    () => validationErrorItems?.map((item) => item.message),
    [validationErrorItems],
  );

  const saveDisabled =
    draft.lookupsLoading ||
    (firstNameRequired && !draft.contactDraft.firstName?.trim()) ||
    (Boolean(contact) && !draft.isDirty);

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={contact ? t("contacts.form.editTitle") : t("contacts.form.addTitle")}
      subtitle={
        contact
          ? t("contacts.form.editing", { name: contact.name || "" })
          : t("contacts.form.createNewContact")
      }
      icon={User}
      size="xl"
      tall
      priority={Boolean(priority || nested)}
      saveOnTabChange={false}
      error={validationErrorSummary ?? draft.formError ?? undefined}
      onSelectError={
        draft.lookupsError
          ? undefined
          : (index) => {
              const item = validationErrorItems?.[index];
              if (!item?.tabId) return;
              handleValidationTab(item.tabId, item.fieldId, item.index);
            }
      }
      tabs={visibleTabs}
      activeTab={activeTab}
      onTabChange={setTab}
      tabPanelIdPrefix={`${formDomId}-tab`}
      dir={dir}
      cancelLabel={t("common.cancel")}
      saveLabel={t("contacts.form.saveContact")}
      onSave={draft.handleSave}
      isDirty={draft.isDirty}
      saving={draft.saving}
      saveDisabled={saveDisabled}
      discardUnsavedTitle={t("contacts.form.discardUnsavedTitle")}
      discardUnsavedDescription={t("contacts.form.discardUnsavedDescription")}
      discardConfirmLabel={t("contacts.form.discardChanges")}
      discardCancelLabel={t("contacts.form.keepEditing")}
      footerStart={
        <ContactFormFooterStart
          contactDraft={draft.contactDraft}
          collectionCounts={draft.collectionCounts}
          noChanges={Boolean(contact) && !draft.isDirty}
          requireFirstName={firstNameRequired}
          t={t}
        />
      }
      formId={formDomId}
    >
      <form
        id={formDomId}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          // Enter mirrors the FormModal save button: same gate, same guarded handler.
          if (!saveDisabled) void draft.handleSave();
        }}
      >
        <ContactFormTabContent
          tab={tab}
          draft={draft}
          lockGender={lockGender}
          defaultCountry={effectiveCountry}
          defaultCity={effectiveCity}
          defaultProvince={effectiveProvince}
        />
      </form>
    </FormModal>
  );
}

export default ContactForm;
