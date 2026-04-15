import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ParcelModel } from "../models/Parcel.js";
import { UserModel } from "../models/User.js";
import { isValidCnic, normalizeCnic } from "../utils/cnic.js";

/** Mirrors `GET /api/parcels/search` query keys (AND semantics when multiple set). */
export interface ParcelSearchQuery {
  /** Case-insensitive substring on `district`. */
  district?: string;
  /** Case-insensitive substring on `moza`. */
  moza?: string;
  /** Case-insensitive substring on `plotNumber`. */
  plotNumber?: string;
  /** Exact match on `currentOwnerCnic` after digit normalization; invalid CNIC omitted from filter. */
  ownerCnic?: string;
}

export interface CreateParcelInput {
  district: string;
  moza: string;
  plotNumber: string;
  khasra?: string;
  currentOwnerCnic: string;
  disputed?: boolean;
  /** Plain-text body stored as Fard file when provided. */
  fardText?: string;
  /** Plain-text body stored as registry file when provided. */
  registryText?: string;
  /** Plain-text mutation document when provided. */
  mutationText?: string;
}

export interface ParcelPublicView {
  id: string;
  district: string;
  moza: string;
  plotNumber: string;
  khasra: string;
  currentOwnerCnic: string;
  /** Resolved from {@link UserModel.fullName} when a user row exists for the current owner CNIC. */
  currentOwnerFullName: string | null;
  disputed: boolean;
  ownershipHistory: Array<{
    ownerCnic: string;
    /** Registered name for this CNIC when available. */
    ownerFullName: string | null;
    acquiredAt: string;
    transferId: string | null;
    note: string | null;
  }>;
  hasFard: boolean;
  hasRegistry: boolean;
  hasMutation: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * When true, {@link currentOwnerCnic} / history CNICs are placeholders and names are cleared
   * because the caller was not authorized to view identifying data.
   */
  sensitiveDataRedacted?: boolean;
}

/**
 * Parcel search, creation, document uploads, and document path resolution.
 */
export class ParcelService {
  /**
   * @param uploadsDir - Absolute root where parcel document folders are stored.
   */
  constructor(private readonly uploadsDir: string) {}

  /**
   * Creates a parcel and optional Fard/registry/mutation text files on disk.
   *
   * @param input - Administrative parcel definition.
   * @returns Public parcel view with owner display names resolved.
   */
  async createParcel(input: CreateParcelInput): Promise<ParcelPublicView> {
    const owner = normalizeCnic(input.currentOwnerCnic);
    if (!isValidCnic(owner)) {
      throw new Error("INVALID_OWNER_CNIC");
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    const parcelDir = path.join(this.uploadsDir, id);
    await mkdir(parcelDir, { recursive: true });

    let fardRelativePath: string | null = null;
    let registryRelativePath: string | null = null;
    let mutationRelativePath: string | null = null;
    if (input.fardText !== undefined && input.fardText.length > 0) {
      fardRelativePath = path.join(id, "fard.txt");
      await writeFile(path.join(this.uploadsDir, fardRelativePath), input.fardText, "utf8");
    }
    if (input.registryText !== undefined && input.registryText.length > 0) {
      registryRelativePath = path.join(id, "registry.txt");
      await writeFile(path.join(this.uploadsDir, registryRelativePath), input.registryText, "utf8");
    }
    if (input.mutationText !== undefined && input.mutationText.length > 0) {
      mutationRelativePath = path.join(id, "mutation.txt");
      await writeFile(path.join(this.uploadsDir, mutationRelativePath), input.mutationText, "utf8");
    }

    const history = [
      {
        ownerCnic: owner,
        ownerFullName: null as string | null,
        acquiredAt: now,
        transferId: null,
        note: "Initial record",
      },
    ];

    await ParcelModel.create({
      _id: id,
      district: input.district.trim(),
      moza: input.moza.trim(),
      plotNumber: input.plotNumber.trim(),
      khasra: (input.khasra ?? "").trim(),
      currentOwnerCnic: owner,
      disputed: Boolean(input.disputed),
      ownershipHistory: history.map(({ ownerFullName: _o, ...rest }) => rest),
      fardRelativePath,
      registryRelativePath,
      mutationRelativePath,
      createdAt: now,
      updatedAt: now,
    });

    const doc = await ParcelModel.findById(id).lean();
    if (!doc) {
      throw new Error("PARCEL_CREATE_FAILED");
    }
    const base = toPublic(JSON.parse(JSON.stringify(doc)) as ParcelLean);
    return this.withOwnerNames(base);
  }

  /**
   * Searches parcels using **AND** semantics: every provided filter must match.
   *
   * @param query - Filter object (typically from `GET /api/parcels/search` query string).
   * @param query.district - Optional; case-insensitive substring match on `district`.
   * @param query.moza - Optional; case-insensitive substring match on `moza`.
   * @param query.plotNumber - Optional; case-insensitive substring match on `plotNumber`.
   * @param query.ownerCnic - Optional; if present and valid 13-digit CNIC after normalization, exact match on `currentOwnerCnic`; invalid CNIC string is ignored (no error).
   * @returns Matching parcels as public views (empty array if none).
   */
  async searchParcels(query: ParcelSearchQuery): Promise<ParcelPublicView[]> {
    const filter: Record<string, unknown> = {};
    if (query.district?.trim()) {
      filter.district = new RegExp(escapeRegex(query.district.trim()), "i");
    }
    if (query.moza?.trim()) {
      filter.moza = new RegExp(escapeRegex(query.moza.trim()), "i");
    }
    if (query.plotNumber?.trim()) {
      filter.plotNumber = new RegExp(escapeRegex(query.plotNumber.trim()), "i");
    }
    if (query.ownerCnic?.trim()) {
      const oc = normalizeCnic(query.ownerCnic);
      if (isValidCnic(oc)) {
        filter.currentOwnerCnic = oc;
      }
    }
    const docs = await ParcelModel.find(filter).sort({ district: 1, moza: 1, plotNumber: 1 }).lean();
    const views = docs.map((d) => toPublic(JSON.parse(JSON.stringify(d)) as ParcelLean));
    return Promise.all(views.map((v) => this.withOwnerNames(v)));
  }

  /**
   * Loads a parcel by identifier.
   *
   * @param parcelId - Parcel primary key.
   */
  async getParcelById(parcelId: string): Promise<ParcelPublicView | null> {
    const doc = await ParcelModel.findById(parcelId).lean();
    if (!doc) {
      return null;
    }
    const base = toPublic(JSON.parse(JSON.stringify(doc)) as ParcelLean);
    return this.withOwnerNames(base);
  }

  /**
   * Updates the disputed flag for an existing parcel (admin workflow).
   *
   * @param parcelId - Target parcel id.
   * @param disputed - New disputed value.
   * @returns Updated public view or `null` if missing.
   */
  async updateDisputed(parcelId: string, disputed: boolean): Promise<ParcelPublicView | null> {
    const now = new Date().toISOString();
    const doc = await ParcelModel.findByIdAndUpdate(
      parcelId,
      { disputed: Boolean(disputed), updatedAt: now },
      { new: true },
    ).lean();
    if (!doc) {
      return null;
    }
    const base = toPublic(JSON.parse(JSON.stringify(doc)) as ParcelLean);
    return this.withOwnerNames(base);
  }

  /**
   * Writes or replaces a **plain-text** document for a parcel.
   * **`admin`** may write for any parcel; **`citizen`** (and other roles except `judge`) only when CNIC matches `currentOwnerCnic`.
   * **`judge`** may not upload (court read-only in this MVP).
   *
   * @param parcelId - Parcel id.
   * @param actor - Authenticated user CNIC and role.
   * @param kind - Which document slot to write.
   * @param text - UTF-8 body to persist.
   */
  async saveParcelDocument(
    parcelId: string,
    actor: { cnic: string; role: string },
    kind: "fard" | "registry" | "mutation",
    text: string,
  ): Promise<ParcelPublicView> {
    if (actor.role === "judge") {
      throw new Error("NOT_ALLOWED");
    }
    const actorCnic = normalizeCnic(actor.cnic);
    if (!isValidCnic(actorCnic)) {
      throw new Error("INVALID_ACTOR_CNIC");
    }
    const parcel = await ParcelModel.findById(parcelId);
    if (!parcel) {
      throw new Error("PARCEL_NOT_FOUND");
    }
    if (actor.role !== "admin" && parcel.currentOwnerCnic !== actorCnic) {
      throw new Error("NOT_ALLOWED");
    }
    const body = text.trim();
    if (!body.length) {
      throw new Error("EMPTY_DOCUMENT");
    }
    const parcelDir = path.join(this.uploadsDir, parcelId);
    await mkdir(parcelDir, { recursive: true });
    const now = new Date().toISOString();
    if (kind === "fard") {
      const rel = path.join(parcelId, "fard.txt");
      await writeFile(path.join(this.uploadsDir, rel), body, "utf8");
      parcel.fardRelativePath = rel;
    } else if (kind === "registry") {
      const rel = path.join(parcelId, "registry.txt");
      await writeFile(path.join(this.uploadsDir, rel), body, "utf8");
      parcel.registryRelativePath = rel;
    } else {
      const rel = path.join(parcelId, "mutation.txt");
      await writeFile(path.join(this.uploadsDir, rel), body, "utf8");
      parcel.mutationRelativePath = rel;
    }
    parcel.updatedAt = now;
    await parcel.save();
    const refreshed = await ParcelModel.findById(parcelId).lean();
    if (!refreshed) {
      throw new Error("PARCEL_NOT_FOUND");
    }
    const base = toPublic(JSON.parse(JSON.stringify(refreshed)) as ParcelLean);
    return this.withOwnerNames(base);
  }

  /**
   * Resolves an absolute path for a stored document, if configured.
   *
   * @param parcelId - Parcel id.
   * @param kind - Which document slot to resolve.
   */
  async resolveDocumentPath(
    parcelId: string,
    kind: "fard" | "registry" | "mutation",
  ): Promise<{ absolutePath: string } | null> {
    const doc = await ParcelModel.findById(parcelId).lean();
    if (!doc) {
      return null;
    }
    const lean = doc as ParcelLean;
    const rel =
      kind === "fard"
        ? lean.fardRelativePath
        : kind === "registry"
          ? lean.registryRelativePath
          : lean.mutationRelativePath;
    if (!rel) {
      return null;
    }
    return { absolutePath: path.join(this.uploadsDir, rel) };
  }

  /**
   * Attaches `fullName` lookups for every CNIC referenced in the view (current owner + history).
   *
   * @param view - Serialized parcel view without name fields populated.
   */
  private async withOwnerNames(view: ParcelPublicView): Promise<ParcelPublicView> {
    const cnics = new Set<string>();
    cnics.add(view.currentOwnerCnic);
    for (const h of view.ownershipHistory) {
      cnics.add(h.ownerCnic);
    }
    const map = await loadFullNameMap([...cnics]);
    return {
      ...view,
      currentOwnerFullName: map.get(view.currentOwnerCnic) ?? null,
      ownershipHistory: view.ownershipHistory.map((h) => ({
        ...h,
        ownerFullName: map.get(h.ownerCnic) ?? null,
      })),
    };
  }
}

type ParcelLean = {
  _id: string;
  district: string;
  moza: string;
  plotNumber: string;
  khasra: string;
  currentOwnerCnic: string;
  disputed: boolean;
  ownershipHistory: Array<{
    ownerCnic: string;
    acquiredAt: string;
    transferId: string | null;
    note: string | null;
  }>;
  fardRelativePath: string | null;
  registryRelativePath: string | null;
  mutationRelativePath: string | null;
  createdAt: string;
  updatedAt: string;
};

function toPublic(doc: ParcelLean): ParcelPublicView {
  return {
    id: doc._id,
    district: doc.district,
    moza: doc.moza,
    plotNumber: doc.plotNumber,
    khasra: doc.khasra,
    currentOwnerCnic: doc.currentOwnerCnic,
    currentOwnerFullName: null,
    disputed: doc.disputed,
    ownershipHistory: doc.ownershipHistory.map((h) => ({
      ...h,
      ownerFullName: null,
    })),
    hasFard: Boolean(doc.fardRelativePath),
    hasRegistry: Boolean(doc.registryRelativePath),
    hasMutation: Boolean(doc.mutationRelativePath),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function loadFullNameMap(cnics: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!cnics.length) {
    return map;
  }
  const rows = await UserModel.find({ cnic: { $in: cnics } })
    .select({ cnic: 1, fullName: 1 })
    .lean();
  for (const r of rows as Array<{ cnic: string; fullName: string }>) {
    map.set(r.cnic, r.fullName);
  }
  return map;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
