import React from "react";

export interface EntryPageHeadProps {
  /** Document title (include product suffix via formatEntryTitle). */
  title: string;
  description: string;
  /** Auth and workspace-picker pages should not be indexed. */
  noIndex?: boolean;
  /** Canonical URL for public indexable landing/entry pages. */
  canonicalUrl?: string;
}

/** Sets document title and SEO meta for public entry routes (React 19 head hoisting). */
export default function EntryPageHead({
  title,
  description,
  noIndex = true,
  canonicalUrl,
}: EntryPageHeadProps): React.JSX.Element {
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}
      {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}
    </>
  );
}

/** `{page} | Madrasa MS` title format for entry pages. */
export function formatEntryTitle(pageTitle: string, productName: string): string {
  return `${pageTitle} | ${productName}`;
}
