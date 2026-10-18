/**
 * Entropy-based password strength estimator (no external deps).
 *
 * Pure, I/O-free: FE wrappers map `score` to colors / i18n keys.
 * `score` is 0 for empty, 1–5 (very weak → very strong) for non-empty input,
 * directly driving a 5-segment strength meter.
 */

export interface PasswordStrengthEstimate {
  /** 0 = empty; 1–5 = very weak → very strong. */
  score: 0 | 1 | 2 | 3 | 4 | 5;
  /** Estimated Shannon entropy in bits (after penalties). */
  entropyBits: number;
}

const KEYBOARD_SEQUENCES = [
  "abcdefghijklmnopqrstuvwxyz",
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm",
  "0123456789",
];

/** Counts the distinct character classes present in the password. */
function countCharClasses(password: string): number {
  return (
    (/[a-z]/.test(password) ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/[0-9]/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0)
  );
}

/** Estimates password strength from Shannon entropy with structural penalties. */
export function estimatePasswordStrength(password: string): PasswordStrengthEstimate {
  if (!password) return { score: 0, entropyBits: 0 };

  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/[0-9]/.test(password)) pool += 10;
  if (/[^A-Za-z0-9]/.test(password)) pool += 33;

  let bits = password.length * Math.log2(pool || 1);

  // Single character class (e.g. all lowercase, all digits) collapses the real space.
  if (countCharClasses(password) === 1) bits *= 0.7;

  // Repeating a single character offers near-zero additional entropy.
  if (/^(.)\1+$/.test(password)) bits *= 0.3;

  // Repeated multi-char chunks (e.g. "abcabc") add little entropy.
  if (/(.{2,})\1/.test(password)) bits *= 0.8;

  // Common keyboard / numeric sequences are heavily predictable.
  const lowered = password.toLowerCase();
  for (const seq of KEYBOARD_SEQUENCES) {
    for (let i = 0; i + 3 <= seq.length; i += 1) {
      if (lowered.includes(seq.slice(i, i + 3))) {
        bits *= 0.85;
        break;
      }
    }
  }

  const rounded = Math.round(bits);
  const score: PasswordStrengthEstimate["score"] =
    rounded < 28 ? 1 : rounded < 36 ? 2 : rounded < 60 ? 3 : rounded < 96 ? 4 : 5;
  return { score, entropyBits: rounded };
}
