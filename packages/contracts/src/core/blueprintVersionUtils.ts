/** Validates a submitted blueprint ID against the current configuration version. */
export function verifyBlueprintVersion(
  submittedBlueprintId: unknown,
  currentVersion: string | number,
): void {
  if (
    submittedBlueprintId !== undefined &&
    submittedBlueprintId !== null &&
    String(submittedBlueprintId) !== String(currentVersion)
  ) {
    throw new Error(
      `Blueprint version mismatch. Expected version ${currentVersion}, got ${submittedBlueprintId}. Please reload the form.`,
    );
  }
}
