/**
 * Strips non-digit characters from a CNIC input (allows formatted `12345-1234567-1`).
 *
 * @param raw - User-supplied CNIC string.
 * @returns Contiguous digit string.
 */
export function normalizeCnic(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Validates Pakistan-style CNIC as exactly 13 decimal digits.
 *
 * @param normalized - Output of {@link normalizeCnic}.
 * @returns Whether the value is a syntactically valid CNIC for this MVP.
 */
export function isValidCnic(normalized: string): boolean {
  return /^\d{13}$/.test(normalized);
}
