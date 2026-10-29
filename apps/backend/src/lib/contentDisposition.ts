/**
 * RFC 6266 `Content-Disposition` builder for tenant-supplied filenames.
 *
 * Export filenames are localized (`messaging.exportFilename` is Arabic, Urdu or
 * Persian), but HTTP header values are Latin-1 only: Node's `setHeader` throws
 * `ERR_INVALID_CHAR` for anything outside `\t\x20-\x7e\x80-\xff`, which turned
 * every localized artifact download into a 500. The ASCII `filename` parameter
 * keeps older clients working; `filename*` carries the real UTF-8 name.
 */

/** Characters RFC 5987 requires to be percent-encoded beyond `encodeURIComponent`. */
const RFC5987_ESCAPES: Record<string, string> = {
  "'": "%27",
  "(": "%28",
  ")": "%29",
  "*": "%2A",
};

/** ASCII-only fallback: strip quotes/backslashes and replace non-printable bytes. */
function asciiFallback(filename: string): string {
  const cleaned = filename
    .replace(/["\\]/g, "_")
    .replace(/[^\t\x20-\x7e\x80-\xff]/g, "_")
    .trim();
  return cleaned || "download";
}

/** Percent-encodes a filename for the `filename*` parameter (RFC 5987). */
function encodeRfc5987(filename: string): string {
  return encodeURIComponent(filename).replace(/['()*]/g, (char) => RFC5987_ESCAPES[char] ?? char);
}

/**
 * Builds an attachment header safe to pass to `reply.header()` for any filename.
 * The result is always ASCII, so it can never trip Node's header validation.
 */
export function buildContentDisposition(
  filename: string,
  disposition: "attachment" | "inline" = "attachment",
): string {
  const fallback = asciiFallback(filename);
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeRfc5987(filename)}`;
}
