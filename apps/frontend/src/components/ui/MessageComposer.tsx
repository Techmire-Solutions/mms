import { FormModal } from '@/components/ui/FormModal';
import { WarningCallout } from '@/components/ui/WarningCallout';
import { useTranslation } from '@/hooks/useTranslation';
import type {
  MessageTemplate,
  StandardMessagingRecipient as MessagingRecipient,
} from '@mms/shared';
import { MessageComposerDispatchControls } from './messageComposer/MessageComposerDispatchControls';
import { MessageComposerFormBody } from './messageComposer/MessageComposerFormBody';
import { MessageComposerRecipients, type RecipientPickerSlotProps } from './messageComposer/MessageComposerRecipients';
import { useMessageComposerModel } from './messageComposer/useMessageComposerModel';

export type { RecipientPickerSlotProps };

const COMPOSER_FORM_ID = 'message-composer-form';

export interface MessageComposerProps {
  channel: 'sms' | 'whatsapp' | 'email';
  recipients: MessagingRecipient[];
  onClose: () => void;
  templates?: MessageTemplate[];
  initialMessage?: string;
  initialSubject?: string;
  onSent?: (sent: { recipientId: string | number; body: string }[]) => void;
  madrasaName?: string;
  user?: unknown;
  renderRecipientPicker?: (props: RecipientPickerSlotProps) => React.ReactNode;
}

export function MessageComposer(props: MessageComposerProps): React.JSX.Element {
  const { t } = useTranslation();
  const model = useMessageComposerModel(props);
  const { step, dispatch, isEmail, isSms, isBulk, Icon } = model;
  const canGoPrevious = step === 'compose' && props.recipients.length === 0;

  /** FormModal onClose after discard confirm, or immediate close when clean. */
  const handleClose = () => {
    if (canGoPrevious) {
      if (model.isDirty) {
        model.discardDraftAndGoBack();
      } else {
        model.setStep('pick');
      }
      return;
    }
    model.discardDraftAndClose();
  };

  const cancelLabel = canGoPrevious ? t('common.previous') : t('common.cancel');

  return (
    <FormModal
      open
      priority
      size={step === 'pick' ? '2xl' : 'xl'}
      onClose={handleClose}
      title={model.title}
      subtitle={model.subtitle}
      icon={Icon}
      cancelLabel={cancelLabel}
      saveLabel={model.saveLabel}
      saving={step === 'compose' && (dispatch.opening || dispatch.saving)}
      onSave={model.handleSave}
      saveDisabled={model.saveDisabled}
      formId={COMPOSER_FORM_ID}
      isDirty={model.isDirty}
      discardUnsavedTitle={t('settings.unsavedChanges')}
      discardUnsavedDescription={t('messaging.discardComposeDraft')}
      discardConfirmLabel={t('common.yes')}
      discardCancelLabel={t('common.cancel')}
    >
      <form
        id={COMPOSER_FORM_ID}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!model.saveDisabled) model.handleSave();
        }}
        onKeyDown={(event) => {
          if (!(event.metaKey || event.ctrlKey) || event.key !== 'Enter') return;
          if (event.nativeEvent.isComposing) return;
          event.preventDefault();
          if (!model.saveDisabled) model.handleSave();
        }}
      >
        {step === 'compose' && (
          <>
            <p className="text-xs leading-relaxed text-muted-foreground">{model.note}</p>
            {dispatch.pendingAudit ? (
              <WarningCallout density="compact" description={t('messaging.pendingAuditHint')} />
            ) : null}
            <MessageComposerDispatchControls
              skippedCount={dispatch.skippedRecipients.length}
              isEmail={isEmail}
              isBulk={isBulk}
              opening={dispatch.opening}
              dispatchSpeed={dispatch.dispatchSpeed}
              dispatchProgress={dispatch.dispatchProgress}
              isPaused={dispatch.isPaused}
              onShowSkipped={model.showSkipped}
              onDispatchSpeedChange={dispatch.setDispatchSpeed}
              onPausedChange={dispatch.setIsPaused}
              onCancel={dispatch.cancelDispatch}
            />
            <MessageComposerFormBody
              channel={props.channel}
              channelTemplates={model.channelTemplates}
              templateId={model.templateId}
              subject={model.subject}
              message={model.message}
              messageError={model.bodyError}
              subjectError={model.subjectError}
              eligibleRecipients={dispatch.eligibleRecipients}
              previewIndex={model.previewIndex}
              personalizeOptions={dispatch.personalizeOptions}
              onTemplateChange={model.changeTemplate}
              onSubjectChange={model.setSubject}
              onMessageChange={model.setMessage}
              onMessageBlur={() => model.syncTokenErrorsOnBlur('body')}
              onSubjectBlur={() => model.syncTokenErrorsOnBlur('subject')}
              onPreviewIndexChange={model.setPreviewIndex}
            />
          </>
        )}
        <MessageComposerRecipients
          isEmail={isEmail}
          isSms={isSms}
          recipientTab={model.recipientTab}
          search={model.recipientSearch}
          displayedRecipients={model.displayedRecipients}
          validatedRecipients={dispatch.validatedRecipients}
          eligibleRecipients={dispatch.eligibleRecipients}
          skippedRecipients={dispatch.skippedRecipients}
          previewIndex={model.previewIndex}
          message={model.message}
          disabled={model.isBusy}
          onRecipientTabChange={model.setRecipientTab}
          onSearchChange={model.setRecipientSearch}
          onPreviewIndexChange={model.setPreviewIndex}
          onSendOne={dispatch.executeSend}
          onAdd={model.addRecipient}
          onRemove={model.removeRecipient}
          isPickStep={step === 'pick'}
          renderRecipientPicker={props.renderRecipientPicker}
        />
      </form>
    </FormModal>
  );
}

export default MessageComposer;
