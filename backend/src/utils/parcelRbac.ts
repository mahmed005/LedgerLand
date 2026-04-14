import type { PublicUser } from "../auth/types.js";
import type { ParcelPublicView } from "../services/parcelService.js";
import { isValidCnic, normalizeCnic } from "./cnic.js";

/** Placeholder stored in JSON when CNIC values are withheld (KAN-26 / RBAC). */
export const REDACTED_CNIC_PLACEHOLDER = "[redacted]";

export type OwnerSearchGateResult =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Validates whether the caller may use the `ownerCnic` search filter.
 * Citizens may only query their own CNIC; `admin` / `judge` may query any; anonymous requests are rejected when the filter is effective.
 *
 * @param user - Resolved user from optional JWT, if any.
 * @param ownerCnicRaw - Raw `ownerCnic` query value.
 */
export function assertOwnerSearchAllowed(
  user: PublicUser | undefined,
  ownerCnicRaw: string | undefined,
): OwnerSearchGateResult {
  if (!ownerCnicRaw?.trim()) {
    return { ok: true };
  }
  const normalized = normalizeCnic(ownerCnicRaw);
  if (!isValidCnic(normalized)) {
    return { ok: true };
  }
  if (!user) {
    return {
      ok: false,
      status: 401,
      error: "Authentication required to search by owner CNIC",
    };
  }
  if (user.role === "admin" || user.role === "judge") {
    return { ok: true };
  }
  if (user.cnic !== normalized) {
    return {
      ok: false,
      status: 403,
      error: "You may only search by your own CNIC",
    };
  }
  return { ok: true };
}

/**
 * Returns true when the viewer may see real CNIC and registered owner names for this parcel.
 *
 * - `admin` and `judge`: always.
 * - `citizen`: only if they are the current owner or appear in `ownershipHistory`.
 * - Anonymous: never.
 *
 * @param user - Authenticated user, if any.
 * @param parcel - Full parcel projection from {@link ParcelService}.
 */
export function canViewFullSensitiveParcelData(
  user: PublicUser | undefined,
  parcel: ParcelPublicView,
): boolean {
  if (!user) {
    return false;
  }
  if (user.role === "admin" || user.role === "judge") {
    return true;
  }
  if (parcel.currentOwnerCnic === user.cnic) {
    return true;
  }
  return parcel.ownershipHistory.some((h) => h.ownerCnic === user.cnic);
}

/**
 * Returns a deep copy with CNIC and owner-name fields replaced so unauthorized callers cannot scrape identities.
 *
 * @param parcel - Source parcel view (typically already enriched with names).
 */
export function redactParcelSensitiveFields(parcel: ParcelPublicView): ParcelPublicView {
  return {
    ...parcel,
    sensitiveDataRedacted: true,
    currentOwnerCnic: REDACTED_CNIC_PLACEHOLDER,
    currentOwnerFullName: null,
    ownershipHistory: parcel.ownershipHistory.map((h) => ({
      ...h,
      ownerCnic: REDACTED_CNIC_PLACEHOLDER,
      ownerFullName: null,
    })),
  };
}

/**
 * Applies {@link redactParcelSensitiveFields} when {@link canViewFullSensitiveParcelData} is false.
 *
 * @param user - Optional authenticated user.
 * @param parcel - Parcel to project for HTTP.
 */
export function applyParcelSensitiveRbac(
  user: PublicUser | undefined,
  parcel: ParcelPublicView,
): ParcelPublicView {
  const next = { ...parcel };
  delete next.sensitiveDataRedacted;
  if (canViewFullSensitiveParcelData(user, parcel)) {
    return next;
  }
  return redactParcelSensitiveFields(next);
}
