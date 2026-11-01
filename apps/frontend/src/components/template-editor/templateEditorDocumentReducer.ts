/**
 * @file templateEditorDocumentReducer.ts
 * @description Pure document state machine for the template editor.
 *
 * Split out of `useTemplateEditorDocumentState` to stay under the 300-line ceiling.
 * Reducers are pure: StrictMode may invoke them twice, and a duplicated side effect
 * here would append the same history frame twice (undo would then look like a no-op).
 */

import type { DocumentTemplate, TemplateElement } from "@mms/shared";

/** Repeated edits closer together than this collapse into a single undo step. */
export const COALESCE_WINDOW_MS = 700;
/** Undo stack ceiling. */
const HISTORY_LIMIT = 30;

export interface DocumentState<TPayload> {
  template: DocumentTemplate<TPayload>;
  /** JSON of the last server-accepted layout; dirty is a string comparison against it. */
  baselineJson: string;
  history: DocumentTemplate<TPayload>[];
  future: DocumentTemplate<TPayload>[];
  activePresetKey: string | null;
  lastCoalesce: { key: string; at: number } | null;
}

export type DocumentAction<TPayload> =
  | {
      type: "commit";
      updateFn: (
        elements: TemplateElement<keyof TPayload & string>[],
      ) => TemplateElement<keyof TPayload & string>[];
      coalesceKey?: string;
      at?: number;
    }
  | {
      type: "update";
      updateFn: (
        elements: TemplateElement<keyof TPayload & string>[],
      ) => TemplateElement<keyof TPayload & string>[];
    }
  | { type: "patch"; patch: Partial<DocumentTemplate<TPayload>> }
  | {
      type: "replace";
      template: DocumentTemplate<TPayload>;
      presetKey?: string | null;
    }
  | { type: "push-history"; snapshot: DocumentTemplate<TPayload> }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "mark-saved" }
  | { type: "discard" }
  | { type: "hydrate"; template: DocumentTemplate<TPayload>; baselineJson?: string }
  | { type: "set-preset"; presetKey: string | null };

function pushCapped<TPayload>(
  history: DocumentTemplate<TPayload>[],
  entry: DocumentTemplate<TPayload>,
): DocumentTemplate<TPayload>[] {
  return [...history.slice(-(HISTORY_LIMIT - 1)), entry];
}

export function documentReducer<TPayload>(
  state: DocumentState<TPayload>,
  action: DocumentAction<TPayload>,
): DocumentState<TPayload> {
  switch (action.type) {
    case "commit": {
      const nextTemplate: DocumentTemplate<TPayload> = {
        ...state.template,
        elements: action.updateFn(state.template.elements),
      };
      const now = action.at ?? 0;
      const startsNewStep =
        !action.coalesceKey ||
        !state.lastCoalesce ||
        state.lastCoalesce.key !== action.coalesceKey ||
        now - state.lastCoalesce.at > COALESCE_WINDOW_MS;

      return {
        ...state,
        template: nextTemplate,
        history: startsNewStep ? pushCapped(state.history, state.template) : state.history,
        future: startsNewStep ? [] : state.future,
        lastCoalesce: action.coalesceKey ? { key: action.coalesceKey, at: now } : null,
        activePresetKey: null,
      };
    }

    case "update":
      return {
        ...state,
        template: { ...state.template, elements: action.updateFn(state.template.elements) },
        activePresetKey: null,
      };

    case "patch":
      return {
        ...state,
        template: { ...state.template, ...action.patch },
        history: pushCapped(state.history, state.template),
        future: [],
        lastCoalesce: null,
        activePresetKey: null,
      };

    case "replace":
      return {
        ...state,
        template: action.template,
        history: pushCapped(state.history, state.template),
        future: [],
        lastCoalesce: null,
        activePresetKey: action.presetKey ?? null,
      };

    case "push-history":
      return {
        ...state,
        history: pushCapped(state.history, action.snapshot),
        future: [],
        lastCoalesce: null,
      };

    case "undo": {
      const previous = state.history[state.history.length - 1];
      if (!previous) return state;
      return {
        ...state,
        template: previous,
        history: state.history.slice(0, -1),
        future: [state.template, ...state.future],
        lastCoalesce: null,
      };
    }

    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        template: next,
        history: pushCapped(state.history, state.template),
        future: state.future.slice(1),
        lastCoalesce: null,
      };
    }

    case "mark-saved":
      return { ...state, baselineJson: JSON.stringify(state.template) };

    case "discard": {
      const baseline = JSON.parse(state.baselineJson) as DocumentTemplate<TPayload>;
      return {
        ...state,
        template: baseline,
        history: [],
        future: [],
        lastCoalesce: null,
        activePresetKey: null,
      };
    }

    case "hydrate":
      return {
        ...state,
        template: action.template,
        baselineJson: action.baselineJson ?? JSON.stringify(action.template),
        history: [],
        future: [],
        lastCoalesce: null,
        activePresetKey: null,
      };

    case "set-preset":
      return { ...state, activePresetKey: action.presetKey };

    default:
      return state;
  }
}
