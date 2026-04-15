/**
 * CNIC utility — normalize and validate Pakistani 13-digit CNICs.
 * Accepts dashes (e.g. "35201-1111111-1") and strips them.
 */

/**
 * Strip all non-digit characters and return the raw digits.
 */
export function normalizeCnic(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Check whether a raw CNIC string normalizes to exactly 13 digits.
 */
export function isValidCnic(raw: string): boolean {
  return /^\d{13}$/.test(normalizeCnic(raw));
}
