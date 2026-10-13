import React, { useRef, useState, useId } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { motion } from "framer-motion";
import { History, Send } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { type ContactActivity, formatDate } from "@mms/shared";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { ACTIVITY_TYPE_I18N } from "@/lib/contacts/contactI18n";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { Input } from "@/components/ui/input";
import { DETAIL_SECTION_TITLE, WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";
import { ICON_MAP } from "./contactDetailStyles";

export interface ContactDetailTimelineProps {
  activities: ContactActivity[];
  canPersistContact: boolean;
  onAddNote: (content: string) => Promise<boolean | void>;
}

function ActivityItem({
  act,
  idx,
  reducedMotion,
  t,
}: {
  act: ContactActivity;
  idx: number;
  reducedMotion: boolean;
  t: TranslationFunction;
}): React.JSX.Element {
  const Icon = ICON_MAP[act.type] || History;
  return (
    <motion.div
      key={act.id}
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reducedMotion ? 0 : 0.15,
        delay: reducedMotion ? 0 : Math.min(idx * 0.03, 0.3),
      }}
      className="relative ps-6 group"
    >
      <div className="absolute -start-3 top-1.5 w-6 h-6 -translate-x-1/2 rtl:translate-x-1/2 rounded-full bg-card border-2 border-border flex items-center justify-center z-elevated group-hover:border-primary transition-colors">
        <Icon className="w-2.5 h-2.5 text-muted-foreground group-hover:text-primary" />
      </div>
      <div
        className={`${WORK_SURFACE_INNER} p-4 hover:border-primary/20 group-hover:border-primary/20`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className={DETAIL_SECTION_TITLE}>
            {ACTIVITY_TYPE_I18N[act.type] ? t(ACTIVITY_TYPE_I18N[act.type]) : act.type}
          </span>
          <span className="text-xs font-bold text-muted-foreground">{formatDate(act.date)}</span>
        </div>
        <p className="text-xs text-foreground font-medium leading-relaxed">{act.content}</p>
        {act.by && (
          <span className="block mt-2 text-xs font-bold text-primary italic">— {act.by}</span>
        )}
      </div>
    </motion.div>
  );
}

export function ContactDetailTimeline({
  activities,
  canPersistContact,
  onAddNote,
}: ContactDetailTimelineProps): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const noteInputId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const trimmed = noteText.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const ok = await onAddNote(trimmed);
      if (ok !== false) {
        setNoteText("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isVirtualized = activities.length > 30;
  const rowVirtualizer = useVirtualizer({
    count: activities.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 92,
    overscan: 5,
    enabled: isVirtualized,
  });

  return (
    <div className="space-y-5">
      {canPersistContact && (
        <div className="relative">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <label htmlFor={noteInputId} className="sr-only">
              {t("contacts.detail.logEventOrNote")}
            </label>
            <Input
              id={noteInputId}
              name="contact-note"
              type="text"
              placeholder={t("contacts.detail.logEventOrNote")}
              value={noteText}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNoteText(e.target.value)}
              disabled={submitting}
              className="flex-1 px-4 py-3 rounded-2xl"
            />
            <Button
              type="submit"
              disabled={submitting || !noteText.trim()}
              aria-label={t("contacts.detail.logEventOrNoteSubmit")}
              className={`w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-none ${
                reducedMotion ? "" : "hover:scale-105 active:scale-95 transition-all"
              }`}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}

      {!activities || activities.length === 0 ? (
        <div className="relative ps-3">
          <EmptyState
            title={t("contacts.detail.quietTimeline")}
            icon={History}
            className="opacity-30 uppercase tracking-widest"
          />
        </div>
      ) : isVirtualized ? (
        <div ref={scrollRef} className={cn("max-h-120 overflow-y-auto relative ps-3 space-y-6")}>
          <div className="absolute start-3 top-0 bottom-0 w-0.5 -translate-x-1/2 rtl:translate-x-1/2 bg-border/50" />
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: "relative",
              width: "100%",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const act = activities[virtualRow.index];
              return (
                <div
                  key={act.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <ActivityItem
                    act={act}
                    idx={virtualRow.index}
                    reducedMotion={reducedMotion}
                    t={t}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-6 relative ps-3">
          <div className="absolute start-3 top-0 bottom-0 w-0.5 -translate-x-1/2 rtl:translate-x-1/2 bg-border/50" />
          {activities.map((act, idx) => (
            <ActivityItem key={act.id} act={act} idx={idx} reducedMotion={reducedMotion} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}
