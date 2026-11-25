/**
 * Triggers a browser download of a Blob.
 * Centralizes standard browser download triggers, link appending/clicking, and object URL revocation.
 *
 * @param blob - The data to download as a Blob.
 * @param filename - The filename for the downloaded file.
 */
export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoking synchronously can truncate large downloads in Safari/Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
