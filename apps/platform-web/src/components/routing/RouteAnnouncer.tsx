import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const MAIN_CONTENT_ID = "main-content";
/** How long to wait for a lazily rendered heading before announcing the title. */
const ANNOUNCE_TIMEOUT_MS = 500;

/**
 * Announces client-side navigations to assistive technology.
 *
 * A router change replaces the page without a document load, so screen readers
 * get no announcement and focus stays on the clicked sidebar link. On every
 * pathname change this:
 *   1. moves focus to the `#main-content` landmark (skipped while a modal dialog
 *      is open, and on the first render), and
 *   2. publishes the new page heading through a polite live region — waiting for
 *      a lazy route's heading to appear, falling back to a changed
 *      `document.title`, then to the title after a short timeout.
 *
 * Query/hash-only changes do not fire (tabs carry their own semantics).
 */
export function RouteAnnouncer(): React.JSX.Element {
  const { pathname } = useLocation();
  const [message, setMessage] = useState("");
  const messageRef = useRef("");
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    const modalOpen = document.querySelector('[aria-modal="true"]') !== null;
    const main = document.getElementById(MAIN_CONTENT_ID);
    if (!modalOpen && main && !main.contains(document.activeElement)) {
      main.focus({ preventScroll: true });
    }

    const previousTitle = document.title;
    let announced = false;
    let observer: MutationObserver | null = null;
    let timer = 0;

    const publish = (text: string): void => {
      if (!text) return;
      announced = true;
      observer?.disconnect();
      window.clearTimeout(timer);
      if (text === messageRef.current) {
        // Same page title again (A → B → A): clear first so the live region changes.
        setMessage("");
        window.setTimeout(() => {
          messageRef.current = text;
          setMessage(text);
        }, 0);
        return;
      }
      messageRef.current = text;
      setMessage(text);
    };

    const tryAnnounce = (allowUnchangedTitle = false): void => {
      if (announced) return;
      const heading = document
        .getElementById(MAIN_CONTENT_ID)
        ?.querySelector("h1")
        ?.textContent?.trim();
      if (heading) {
        publish(heading);
        return;
      }
      if (allowUnchangedTitle || document.title !== previousTitle) {
        publish(document.title);
      }
    };

    tryAnnounce();
    if (!announced) {
      observer = new MutationObserver(() => tryAnnounce());
      observer.observe(document.head, { subtree: true, childList: true, characterData: true });
      const currentMain = document.getElementById(MAIN_CONTENT_ID);
      if (currentMain) observer.observe(currentMain, { subtree: true, childList: true });
      timer = window.setTimeout(() => tryAnnounce(true), ANNOUNCE_TIMEOUT_MS);
    }

    return () => {
      observer?.disconnect();
      window.clearTimeout(timer);
    };
  }, [pathname]);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
