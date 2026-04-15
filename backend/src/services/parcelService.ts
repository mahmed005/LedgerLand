import fs from "fs";
import path from "path";
import { Parcel, IParcel } from "../models/Parcel.js";
import { User } from "../models/User.js";
import { normalizeCnic, isValidCnic } from "../utils/cnic.js";

const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || "./uploads");

/**
 * Search parcels with AND logic. Text fields use case-insensitive partial matching.
 * ownerCnic is normalized to 13 digits and matched exactly.
 * Returns `{ found, message?, parcels }`.
 *
 * @param authenticated If true, returns full CNICs. If false, CNICs are redacted (KAN-26).
 */
export async function search(
  filters: {
    district?: string;
    moza?: string;
    plotNumber?: string;
    ownerCnic?: string;
  },
  authenticated = false
) {
  const query: Record<string, unknown> = {};
  let hasFilter = false;

  if (filters.district?.trim()) {
    query.district = { $regex: filters.district.trim(), $options: "i" };
    hasFilter = true;
  }
  if (filters.moza?.trim()) {
    query.moza = { $regex: filters.moza.trim(), $options: "i" };
    hasFilter = true;
  }
  if (filters.plotNumber?.trim()) {
    query.plotNumber = { $regex: filters.plotNumber.trim(), $options: "i" };
    hasFilter = true;
  }
  if (filters.ownerCnic?.trim()) {
    const normalized = normalizeCnic(filters.ownerCnic);
    if (isValidCnic(normalized)) {
      query.currentOwnerCnic = normalized;
      hasFilter = true;
    }
    // Invalid CNIC after normalization → silently ignored (spec)
  }

  if (!hasFilter) {
    return { found: false, message: "No record found.", parcels: [] };
  }

  const parcels = await Parcel.find(query).lean();
  if (parcels.length === 0) {
    return { found: false, message: "No record found.", parcels: [] };
  }

  // Resolve owner names (KAN-3)
  const formattedParcels = await Promise.all(
    parcels.map((p) => formatParcelWithOwner(p, authenticated))
  );

  return {
    found: true,
    parcels: formattedParcels,
  };
}

/**
 * Get a single parcel by its UUID.
 * @param authenticated If true, returns full CNICs. If false, CNICs are redacted (KAN-26).
 */
export async function getById(id: string, authenticated = false) {
  const parcel = await Parcel.findById(id).lean();
  if (!parcel) return null;
  return formatParcelWithOwner(parcel, authenticated);
}

/**
 * Create a new parcel (admin). Optionally stores fard/registry/mutation text files.
 */
export async function createParcel(data: {
  district: string;
  moza: string;
  plotNumber: string;
  currentOwnerCnic: string;
  khasra?: string;
  disputed?: boolean;
  fardText?: string;
  registryText?: string;
  mutationText?: string;
}) {
  const normalized = normalizeCnic(data.currentOwnerCnic);
  if (!isValidCnic(normalized)) {
    throw { status: 400, error: "currentOwnerCnic must be 13 digits." };
  }

  const parcel = await Parcel.create({
    district: data.district.trim(),
    moza: data.moza.trim(),
    plotNumber: data.plotNumber.trim(),
    khasra: data.khasra?.trim() || "",
    currentOwnerCnic: normalized,
    disputed: data.disputed ?? false,
    ownershipHistory: [
      {
        ownerCnic: normalized,
        acquiredAt: new Date(),
        transferId: null,
        note: "Initial record",
      },
    ],
    hasFard: !!data.fardText,
    hasRegistry: !!data.registryText,
    hasMutation: !!data.mutationText,
  });

  // Write text files to uploads directory
  if (data.fardText || data.registryText || data.mutationText) {
    const parcelDir = path.join(UPLOADS_DIR, String(parcel._id));
    fs.mkdirSync(parcelDir, { recursive: true });

    if (data.fardText) {
      fs.writeFileSync(path.join(parcelDir, "fard.txt"), data.fardText, "utf-8");
    }
    if (data.registryText) {
      fs.writeFileSync(path.join(parcelDir, "registry.txt"), data.registryText, "utf-8");
    }
    if (data.mutationText) {
      fs.writeFileSync(path.join(parcelDir, "mutation.txt"), data.mutationText, "utf-8");
    }
  }

  return formatParcel(parcel.toJSON());
}

/**
 * Update the disputed flag on an existing parcel (KAN-20).
 * @throws {Object} `{ status, error }` if parcel not found.
 */
export async function updateParcelDisputed(parcelId: string, disputed: boolean) {
  const parcel = await Parcel.findById(parcelId);
  if (!parcel) {
    throw { status: 404, error: "Parcel not found." };
  }

  parcel.disputed = disputed;
  await parcel.save();
  return formatParcel(parcel.toJSON());
}

/**
 * Handle citizen document upload (KAN-11).
 * Stores the uploaded file in the parcel's uploads directory.
 * @param parcelId The parcel to attach the document to
 * @param docType One of 'fard', 'registry', or 'mutation'
 * @param filePath The temporary file path from multer
 */
export async function uploadCitizenDocument(
  parcelId: string,
  docType: "fard" | "registry" | "mutation",
  filePath: string
) {
  const parcel = await Parcel.findById(parcelId);
  if (!parcel) {
    throw { status: 404, error: "Parcel not found." };
  }

  const parcelDir = path.join(UPLOADS_DIR, parcelId);
  fs.mkdirSync(parcelDir, { recursive: true });

  const destPath = path.join(parcelDir, `${docType}.txt`);
  fs.copyFileSync(filePath, destPath);

  // Clean up temp file
  try {
    fs.unlinkSync(filePath);
  } catch {
    // ignore cleanup errors
  }

  // Update flags
  if (docType === "fard") parcel.hasFard = true;
  else if (docType === "registry") parcel.hasRegistry = true;
  else if (docType === "mutation") parcel.hasMutation = true;

  await parcel.save();
  return formatParcel(parcel.toJSON());
}

/**
 * Get the filesystem path for a parcel document (fard, registry, or mutation).
 * Returns the path string, or null if the file doesn't exist.
 */
export function getDocumentPath(
  parcelId: string,
  docType: "fard" | "registry" | "mutation"
): string | null {
  const filePath = path.join(UPLOADS_DIR, parcelId, `${docType}.txt`);
  return fs.existsSync(filePath) ? filePath : null;
}

/** Normalize Mongoose lean doc to the public API shape. */
function formatParcel(doc: Record<string, unknown>) {
  return {
    id: (doc.id ?? doc._id) as string,
    district: doc.district,
    moza: doc.moza,
    plotNumber: doc.plotNumber,
    khasra: doc.khasra ?? "",
    currentOwnerCnic: doc.currentOwnerCnic,
    currentOwnerName: doc.currentOwnerName ?? null,
    disputed: doc.disputed ?? false,
    ownershipHistory: doc.ownershipHistory ?? [],
    hasFard: doc.hasFard ?? false,
    hasRegistry: doc.hasRegistry ?? false,
    hasMutation: doc.hasMutation ?? false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Format a parcel and resolve the owner's full name from the User model (KAN-3).
 * Optionally redact CNICs for unauthenticated users (KAN-26).
 */
async function formatParcelWithOwner(
  doc: Record<string, unknown>,
  authenticated: boolean
) {
  const ownerCnic = doc.currentOwnerCnic as string;

  // Resolve owner name (KAN-3)
  let ownerName: string | null = null;
  if (ownerCnic) {
    const owner = await User.findOne({ cnic: ownerCnic }).lean();
    if (owner) {
      ownerName = owner.fullName;
    }
  }

  const formatted = formatParcel({ ...doc, currentOwnerName: ownerName });

  if (!authenticated) {
    // Redact CNICs for anonymous users (KAN-26)
    formatted.currentOwnerCnic = redactCnic(ownerCnic);

    // Redact CNICs in ownership history
    if (Array.isArray(formatted.ownershipHistory)) {
      formatted.ownershipHistory = (
        formatted.ownershipHistory as Array<Record<string, unknown>>
      ).map((entry) => ({
        ...entry,
        ownerCnic: redactCnic(entry.ownerCnic as string),
      }));
    }
  }

  return formatted;
}

/**
 * Mask a CNIC: show first 5 and last digit, mask the rest.
 * e.g. "3520111111111" → "35201*******1"
 */
function redactCnic(cnic: string): string {
  if (!cnic || cnic.length < 6) return "***";
  return cnic.slice(0, 5) + "*".repeat(cnic.length - 6) + cnic.slice(-1);
}
