import type { StoredUser, UserRole } from "./types.js";
import { UserModel } from "../models/User.js";

/**
 * Persistence abstraction for accounts (MongoDB in production, mocks in tests).
 */
export interface IUserRepository {
  /**
   * @param cnic - Normalized 13-digit CNIC.
   */
  findByCnic(cnic: string): Promise<StoredUser | null>;

  /**
   * @param id - Primary key string (UUID).
   */
  findById(id: string): Promise<StoredUser | null>;

  /**
   * @param user - Full row including `id` used as document `_id`.
   */
  create(user: StoredUser): Promise<void>;
}

type UserDoc = {
  _id: string;
  cnic: string;
  email: string | null;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
};

function docToStored(doc: UserDoc): StoredUser {
  return {
    id: doc._id,
    cnic: doc.cnic,
    email: doc.email,
    passwordHash: doc.passwordHash,
    fullName: doc.fullName,
    role: doc.role,
    createdAt: doc.createdAt,
  };
}

/**
 * MongoDB-backed implementation of {@link IUserRepository}.
 */
export class MongoUserRepository implements IUserRepository {
  /** @inheritdoc */
  async findByCnic(cnic: string): Promise<StoredUser | null> {
    const doc = await UserModel.findOne({ cnic }).lean();
    if (!doc) {
      return null;
    }
    return docToStored(doc as UserDoc);
  }

  /** @inheritdoc */
  async findById(id: string): Promise<StoredUser | null> {
    const doc = await UserModel.findById(id).lean();
    if (!doc) {
      return null;
    }
    return docToStored(doc as UserDoc);
  }

  /** @inheritdoc */
  async create(user: StoredUser): Promise<void> {
    const doc: Record<string, unknown> = {
      _id: user.id,
      cnic: user.cnic,
      passwordHash: user.passwordHash,
      fullName: user.fullName,
      role: user.role,
      createdAt: user.createdAt,
    };
    if (user.email) {
      doc.email = user.email;
    }
    await UserModel.create(doc);
  }
}
