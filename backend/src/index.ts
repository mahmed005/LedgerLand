import { mkdir } from "node:fs/promises";
import { AuthService } from "./auth/authService.js";
import { MongoUserRepository } from "./auth/userRepository.js";
import { createApp } from "./app.js";
import {
  ADMIN_BOOTSTRAP_CNIC,
  ADMIN_BOOTSTRAP_PASSWORD,
  JUDGE_BOOTSTRAP_CNIC,
  JUDGE_BOOTSTRAP_PASSWORD,
  JWT_EXPIRES_SEC,
  JWT_SECRET,
  LEDGER_CONTRACT_ADDRESS,
  LEDGER_SIGNER_PRIVATE_KEY,
  MONGODB_URI,
  PORT,
  RPC_URL,
  UPLOADS_DIR,
} from "./config/env.js";
import { connectMongo } from "./db/connect.js";
import { UserModel } from "./models/User.js";
import { ParcelModel } from "./models/Parcel.js";
import { AuditLogModel } from "./models/AuditLog.js";
import { createEthLedgerFromEnv } from "./ledger/ethLedgerService.js";
import { ParcelService } from "./services/parcelService.js";
import { TransferService } from "./services/transferService.js";
import { AuditService } from "./services/auditService.js";
import { NotificationService } from "./services/notificationService.js";

/**
 * Connects to MongoDB, ensures upload directories exist, wires services, and starts HTTP.
 */
async function bootstrap(): Promise<void> {
  if (!LEDGER_CONTRACT_ADDRESS) {
    console.error(
      "LEDGER_CONTRACT_ADDRESS is not set and deployments/localhost.json was not found.\n" +
        "1) Terminal A: npm run node:chain\n" +
        "2) Terminal B: npm run compile:solidity && npm run deploy:local\n" +
        "3) Restart the API (deploy writes deployments/localhost.json).",
    );
    process.exit(1);
  }

  await mkdir(UPLOADS_DIR, { recursive: true });

  await connectMongo(MONGODB_URI);
  await UserModel.syncIndexes();
  await ParcelModel.syncIndexes();
  await AuditLogModel.syncIndexes();

  const ledger = createEthLedgerFromEnv(RPC_URL, LEDGER_CONTRACT_ADDRESS, LEDGER_SIGNER_PRIVATE_KEY);
  const userRepository = new MongoUserRepository();
  const authService = new AuthService(userRepository, {
    jwtSecret: JWT_SECRET,
    jwtExpiresSec: JWT_EXPIRES_SEC,
  });
  const auditService = new AuditService();
  const notificationService = new NotificationService(userRepository);

  await authService.registerBootstrapAdmin(ADMIN_BOOTSTRAP_CNIC, ADMIN_BOOTSTRAP_PASSWORD);
  await authService.registerBootstrapJudge(JUDGE_BOOTSTRAP_CNIC, JUDGE_BOOTSTRAP_PASSWORD);

  const parcelService = new ParcelService(UPLOADS_DIR);
  const transferService = new TransferService(ledger);

  const app = createApp({
    ledger,
    authService,
    parcelService,
    transferService,
    auditService,
    notificationService,
  });

  app.listen(PORT, () => {
    console.log(`LedgerLand API listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
