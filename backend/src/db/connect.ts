import mongoose from "mongoose";

/**
 * Ensures a single shared Mongoose connection for the API process.
 *
 * @param uri - MongoDB connection string (e.g. `mongodb://127.0.0.1:27017/ledgerland`).
 */
export async function connectMongo(uri: string): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  await mongoose.connect(uri);
}

/**
 * Closes the Mongoose connection (primarily for tests and graceful shutdown).
 */
export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
