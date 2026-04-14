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
import { EthLedgerService } from "../src/ledger/ethLedgerService.js";
import { ParcelService } from "../src/services/parcelService.js";
import { TransferService } from "../src/services/transferService.js";
import { REDACTED_CNIC_PLACEHOLDER } from "../src/utils/parcelRbac.js";

const TEST_MONGO_URI =
  process.env.MONGODB_TEST_URI?.trim() || "mongodb://127.0.0.1:27017/ledgerland_test";

const CNIC_A = "3520111111111";
const CNIC_B = "3520222222222";
const CNIC_ADMIN = "3520999999999";

describe("Parcel RBAC (KAN-26)", () => {
  let ledger: EthLedgerService;
  let uploadsDir: string;

  beforeAll(async () => {
    await connectMongo(TEST_MONGO_URI);
    await UserModel.syncIndexes();
    await ParcelModel.syncIndexes();
    uploadsDir = path.join(os.tmpdir(), `ll-rbac-${Date.now()}`);
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
  });

  async function seed() {
    const hash = await bcrypt.hash("AdminPass123", 10);
    await UserModel.create({
      _id: randomUUID(),
      cnic: CNIC_ADMIN,
      passwordHash: hash,
      fullName: "Admin",
      role: "admin",
      createdAt: new Date().toISOString(),
    });
    const repo = new MongoUserRepository();
    const auth = new AuthService(repo, { jwtSecret: "rbac-secret", jwtExpiresSec: 3600 });
    await auth.signup({ cnic: CNIC_A, password: "Pass12345", fullName: "Owner A" });
    await auth.signup({ cnic: CNIC_B, password: "Pass12345", fullName: "Person B" });
  }

  function buildApp() {
    const repo = new MongoUserRepository();
    const authService = new AuthService(repo, { jwtSecret: "rbac-secret", jwtExpiresSec: 3600 });
    return createApp({
      ledger,
      authService,
      parcelService: new ParcelService(uploadsDir),
      transferService: new TransferService(ledger),
    });
  }

  it("anonymous search by location returns parcels with redacted CNIC and names", async () => {
    await seed();
    const app = buildApp();
    const adminTok = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_ADMIN,
      password: "AdminPass123",
    })).body.token as string;
    await request(app)
      .post("/api/admin/parcels")
      .set("Authorization", `Bearer ${adminTok}`)
      .send({
        district: "TestDist",
        moza: "M",
        plotNumber: "P1",
        currentOwnerCnic: CNIC_A,
      });
    const res = await request(app).get("/api/parcels/search?district=TestDist");
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(true);
    expect(res.body.parcels[0].currentOwnerCnic).toBe(REDACTED_CNIC_PLACEHOLDER);
    expect(res.body.parcels[0].sensitiveDataRedacted).toBe(true);
    expect(res.body.parcels[0].currentOwnerFullName).toBeNull();
  });

  it("anonymous ownerCnic search returns 401", async () => {
    await seed();
    const app = buildApp();
    const res = await request(app).get(`/api/parcels/search?ownerCnic=${CNIC_A}`);
    expect(res.status).toBe(401);
  });

  it("citizen cannot search by another owners CNIC (403)", async () => {
    await seed();
    const app = buildApp();
    const tokB = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_B,
      password: "Pass12345",
    })).body.token as string;
    const res = await request(app)
      .get(`/api/parcels/search?ownerCnic=${CNIC_A}`)
      .set("Authorization", `Bearer ${tokB}`);
    expect(res.status).toBe(403);
  });

  it("citizen may search by own CNIC and sees full sensitive data for matching parcels", async () => {
    await seed();
    const app = buildApp();
    const adminTok = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_ADMIN,
      password: "AdminPass123",
    })).body.token as string;
    await request(app)
      .post("/api/admin/parcels")
      .set("Authorization", `Bearer ${adminTok}`)
      .send({
        district: "OwnSearch",
        moza: "M",
        plotNumber: "P2",
        currentOwnerCnic: CNIC_A,
      });
    const tokA = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_A,
      password: "Pass12345",
    })).body.token as string;
    const res = await request(app)
      .get(`/api/parcels/search?ownerCnic=${CNIC_A}`)
      .set("Authorization", `Bearer ${tokA}`);
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(true);
    expect(res.body.parcels[0].currentOwnerCnic).toBe(CNIC_A);
    expect(res.body.parcels[0].sensitiveDataRedacted).toBeUndefined();
  });

  it("document download without JWT returns 401", async () => {
    await seed();
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
        currentOwnerCnic: CNIC_A,
        fardText: "secret fard",
      });
    const parcelId = created.body.parcel.id as string;
    const res = await request(app).get(`/api/parcels/${parcelId}/documents/fard`);
    expect(res.status).toBe(401);
  });

  it("authenticated citizen not tied to parcel gets 403 on document download", async () => {
    await seed();
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
        plotNumber: "G",
        currentOwnerCnic: CNIC_A,
        fardText: "secret fard",
      });
    const parcelId = created.body.parcel.id as string;
    const tokB = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_B,
      password: "Pass12345",
    })).body.token as string;
    const res = await request(app)
      .get(`/api/parcels/${parcelId}/documents/fard`)
      .set("Authorization", `Bearer ${tokB}`);
    expect(res.status).toBe(403);
  });

  it("current owner can download fard with JWT", async () => {
    await seed();
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
        plotNumber: "H",
        currentOwnerCnic: CNIC_A,
        fardText: "secret fard",
      });
    const parcelId = created.body.parcel.id as string;
    const tokA = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_A,
      password: "Pass12345",
    })).body.token as string;
    const res = await request(app)
      .get(`/api/parcels/${parcelId}/documents/fard`)
      .set("Authorization", `Bearer ${tokA}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain("secret fard");
  });
});
