import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ParcelModel } from "../models/Parcel.js";
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
}

export interface ParcelPublicView {
  id: string;
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
  hasFard: boolean;
  hasRegistry: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Parcel search, creation, and document path resolution.
 */
export class ParcelService {
  /**
   * @param uploadsDir - Absolute root where parcel document folders are stored.
   */
  constructor(private readonly uploadsDir: string) {}

  /**
   * Creates a parcel and optional Fard/registry text files on disk.
   *
   * @param input - Administrative parcel definition.
   * @returns Public parcel view.
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
    if (input.fardText !== undefined && input.fardText.length > 0) {
      fardRelativePath = path.join(id, "fard.txt");
      await writeFile(path.join(this.uploadsDir, fardRelativePath), input.fardText, "utf8");
    }
    if (input.registryText !== undefined && input.registryText.length > 0) {
      registryRelativePath = path.join(id, "registry.txt");
      await writeFile(path.join(this.uploadsDir, registryRelativePath), input.registryText, "utf8");
    }

    const history = [{ ownerCnic: owner, acquiredAt: now, transferId: null, note: "Initial record" }];

    await ParcelModel.create({
      _id: id,
      district: input.district.trim(),
      moza: input.moza.trim(),
      plotNumber: input.plotNumber.trim(),
      khasra: (input.khasra ?? "").trim(),
      currentOwnerCnic: owner,
      disputed: Boolean(input.disputed),
      ownershipHistory: history,
      fardRelativePath,
      registryRelativePath,
      createdAt: now,
      updatedAt: now,
    });

    const doc = await ParcelModel.findById(id).lean();
    if (!doc) {
      throw new Error("PARCEL_CREATE_FAILED");
    }
    return toPublic(JSON.parse(JSON.stringify(doc)) as ParcelLean);
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
    return docs.map((d) => toPublic(JSON.parse(JSON.stringify(d)) as ParcelLean));
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
    return toPublic(JSON.parse(JSON.stringify(doc)) as ParcelLean);
  }

  /**
   * Resolves an absolute path for a stored document, if configured.
   *
   * @param parcelId - Parcel id.
   * @param kind - Which document slot to resolve.
   */
  async resolveDocumentPath(
    parcelId: string,
    kind: "fard" | "registry",
  ): Promise<{ absolutePath: string } | null> {
    const doc = await ParcelModel.findById(parcelId).lean();
    if (!doc) {
      return null;
    }
    const rel =
      kind === "fard"
        ? (doc as ParcelLean).fardRelativePath
        : (doc as ParcelLean).registryRelativePath;
    if (!rel) {
      return null;
    }
    return { absolutePath: path.join(this.uploadsDir, rel) };
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
  ownershipHistory: ParcelPublicView["ownershipHistory"];
  fardRelativePath: string | null;
  registryRelativePath: string | null;
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
    disputed: doc.disputed,
    ownershipHistory: doc.ownershipHistory,
    hasFard: Boolean(doc.fardRelativePath),
    hasRegistry: Boolean(doc.registryRelativePath),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
