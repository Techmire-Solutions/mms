import { useState } from "react";
import type { QuestionBankQuestion } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/app/FormSelect";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { uploadAttachmentFile } from "@/lib/attachmentUpload";
import { notify } from "@/lib/notify";
import { useQuestionBankMutations } from "@/tenant/features/question-bank/hooks/useQuestionBankMutations";

interface QuestionMediaSectionProps {
  question: QuestionBankQuestion;
  canWrite: boolean;
}

/**
 * Stem/option media for one question (migration 0242).
 *
 * Files are uploaded first with the `question_media` purpose, then attached to the saved question.
 * The list renders images inline and audio with the native player; removal detaches the row and lets
 * the use case unlink an unreferenced file.
 */
export function QuestionMediaSection({
  question,
  canWrite,
}: QuestionMediaSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const { addQuestionAttachment, removeQuestionAttachment } = useQuestionBankMutations();
  const [target, setTarget] = useState("stem");
  const [busy, setBusy] = useState(false);

  const attachments = question.attachments ?? [];
  const optionTargets = question.options.map((_option, index) => ({
    value: `option:${index}`,
    label: t("questionBank.optionN", { n: index + 1 }),
  }));

  const upload = async (file: File): Promise<void> => {
    setBusy(true);
    try {
      const uploaded = await uploadAttachmentFile(file, "question_media");
      const isOption = target.startsWith("option:");
      await addQuestionAttachment.mutateAsync(question.id, {
        kind: isOption ? "option" : "stem",
        optionIndex: isOption ? Number(target.split(":")[1]) : null,
        url: uploaded.url,
        name: uploaded.name,
        mime: uploaded.type,
        size: uploaded.size,
      });
    } catch (error) {
      notify.error(t("questionBank.mediaUploadFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {attachments.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">{t("questionBank.mediaEmpty")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                {attachment.mime.startsWith("audio/") ? (
                  <audio
                    controls
                    src={attachment.url}
                    aria-label={attachment.name || t("questionBank.mediaStem")}
                    className="max-w-56"
                  />
                ) : (
                  <img
                    src={attachment.url}
                    alt={attachment.name}
                    className="h-12 w-12 rounded object-cover"
                    loading="lazy"
                  />
                )}
                <span className="truncate text-xs text-muted-foreground">
                  {attachment.kind === "option" && attachment.optionIndex !== null
                    ? t("questionBank.optionN", { n: attachment.optionIndex + 1 })
                    : t("questionBank.mediaStem")}
                  {" · "}
                  {attachment.name}
                </span>
              </div>
              {canWrite && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || removeQuestionAttachment.isPending}
                  onClick={() =>
                    void removeQuestionAttachment.mutateAsync(question.id, attachment.id)
                  }
                >
                  {t("common.delete")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <div className="flex flex-wrap items-end gap-2">
          <FormSelect
            id="qb-media-target"
            name="mediaTarget"
            className={FORM_INPUT}
            value={target}
            onChange={setTarget}
            options={[{ value: "stem", label: t("questionBank.mediaStem") }, ...optionTargets]}
          />
          <label className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-border px-3 text-sm">
            {busy ? t("common.loading") : t("questionBank.mediaUpload")}
            <input
              type="file"
              aria-label={t("questionBank.mediaUpload")}
              className="sr-only"
              accept="image/avif,image/webp,image/png,image/jpeg,audio/mpeg,audio/ogg,audio/wav,audio/mp4"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
