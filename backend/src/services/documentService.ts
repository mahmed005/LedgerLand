import PDFDocument from "pdfkit";
import type { ParcelPublicView } from "./parcelService.js";

/**
 * Builds a court/bank style ownership certificate as a PDF buffer.
 *
 * @param parcel - Public parcel projection including ownership history.
 * @returns PDF bytes.
 */
export function buildOwnershipCertificatePdf(parcel: ParcelPublicView): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("LedgerLand — Ownership Certificate", { align: "center" });
    doc.moveDown();
    doc.fontSize(11).text(`Parcel ID: ${parcel.id}`);
    doc.text(`District: ${parcel.district}`);
    doc.text(`Moza: ${parcel.moza}`);
    doc.text(`Plot number: ${parcel.plotNumber}`);
    if (parcel.khasra) {
      doc.text(`Khasra: ${parcel.khasra}`);
    }
    doc.text(`Disputed flag: ${parcel.disputed ? "YES" : "NO"}`);
    doc.moveDown();
    doc.fontSize(12).text("Current owner (CNIC)", { underline: true });
    doc.fontSize(11).text(parcel.currentOwnerCnic);
    doc.moveDown();
    doc.fontSize(12).text("Ownership history (oldest → newest)", { underline: true });
    parcel.ownershipHistory.forEach((h, i) => {
      doc
        .fontSize(10)
        .text(
          `${i + 1}. CNIC ${h.ownerCnic} — acquired ${h.acquiredAt}${h.note ? ` (${h.note})` : ""}`,
        );
    });
    doc.moveDown();
    doc.fontSize(9).text(
      "This MVP certificate is generated for demonstration. It is not a government-issued document.",
      { align: "center" },
    );
    doc.end();
  });
}
