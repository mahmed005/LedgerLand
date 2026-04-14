/**
 * Application role for authorization (`admin` = land-record officer; `judge` = court read-only API).
 */
export type UserRole = "citizen" | "admin" | "judge";

/**
 * Persisted account (password hash only; never return the hash from APIs).
 */
export interface StoredUser {
  id: string;
  /** 13-digit normalized CNIC (primary login identifier). */
  cnic: string;
  /** Optional contact email for notifications. */
  email: string | null;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
}

/**
 * Public profile returned by authenticated endpoints.
 */
export interface PublicUser {
  id: string;
  cnic: string;
  email: string | null;
  fullName: string;
  role: UserRole;
  createdAt: string;
}
