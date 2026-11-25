export function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const limit = 256 - (256 % chars.length);
  let password = "Mms#";
  while (password.length < 12) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const byte of bytes) {
      if (byte < limit) password += chars[byte % chars.length];
      if (password.length === 12) break;
    }
  }
  return password;
}
