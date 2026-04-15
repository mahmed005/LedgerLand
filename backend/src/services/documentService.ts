import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

interface ParcelData {
  id: string;
  district: string;
  moza: string;
  plotNumber: string;
  khasra: string;
  currentOwnerCnic: string;
  disputed: boolean;
  ownershipHistory: Array<{
    ownerCnic: string;
    acquiredAt: string | Date;
    transferId: string | null;
    note: string;
  }>;
}

/**
 * Generate a PDF ownership certificate for a parcel.
 * Returns a readable stream that can be piped to an HTTP response.
 */
export function generateOwnershipCertificatePdf(parcel: ParcelData): PassThrough {
  const stream = new PassThrough();
  const doc = new PDFDocument({ margin: 60, size: "A4" });
  doc.pipe(stream);

  // ── Header ──────────────────────────────────────────
  doc
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("LedgerLand — Ownership Certificate", { align: "center" });
  doc.moveDown(0.5);
  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor("#666")
    .text("This certificate is generated for demonstration purposes.", { align: "center" });
  doc.moveDown(1.5);

  // ── Parcel Details ──────────────────────────────────
  doc.fillColor("#000").fontSize(14).font("Helvetica-Bold").text("Parcel Details");
  doc.moveDown(0.4);
  doc
    .fontSize(11)
    .font("Helvetica")
    .text(`Parcel ID:        ${parcel.id}`)
    .text(`District:         ${parcel.district}`)
    .text(`Moza (Mouza):     ${parcel.moza}`)
    .text(`Plot Number:      ${parcel.plotNumber}`)
    .text(`Khasra:           ${parcel.khasra || "—"}`)
    .text(`Current Owner:    ${parcel.currentOwnerCnic}`)
    .text(`Disputed:         ${parcel.disputed ? "YES ⚠️" : "No"}`);
  doc.moveDown(1.5);

  // ── Ownership History ───────────────────────────────
  doc.fontSize(14).font("Helvetica-Bold").text("Ownership History");
  doc.moveDown(0.4);

  if (parcel.ownershipHistory.length === 0) {
    doc.fontSize(11).font("Helvetica").text("No history entries.");
  } else {
    for (const entry of parcel.ownershipHistory) {
      const date =
        typeof entry.acquiredAt === "string"
          ? entry.acquiredAt
          : entry.acquiredAt.toISOString();
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .text(`Owner CNIC: ${entry.ownerCnic}`, { continued: false });
      doc
        .font("Helvetica")
        .text(`  Acquired: ${date}`)
        .text(`  Transfer: ${entry.transferId ?? "—"}`)
        .text(`  Note:     ${entry.note || "—"}`);
      doc.moveDown(0.5);
    }
  }

  // ── Footer ──────────────────────────────────────────
  doc.moveDown(2);
  doc
    .fontSize(9)
    .fillColor("#999")
    .text(`Generated on ${new Date().toISOString()} by LedgerLand.`, { align: "center" });

  doc.end();
  return stream;
}
