import { useEffect, useRef, useState } from "react";
import { Mail, MessageCircle, MessageSquare } from "lucide-react";
import {
  mergeMessageTemplates,
  type MessageTemplate,
  type StandardMessagingRecipient as MessagingRecipient,
} from "@mms/shared";
import { useMessageTemplates } from "@/hooks/useMessaging";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import type { RecipientTab } from "./MessageComposerRecipients";
import { useMessageComposerDispatch } from "./useMessageComposerDispatch";
import { findUnknownTokens, type DispatchSpeed } from "./messageComposerDispatchService";
import {
  clearComposerDraft,
  resolveComposerUserId,
  writeComposerDraft,
} from "./messageComposerDraft";
import { recipientIdsKey, resolveComposerInitialState } from "./messageComposerInitialState";
import { filterDisplayedRecipients, withAddedRecipient } from "./messageComposerRecipientsUtils";
import {
  formatUnknownTokensLabel,
  hasUnknownComposeTokens,
  liveUnknownTokenLabels,
  unknownTokenFieldErrors,
} from "./messageComposerTokenErrors";
import {
  getComposerNote,
  getComposerSaveLabel,
  getComposerSubtitle,
  getComposerTitle,
} from "./messageComposerText";

export interface UseMessageComposerModelProps {
  channel: "sms" | "whatsapp" | "email";
  recipients: MessagingRecipient[];
  onClose: () => void;
  templates?: MessageTemplate[];
  initialMessage?: string;
  initialSubject?: string;
  onSent?: (sent: { recipientId: string | number; body: string }[]) => void;
  madrasaName?: string;
  user?: unknown;
  useServerGateway?: boolean;
  defaultDispatchSpeed?: DispatchSpeed;
}

export function useMessageComposerModel(props: UseMessageComposerModelProps) {
  const {
    channel,
    recipients,
    onClose,
    templates,
    initialMessage,
    initialSubject,
    onSent,
    madrasaName,
    user,
  } = props;
  const { t } = useTranslation();
  const { templates: fetchedTemplates } = useMessageTemplates();
  const draftRestoredRef = useRef(false);
  const activeTemplates = templates ?? mergeMessageTemplates(fetchedTemplates);
  const channelTemplates = activeTemplates.filter(
    (tpl) => !tpl.channel || tpl.channel === "all" || tpl.channel === channel,
  );
  const [initial] = useState(() =>
    resolveComposerInitialState({
      channel,
      recipients,
      initialMessage,
      initialSubject,
      channelTemplates,
      activeTemplates,
      user,
    }),
  );
  const userId = resolveComposerUserId(user) ?? initial.userId;
  const [templateId, setTemplateId] = useState(initial.templateId);
  const [subject, setSubjectState] = useState(initial.subject);
  const [message, setMessageState] = useState(initial.message);
  const [bodyError, setBodyError] = useState<string | undefined>();
  const [subjectError, setSubjectError] = useState<string | undefined>();
  const [recipientTab, setRecipientTab] = useState<RecipientTab>("all");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [previewIndex, setPreviewIndex] = useState(0);
  const [localRecipients, setLocalRecipients] = useState(initial.localRecipients);
  const [step, setStep] = useState(initial.step);
  const [useServerGateway, setUseServerGateway] = useState(props.useServerGateway ?? true);

  useEffect(() => {
    if (draftRestoredRef.current || !initial.draft) return;
    draftRestoredRef.current = true;
    notify.info(t("messaging.draftRestored"));
  }, [initial.draft, t]);

  useEffect(() => {
    if (!message.trim() && !subject.trim() && localRecipients.length === 0) {
      clearComposerDraft(channel, userId);
      return;
    }
    const timer = window.setTimeout(() => {
      writeComposerDraft({
        v: 1,
        channel,
        userId,
        message,
        subject,
        templateId,
        recipients: localRecipients.map((r) => ({
          id: r.id,
          name: r.name,
          phone: r.phone,
          email: r.email,
        })),
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [channel, userId, message, subject, templateId, localRecipients]);

  const setMessage = setMessageState;
  const setSubject = setSubjectState;
  const syncTokenErrorsOnBlur = (field: "body" | "subject"): void => {
    const tokens = liveUnknownTokenLabels(field === "body" ? message : subject);
    const error = tokens ? t("messaging.unknownTokens", { tokens }) : undefined;
    if (field === "body") setBodyError(error);
    else setSubjectError(error);
  };
  const addRecipient = (candidate: MessagingRecipient): void => {
    const { next, duplicate } = withAddedRecipient(localRecipients, candidate);
    if (duplicate) {
      notify.warning(t("messaging.recipientAlreadyAdded"));
      return;
    }
    setLocalRecipients(next);
    notify.success(t("messaging.recipientAdded"));
  };
  const removeRecipient = (id: string | number): void => {
    setLocalRecipients((prev) => prev.filter((r) => String(r.id) !== String(id)));
    notify.success(t("messaging.recipientRemoved"));
  };
  const clearDraftStorage = (): void => {
    clearComposerDraft(channel, userId);
  };
  const discardDraftAndClose = (): void => {
    clearDraftStorage();
    onClose();
  };
  const discardDraftAndGoBack = (): void => {
    clearDraftStorage();
    setMessageState("");
    setSubjectState("");
    setBodyError(undefined);
    setSubjectError(undefined);
    setTemplateId(channelTemplates[0]?.id || activeTemplates[0]?.id || "custom");
    setLocalRecipients([]);
    setPreviewIndex(0);
    setStep("pick");
  };
  const dispatch = useMessageComposerDispatch({
    channel,
    recipients: localRecipients,
    activeTemplates,
    templateId,
    subject,
    message,
    onClose: discardDraftAndClose,
    onSent: (sent) => {
      clearDraftStorage();
      onSent?.(sent);
    },
    madrasaName,
    user,
    useServerGateway,
    defaultDispatchSpeed: props.defaultDispatchSpeed,
  });
  const isEmail = channel === "email";
  const isSms = channel === "sms";
  const isBusy = dispatch.opening || dispatch.saving;
  const eligibleCount = dispatch.eligibleRecipients.length;
  const changeTemplate = (nextTemplateId: string): void => {
    setTemplateId(nextTemplateId);
    const selected = channelTemplates.find((tpl) => tpl.id === nextTemplateId);
    if (selected && selected.id !== "custom") setMessage(selected.body);
  };
  const handleSave = (): void => {
    if (step === "pick") {
      setStep("compose");
      return;
    }
    const unknownTokens = findUnknownTokens(channel, subject, message);
    if (unknownTokens.length > 0) {
      const errorMsg = t("messaging.unknownTokens", {
        tokens: formatUnknownTokensLabel(unknownTokens),
      });
      const fieldErrors = unknownTokenFieldErrors({ channel, subject, message, errorMsg });
      setBodyError(fieldErrors.bodyError);
      setSubjectError(fieldErrors.subjectError);
      notify.error(errorMsg);
      return;
    }
    setBodyError(undefined);
    setSubjectError(undefined);
    void dispatch.sendAll();
  };
  const composeChanged =
    message !== initial.message ||
    subject !== initial.subject ||
    templateId !== initial.templateId ||
    recipientIdsKey(localRecipients) !== recipientIdsKey(initial.localRecipients);
  const hasDraftableContent = Boolean(
    message.trim() || subject.trim() || localRecipients.length > 0,
  );
  /** Pick-step close must confirm when compose content/draft remains after Previous. */
  const isDirty = step === "compose" ? composeChanged : hasDraftableContent;
  const saveDisabled =
    step === "pick"
      ? localRecipients.length === 0
      : dispatch.pendingAudit
        ? dispatch.saving
        : isBusy ||
          !dispatch.eligibleRecipients.length ||
          !message.trim() ||
          (isEmail && !subject.trim()) ||
          hasUnknownComposeTokens(channel, subject, message);

  return {
    step,
    setStep,
    templateId,
    subject,
    setSubject,
    message,
    setMessage,
    bodyError,
    subjectError,
    syncTokenErrorsOnBlur,
    recipientTab,
    setRecipientTab,
    recipientSearch,
    setRecipientSearch,
    previewIndex,
    setPreviewIndex,
    localRecipients,
    addRecipient,
    removeRecipient,
    channelTemplates,
    changeTemplate,
    dispatch,
    displayedRecipients: filterDisplayedRecipients({
      recipientTab,
      recipientSearch,
      eligible: dispatch.eligibleRecipients,
      skipped: dispatch.skippedRecipients,
      validated: dispatch.validatedRecipients,
    }),
    isEmail,
    isSms,
    isBulk: localRecipients.length > 1,
    useServerGateway,
    setUseServerGateway,
    Icon: isEmail ? Mail : isSms ? MessageSquare : MessageCircle,
    title: getComposerTitle({ t, step, channel, localRecipients }),
    subtitle: getComposerSubtitle({ t, step, channel, localRecipients, eligibleCount }),
    note: getComposerNote(t, channel),
    saveLabel: getComposerSaveLabel({
      t,
      step,
      channel,
      localRecipients,
      eligibleCount,
      pendingAudit: !!dispatch.pendingAudit,
      opening: dispatch.opening,
    }),
    handleSave,
    showSkipped: () => setRecipientTab("skipped"),
    isBusy,
    saveDisabled,
    isDirty,
    discardDraftAndClose,
    discardDraftAndGoBack,
  };
}
