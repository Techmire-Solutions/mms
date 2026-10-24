import React from "react";

export interface EntryPageHeadProps {
  /** Document title (include product suffix via formatEntryTitle). */
  title: string;
  description: string;
  /** Auth and workspace-picker pages should not be indexed. */
  noIndex?: boolean;
}

/** Sets document title and SEO meta for public entry routes (React 19 head hoisting). */
export default function EntryPageHead({
  title,
  description,
  noIndex = true,
}: EntryPageHeadProps): React.JSX.Element {
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      {noIndex ? <meta name="robots" content="noindex, nofollow" /> : null}
    </>
  );
}

/** `{page} | Madrasa MS` title format for entry pages. */
export function formatEntryTitle(pageTitle: string, productName: string): string {
  return `${pageTitle} | ${productName}`;
}
