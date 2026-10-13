import type React from "react";
import type { UserStatus } from "@mms/shared";

export type AddUserFormValue = string | number | boolean | null | undefined;

export interface AddUserFormState {
  [fieldId: string]: AddUserFormValue;
  contactId: string | number | null;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: UserStatus;
  temporaryRole: boolean;
  roleExpiry: string;
  setupMethod: "invite" | "password";
  password?: string;
  forceReset: boolean;
  twoFactorEnabled: boolean;
}

export type AddUserFormErrors = Record<string, string>;

export type AddUserFormDispatch = React.Dispatch<React.SetStateAction<AddUserFormState>>;

export interface AddUserStepProps {
  form: AddUserFormState;
  setForm: AddUserFormDispatch;
  errors: AddUserFormErrors;
}
