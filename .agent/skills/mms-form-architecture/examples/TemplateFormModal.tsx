import { FormModal, type FormModalProps } from '@/components/app/FormModal';

/** Shell-only example: callers own the real shared DTO, validation and draft.
 * See the skill's draft lifecycle checklist before wiring onSave/onClose.
 * Tab changes do not persist an unfinished create draft in this example.
 */
export function TemplateFormModal(props: FormModalProps) {
  return <FormModal {...props} saveOnTabChange={false} />;
}
