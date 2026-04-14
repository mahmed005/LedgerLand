import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { IUserRepository } from "./userRepository.js";
import type { PublicUser, StoredUser } from "./types.js";
import { isValidCnic, normalizeCnic } from "../utils/cnic.js";

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

export interface AuthServiceConfig {
  jwtSecret: string;
  jwtExpiresSec: number;
}

export interface SignupInput {
  cnic: string;
  password: string;
  fullName: string;
  /** Optional email for future SMS/email notifications. */
  email?: string | null;
}

export interface LoginInput {
  cnic: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: PublicUser;
}

export interface JwtPayload {
  sub: string;
  cnic: string;
}

/**
 * Handles password hashing, JWT issuance, and user lookups for signup/login flows.
 */
export class AuthService {
  private readonly users: IUserRepository;
  private readonly config: AuthServiceConfig;

  /**
   * @param users - Mongo-backed {@link IUserRepository} (or test double).
   * @param config - JWT signing parameters.
   */
  constructor(users: IUserRepository, config: AuthServiceConfig) {
    this.users = users;
    this.config = config;
  }

  /**
   * Registers a new account when the CNIC is unused and password is strong enough.
   *
   * @param input - Signup credentials and display name.
   * @returns Public profile of the created user.
   * @throws Error with message `CNIC_IN_USE`, `WEAK_PASSWORD`, or `INVALID_CNIC`.
   */
  async signup(input: SignupInput): Promise<PublicUser> {
    const cnic = normalizeCnic(input.cnic);
    if (!isValidCnic(cnic)) {
      throw new Error("INVALID_CNIC");
    }
    if (await this.users.findByCnic(cnic)) {
      throw new Error("CNIC_IN_USE");
    }
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new Error("WEAK_PASSWORD");
    }
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const emailRaw = input.email?.trim();
    const user: StoredUser = {
      id: randomUUID(),
      cnic,
      email: emailRaw ? emailRaw.toLowerCase() : null,
      passwordHash,
      fullName: input.fullName.trim(),
      role: "citizen",
      createdAt: new Date().toISOString(),
    };
    await this.users.create(user);
    return toPublicUser(user);
  }

  /**
   * Creates a single admin account when env bootstrap credentials are provided and the CNIC is unused.
   * Not exposed via public HTTP signup.
   *
   * @param cnic - Raw or formatted CNIC.
   * @param password - Admin password (minimum length rules apply).
   */
  async registerBootstrapAdmin(cnic: string, password: string, fullName = "Administrator"): Promise<void> {
    const normalized = normalizeCnic(cnic);
    if (!isValidCnic(normalized) || password.length < MIN_PASSWORD_LENGTH) {
      return;
    }
    if (await this.users.findByCnic(normalized)) {
      return;
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user: StoredUser = {
      id: randomUUID(),
      cnic: normalized,
      email: null,
      passwordHash,
      fullName,
      role: "admin",
      createdAt: new Date().toISOString(),
    };
    await this.users.create(user);
  }

  /**
   * Creates a single **judge** account when bootstrap env credentials are set and the CNIC is unused.
   * Grants access to authenticated **`/api/court/*`** read APIs.
   *
   * @param cnic - Raw or formatted CNIC.
   * @param password - Account password (minimum length rules apply).
   * @param fullName - Display label for demos.
   */
  async registerBootstrapJudge(cnic: string, password: string, fullName = "Court Officer"): Promise<void> {
    const normalized = normalizeCnic(cnic);
    if (!isValidCnic(normalized) || password.length < MIN_PASSWORD_LENGTH) {
      return;
    }
    if (await this.users.findByCnic(normalized)) {
      return;
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user: StoredUser = {
      id: randomUUID(),
      cnic: normalized,
      email: null,
      passwordHash,
      fullName,
      role: "judge",
      createdAt: new Date().toISOString(),
    };
    await this.users.create(user);
  }

  /**
   * Validates credentials and returns a signed JWT plus public profile.
   *
   * @param input - Login credentials (CNIC + password).
   * @returns Token and user on success.
   * @throws Error with message `INVALID_CREDENTIALS` or `INVALID_CNIC`.
   */
  async login(input: LoginInput): Promise<LoginResult> {
    const cnic = normalizeCnic(input.cnic);
    if (!isValidCnic(cnic)) {
      throw new Error("INVALID_CNIC");
    }
    const user = await this.users.findByCnic(cnic);
    if (!user) {
      throw new Error("INVALID_CREDENTIALS");
    }
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      throw new Error("INVALID_CREDENTIALS");
    }
    const token = jwt.sign(
      { sub: user.id, cnic: user.cnic } satisfies JwtPayload,
      this.config.jwtSecret,
      { expiresIn: this.config.jwtExpiresSec },
    );
    return { token, user: toPublicUser(user) };
  }

  /**
   * Verifies a Bearer JWT and resolves the associated user.
   *
   * @param token - Raw JWT string (no `Bearer` prefix).
   * @returns Public user if valid.
   * @throws Error with message `INVALID_TOKEN` or `USER_NOT_FOUND`.
   */
  async verifyAccessToken(token: string): Promise<PublicUser> {
    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, this.config.jwtSecret) as JwtPayload;
    } catch {
      throw new Error("INVALID_TOKEN");
    }
    const user = await this.users.findById(payload.sub);
    if (!user || user.cnic !== payload.cnic) {
      throw new Error("USER_NOT_FOUND");
    }
    return toPublicUser(user);
  }
}

/**
 * Strips sensitive fields before returning a user over HTTP.
 *
 * @param user - Stored user row.
 */
export function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    cnic: user.cnic,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt,
  };
}
