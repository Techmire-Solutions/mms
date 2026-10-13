import { useState } from "react";
import { motion } from "framer-motion";
import { Phone, Mail, X } from "lucide-react";
import {
  getDisplayName,
  getPrimaryEmail,
  getPrimaryPhone,
  USER_STATUS_VALUES,
  type Contact,
  type UserStatus,
} from "@mms/shared";
import ContactPicker from "@/components/contactLink/ContactPicker";
import { FormSelect } from "@/components/app/FormSelect";
import { UserAvatar } from "@/components/app/UserAvatar";
import { PersonIdentityMeta } from "@/components/app/PersonIdentityMeta";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldErrorMessage } from "@/components/app/FormPrimitives";
import type { AddUserStepProps } from "../lib/addUserModalTypes";

export function Step1({ form, setForm, errors }: AddUserStepProps): JSX.Element {
  const { t } = useTranslation();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const handleContactChange = (
    contactId: string | number | null,
    contact?: Contact | null,
  ): void => {
    if (!contactId || !contact) {
      setSelectedContact(null);
      setForm((previousForm) => ({
        ...previousForm,
        contactId: null,
        name: "",
        email: "",
        phone: "",
      }));
      return;
    }
    setSelectedContact(contact);
    const primaryEmail = getPrimaryEmail(contact) || "";
    const primaryPhone = getPrimaryPhone(contact) || "";
    setForm((previousForm) => ({
      ...previousForm,
      contactId: contact.id,
      name: getDisplayName(contact),
      email: primaryEmail,
      phone: primaryPhone,
    }));
  };

  const statusOptions = (() =>
    USER_STATUS_VALUES.map((status) => ({
      value: status,
      label: t(`users.status.${status}`),
    })))();

  return (
    <div className="space-y-4">
      <div>
        <ContactPicker
          label={t("users.addSearchContact")}
          value={form.contactId}
          onChange={handleContactChange}
          searchPlaceholder={t("users.addSearchPlaceholder")}
          emptyTitle={t("users.addNoContacts")}
        />
        <FieldErrorMessage message={errors.contactId} />
      </div>

      {form.contactId && form.name ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2.5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <UserAvatar
                id={form.contactId}
                name={form.name}
                avatar={selectedContact?.avatar}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{form.name}</p>
                {selectedContact ? (
                  <PersonIdentityMeta
                    gender={selectedContact.gender}
                    isSyed={selectedContact.isSyed}
                    syedLabel={t("contacts.fields.isSyed")}
                    size="sm"
                    className="mt-0.5"
                  />
                ) : null}
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleContactChange(null, null)}
              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
              aria-label={t("common.clearSearch")}
              title={t("common.clearSearch")}
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="space-y-1.5 pt-1 border-t border-primary/15 text-xs text-muted-foreground">
            {form.email ? (
              <p className="flex items-center gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                <span>{form.email}</span>
              </p>
            ) : (
              <Field id="add-user-email" label={t("auth.emailAddress")} error={errors.email}>
                <Input
                  id="add-user-email"
                  name="email"
                  type="email"
                  placeholder={t("auth.emailAddress")}
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="h-8 text-xs bg-background"
                />
                <p className="text-3xs text-muted-foreground">{t("users.addErrorContactEmail")}</p>
              </Field>
            )}

            {form.phone ? (
              <p className="flex items-center gap-1.5 truncate">
                <Phone className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                <span>{form.phone}</span>
              </p>
            ) : null}
          </div>
        </motion.div>
      ) : null}

      <Field id="add-user-status" label={t("users.fieldStatus")}>
        <FormSelect
          id="add-user-status"
          name="status"
          value={form.status}
          onChange={(val) =>
            setForm((previousForm) => ({ ...previousForm, status: val as UserStatus }))
          }
          options={statusOptions}
        />
      </Field>
    </div>
  );
}
