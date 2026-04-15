import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || "noreply@ledgerland.pk";

/**
 * Initialise the SMTP transporter.
 * If SMTP_HOST is not configured, creates an Ethereal test account (dev mode).
 */
export async function initNotifications(): Promise<void> {
  if (SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    console.log(`[notify] SMTP configured via ${SMTP_HOST}:${SMTP_PORT}`);
  } else {
    // Create an Ethereal test account for development
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      console.log(
        `[notify] Dev mode — Ethereal account: ${testAccount.user}`
      );
      console.log(
        `[notify] View sent emails at: https://ethereal.email/login`
      );
    } catch {
      console.warn(
        "[notify] Could not create Ethereal account. Notifications disabled."
      );
    }
  }
}

/**
 * Send an email notification. Fails silently — never throws.
 * @returns `true` if sent successfully, `false` otherwise.
 */
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<boolean> {
  if (!transporter) {
    console.warn("[notify] No transporter configured. Skipping email.");
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text,
      html: html || text,
    });

    // In dev mode, log the Ethereal preview URL
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[notify] Preview URL: ${previewUrl}`);
    }

    console.log(`[notify] Email sent to ${to}: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[notify] Failed to send email to ${to}:`, err);
    return false;
  }
}

/**
 * Notify a land owner that a transfer has been initiated on their property.
 * KAN-22: Fraud prevention notification.
 */
export async function notifyOwnerOnTransferInitiated(
  ownerEmail: string | null | undefined,
  ownerFullName: string,
  parcelId: string,
  buyerCnic: string
): Promise<boolean> {
  if (!ownerEmail) {
    console.warn(
      `[notify] Owner ${ownerFullName} has no email on file. Cannot send transfer notification.`
    );
    return false;
  }

  const subject = "⚠️ LedgerLand — Transfer Initiated on Your Property";
  const text = [
    `Dear ${ownerFullName},`,
    "",
    `A land transfer has been initiated on your property (Parcel ID: ${parcelId}).`,
    `Buyer CNIC: ${buyerCnic}`,
    "",
    "If you did not initiate this transfer, please contact the land registry office immediately.",
    "",
    "— LedgerLand System",
  ].join("\n");

  const html = `
    <h2>⚠️ Transfer Initiated on Your Property</h2>
    <p>Dear <strong>${ownerFullName}</strong>,</p>
    <p>A land transfer has been initiated on your property:</p>
    <ul>
      <li><strong>Parcel ID:</strong> ${parcelId}</li>
      <li><strong>Buyer CNIC:</strong> ${buyerCnic}</li>
    </ul>
    <p style="color: #c0392b;"><strong>If you did not initiate this transfer, please contact the land registry office immediately.</strong></p>
    <hr>
    <p style="color: #999; font-size: 12px;">— LedgerLand System</p>
  `;

  return sendEmail(ownerEmail, subject, text, html);
}
