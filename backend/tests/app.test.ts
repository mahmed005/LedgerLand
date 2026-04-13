/// <reference types="jest" />
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import type { Contract } from "ethers";
import { ethers } from "hardhat";
import request from "supertest";
import { AuthService } from "../src/auth/authService.js";
import { MongoUserRepository } from "../src/auth/userRepository.js";
import { createApp } from "../src/app.js";
import { connectMongo, disconnectMongo } from "../src/db/connect.js";
import { UserModel } from "../src/models/User.js";
import { EthLedgerService } from "../src/ledger/ethLedgerService.js";
import { ParcelService } from "../src/services/parcelService.js";
import { TransferService } from "../src/services/transferService.js";
import { ParcelModel } from "../src/models/Parcel.js";
import { TransferModel } from "../src/models/Transfer.js";
import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const TEST_MONGO_URI =
  process.env.MONGODB_TEST_URI?.trim() || "mongodb://127.0.0.1:27017/ledgerland_test";

describe("HTTP API (core)", () => {
  let service: EthLedgerService;
  let uploadsDir: string;

  beforeAll(async () => {
    await connectMongo(TEST_MONGO_URI);
    await UserModel.syncIndexes();
    uploadsDir = path.join(os.tmpdir(), `ll-uploads-${Date.now()}`);
    await mkdir(uploadsDir, { recursive: true });

    const factory = await ethers.getContractFactory("LandLedger");
    const ledger = await factory.deploy();
    await ledger.waitForDeployment();
    const address = await ledger.getAddress();
    service = new EthLedgerService(ledger as unknown as Contract, address, ethers.provider);
  });

  afterAll(async () => {
    await disconnectMongo();
    await rm(uploadsDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await UserModel.deleteMany({});
    await ParcelModel.deleteMany({});
    await TransferModel.deleteMany({});
  });

  function buildApp() {
    const repo = new MongoUserRepository();
    const authService = new AuthService(repo, { jwtSecret: "integration-secret", jwtExpiresSec: 3600 });
    const parcelService = new ParcelService(uploadsDir);
    const transferService = new TransferService(service);
    return createApp({ ledger: service, authService, parcelService, transferService });
  }

  it("health responds ok", async () => {
    const app = buildApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("signup, login, and /me return consistent user with CNIC", async () => {
    const app = buildApp();
    const signup = await request(app).post("/api/auth/signup").send({
      cnic: "3520111111111",
      password: "password123",
      fullName: "Citizen",
    });
    expect(signup.status).toBe(201);
    const login = await request(app).post("/api/auth/login").send({
      cnic: "3520111111111",
      password: "password123",
    });
    expect(login.status).toBe(200);
    const token = login.body.token as string;
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.cnic).toBe("3520111111111");
  });

  it("blockchain append requires auth and increases record count", async () => {
    const app = buildApp();

    await request(app).post("/api/auth/signup").send({
      cnic: "3520222222222",
      password: "password123",
      fullName: "E",
    });
    const token = (
      await request(app).post("/api/auth/login").send({
        cnic: "3520222222222",
        password: "password123",
      })
    ).body.token as string;

    const before = (await service.listRecords()).length;
    const res = await request(app)
      .post("/api/blockchain/blocks")
      .set("Authorization", `Bearer ${token}`)
      .send({ data: { note: "audit entry" } });
    expect(res.status).toBe(201);
    expect((await service.listRecords()).length).toBe(before + 1);
  });
});
