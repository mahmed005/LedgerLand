/// <reference types="jest" />
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import type { Contract } from "ethers";
import { ethers } from "hardhat";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { AuthService } from "../src/auth/authService.js";
import { MongoUserRepository } from "../src/auth/userRepository.js";
import { createApp } from "../src/app.js";
import { connectMongo, disconnectMongo } from "../src/db/connect.js";
import { UserModel } from "../src/models/User.js";
import { ParcelModel } from "../src/models/Parcel.js";
import { TransferModel } from "../src/models/Transfer.js";
import { AuditLogModel } from "../src/models/AuditLog.js";
import { EthLedgerService } from "../src/ledger/ethLedgerService.js";
import { ParcelService } from "../src/services/parcelService.js";
import { TransferService } from "../src/services/transferService.js";

const TEST_MONGO_URI =
  process.env.MONGODB_TEST_URI?.trim() || "mongodb://127.0.0.1:27017/ledgerland_test";

const CNIC_SELLER = "3520111111111";
const CNIC_BUYER = "3520222222222";
const CNIC_ADMIN = "3520999999999";
const CNIC_JUDGE = "3520888888888";

describe("Extended domain features", () => {
  let ledger: EthLedgerService;
  let uploadsDir: string;

  beforeAll(async () => {
    await connectMongo(TEST_MONGO_URI);
    await UserModel.syncIndexes();
    await ParcelModel.syncIndexes();
    await AuditLogModel.syncIndexes();
    uploadsDir = path.join(os.tmpdir(), `ll-ext-${Date.now()}`);
    await mkdir(uploadsDir, { recursive: true });

    const factory = await ethers.getContractFactory("LandLedger");
    const c = await factory.deploy();
    await c.waitForDeployment();
    const address = await c.getAddress();
    ledger = new EthLedgerService(c as unknown as Contract, address, ethers.provider);
  });

  afterAll(async () => {
    await disconnectMongo();
    await rm(uploadsDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await UserModel.deleteMany({});
    await ParcelModel.deleteMany({});
    await TransferModel.deleteMany({});
    await AuditLogModel.deleteMany({});
  });

  async function seedUsers() {
    const hashAdmin = await bcrypt.hash("AdminPass123", 10);
    const hashJudge = await bcrypt.hash("JudgePass123", 10);
    await UserModel.create({
      _id: randomUUID(),
      cnic: CNIC_ADMIN,
      passwordHash: hashAdmin,
      fullName: "Patwari Admin",
      role: "admin",
      createdAt: new Date().toISOString(),
    });
    await UserModel.create({
      _id: randomUUID(),
      cnic: CNIC_JUDGE,
      passwordHash: hashJudge,
      fullName: "Judge User",
      role: "judge",
      createdAt: new Date().toISOString(),
    });
    const repo = new MongoUserRepository();
    const auth = new AuthService(repo, { jwtSecret: "ext-secret", jwtExpiresSec: 3600 });
    await auth.signup({
      cnic: CNIC_SELLER,
      password: "SellerPass123",
      fullName: "Seller Person",
      email: "seller@example.com",
    });
    await auth.signup({ cnic: CNIC_BUYER, password: "BuyerPass123", fullName: "Buyer Person" });
  }

  function buildApp() {
    const repo = new MongoUserRepository();
    const authService = new AuthService(repo, { jwtSecret: "ext-secret", jwtExpiresSec: 3600 });
    const parcelService = new ParcelService(uploadsDir);
    const transferService = new TransferService(ledger);
    return createApp({ ledger, authService, parcelService, transferService });
  }

  it("parcel detail resolves currentOwnerFullName when owner is registered", async () => {
    await seedUsers();
    const app = buildApp();
    const adminTok = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_ADMIN,
      password: "AdminPass123",
    })).body.token as string;
    const created = await request(app)
      .post("/api/admin/parcels")
      .set("Authorization", `Bearer ${adminTok}`)
      .send({
        district: "Lahore",
        moza: "Test",
        plotNumber: "X-1",
        currentOwnerCnic: CNIC_SELLER,
      });
    const parcelId = created.body.parcel.id as string;
    const detail = await request(app)
      .get(`/api/parcels/${parcelId}`)
      .set("Authorization", `Bearer ${adminTok}`);
    expect(detail.status).toBe(200);
    expect(detail.body.parcel.currentOwnerFullName).toBe("Seller Person");
    expect(detail.body.parcel.ownershipHistory[0].ownerFullName).toBe("Seller Person");
  });

  it("NADRA failure path leaves owner unchanged and marks transfer nadra_failed", async () => {
    await seedUsers();
    const app = buildApp();
    const adminTok = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_ADMIN,
      password: "AdminPass123",
    })).body.token as string;
    const created = await request(app)
      .post("/api/admin/parcels")
      .set("Authorization", `Bearer ${adminTok}`)
      .send({
        district: "A",
        moza: "B",
        plotNumber: "C",
        currentOwnerCnic: CNIC_SELLER,
      });
    const parcelId = created.body.parcel.id as string;
    const sellerTok = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_SELLER,
      password: "SellerPass123",
    })).body.token as string;
    const start = await request(app)
      .post("/api/transfers")
      .set("Authorization", `Bearer ${sellerTok}`)
      .send({ parcelId, buyerCnic: CNIC_BUYER });
    const transferId = start.body.transferId as string;
    const buyerTok = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_BUYER,
      password: "BuyerPass123",
    })).body.token as string;
    await request(app)
      .post(`/api/transfers/${transferId}/buyer-approve`)
      .set("Authorization", `Bearer ${buyerTok}`);
    const fail = await request(app)
      .post(`/api/transfers/${transferId}/simulate-nadra`)
      .set("Authorization", `Bearer ${buyerTok}`)
      .send({ verified: false });
    expect(fail.status).toBe(200);
    expect(fail.body.status).toBe("nadra_failed");
    expect(fail.body.transactionHash).toBeNull();
    const detail = await request(app)
      .get(`/api/parcels/${parcelId}`)
      .set("Authorization", `Bearer ${sellerTok}`);
    expect(detail.body.parcel.currentOwnerCnic).toBe(CNIC_SELLER);
  });

  it("admin can PATCH disputed on an existing parcel", async () => {
    await seedUsers();
    const app = buildApp();
    const adminTok = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_ADMIN,
      password: "AdminPass123",
    })).body.token as string;
    const created = await request(app)
      .post("/api/admin/parcels")
      .set("Authorization", `Bearer ${adminTok}`)
      .send({
        district: "D",
        moza: "E",
        plotNumber: "F",
        currentOwnerCnic: CNIC_SELLER,
        disputed: false,
      });
    const parcelId = created.body.parcel.id as string;
    const patch = await request(app)
      .patch(`/api/admin/parcels/${parcelId}`)
      .set("Authorization", `Bearer ${adminTok}`)
      .send({ disputed: true });
    expect(patch.status).toBe(200);
    expect(patch.body.parcel.disputed).toBe(true);
  });

  it("current owner can upload mutation text via citizen route", async () => {
    await seedUsers();
    const app = buildApp();
    const adminTok = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_ADMIN,
      password: "AdminPass123",
    })).body.token as string;
    const created = await request(app)
      .post("/api/admin/parcels")
      .set("Authorization", `Bearer ${adminTok}`)
      .send({
        district: "G",
        moza: "H",
        plotNumber: "I",
        currentOwnerCnic: CNIC_SELLER,
      });
    const parcelId = created.body.parcel.id as string;
    const sellerTok = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_SELLER,
      password: "SellerPass123",
    })).body.token as string;
    const up = await request(app)
      .post(`/api/citizen/parcels/${parcelId}/documents`)
      .set("Authorization", `Bearer ${sellerTok}`)
      .send({ kind: "mutation", text: "Mutation body content" });
    expect(up.status).toBe(201);
    expect(up.body.parcel.hasMutation).toBe(true);
    const dl = await request(app)
      .get(`/api/parcels/${parcelId}/documents/mutation`)
      .set("Authorization", `Bearer ${sellerTok}`);
    expect(dl.status).toBe(200);
    expect(dl.text).toContain("Mutation body");
  });

  it("judge JWT can search parcels via court API", async () => {
    await seedUsers();
    const app = buildApp();
    const adminTok = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_ADMIN,
      password: "AdminPass123",
    })).body.token as string;
    await request(app)
      .post("/api/admin/parcels")
      .set("Authorization", `Bearer ${adminTok}`)
      .send({
        district: "CourtDist",
        moza: "M",
        plotNumber: "P",
        currentOwnerCnic: CNIC_SELLER,
      });
    const judgeTok = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_JUDGE,
      password: "JudgePass123",
    })).body.token as string;
    const res = await request(app)
      .get("/api/court/parcels/search?district=CourtDist")
      .set("Authorization", `Bearer ${judgeTok}`);
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(true);
    expect(res.body.parcels.length).toBeGreaterThanOrEqual(1);
  });

  it("records auth.login audit entry on successful login", async () => {
    await seedUsers();
    const app = buildApp();
    await request(app).post("/api/auth/login").send({
      cnic: CNIC_SELLER,
      password: "SellerPass123",
    });
    const rows = await AuditLogModel.find({ action: "auth.login" });
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});
