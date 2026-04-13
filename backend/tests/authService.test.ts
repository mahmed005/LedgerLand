/// <reference types="jest" />
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { AuthService } from "../src/auth/authService.js";
import { MongoUserRepository } from "../src/auth/userRepository.js";
import { connectMongo, disconnectMongo } from "../src/db/connect.js";
import { UserModel } from "../src/models/User.js";

const TEST_MONGO_URI =
  process.env.MONGODB_TEST_URI?.trim() || "mongodb://127.0.0.1:27017/ledgerland_test";

describe("AuthService (MongoDB, CNIC)", () => {
  beforeAll(async () => {
    await connectMongo(TEST_MONGO_URI);
    await UserModel.syncIndexes();
  });

  afterAll(async () => {
    await disconnectMongo();
  });

  beforeEach(async () => {
    await UserModel.deleteMany({});
  });

  afterEach(async () => {
    await UserModel.deleteMany({});
  });

  it("signup then login returns a JWT and public profile with CNIC (acceptance: login with CNIC)", async () => {
    const repo = new MongoUserRepository();
    const auth = new AuthService(repo, { jwtSecret: "test-secret", jwtExpiresSec: 3600 });
    await auth.signup({
      cnic: "35201-1111111-1",
      password: "password123",
      fullName: "Test User",
    });
    const { token, user } = await auth.login({
      cnic: "3520111111111",
      password: "password123",
    });
    expect(token.length).toBeGreaterThan(10);
    expect(user.cnic).toBe("3520111111111");
    const me = await auth.verifyAccessToken(token);
    expect(me.id).toBe(user.id);
  });

  it("signup rejects duplicate CNIC", async () => {
    const repo = new MongoUserRepository();
    const auth = new AuthService(repo, { jwtSecret: "test-secret", jwtExpiresSec: 3600 });
    await auth.signup({ cnic: "3520111111111", password: "password123", fullName: "A" });
    await expect(
      auth.signup({ cnic: "35201-1111111-1", password: "password123", fullName: "B" }),
    ).rejects.toThrow("CNIC_IN_USE");
  });

  it("signup rejects short passwords", async () => {
    const repo = new MongoUserRepository();
    const auth = new AuthService(repo, { jwtSecret: "test-secret", jwtExpiresSec: 3600 });
    await expect(
      auth.signup({ cnic: "3520222222222", password: "short", fullName: "A" }),
    ).rejects.toThrow("WEAK_PASSWORD");
  });

  it("login fails for unknown CNIC", async () => {
    const repo = new MongoUserRepository();
    const auth = new AuthService(repo, { jwtSecret: "test-secret", jwtExpiresSec: 3600 });
    await expect(
      auth.login({ cnic: "3520999999999", password: "password123" }),
    ).rejects.toThrow("INVALID_CREDENTIALS");
  });

  it("registerBootstrapAdmin creates admin once", async () => {
    const repo = new MongoUserRepository();
    const auth = new AuthService(repo, { jwtSecret: "test-secret", jwtExpiresSec: 3600 });
    await auth.registerBootstrapAdmin("3520333333333", "adminpass123", "Gov Admin");
    await auth.registerBootstrapAdmin("3520333333333", "adminpass123");
    const rows = await UserModel.countDocuments({ cnic: "3520333333333" });
    expect(rows).toBe(1);
    const u = await repo.findByCnic("3520333333333");
    expect(u?.role).toBe("admin");
  });
});
