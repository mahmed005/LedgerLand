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
import { EthLedgerService } from "../src/ledger/ethLedgerService.js";
import { ParcelService } from "../src/services/parcelService.js";
import { TransferService } from "../src/services/transferService.js";

const TEST_MONGO_URI =
  process.env.MONGODB_TEST_URI?.trim() || "mongodb://127.0.0.1:27017/ledgerland_test";

const CNIC_SELLER = "3520111111111";
const CNIC_BUYER = "3520222222222";
const CNIC_ADMIN = "3520999999999";

/**
 * Stakeholder MVP acceptance (interview 2026-04-12):
 * - View/search records + full history; clear message when none.
 * - Transfer with simulated NADRA + on-chain record.
 * - Download Fard, registry, ownership certificate PDF.
 */
describe("MVP acceptance (product owner criteria)", () => {
  let ledger: EthLedgerService;
  let uploadsDir: string;

  beforeAll(async () => {
    await connectMongo(TEST_MONGO_URI);
    await UserModel.syncIndexes();
    uploadsDir = path.join(os.tmpdir(), `ll-mvp-${Date.now()}`);
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
  });

  async function seedAdminAndUsers() {
    const hash = await bcrypt.hash("AdminPass123", 10);
    await UserModel.create({
      _id: randomUUID(),
      cnic: CNIC_ADMIN,
      passwordHash: hash,
      fullName: "Patwari Admin",
      role: "admin",
      createdAt: new Date().toISOString(),
    });
    const repo = new MongoUserRepository();
    const auth = new AuthService(repo, { jwtSecret: "mvp-secret", jwtExpiresSec: 3600 });
    await auth.signup({ cnic: CNIC_SELLER, password: "SellerPass123", fullName: "Seller" });
    await auth.signup({ cnic: CNIC_BUYER, password: "BuyerPass123", fullName: "Buyer" });
  }

  function buildApp() {
    const repo = new MongoUserRepository();
    const authService = new AuthService(repo, { jwtSecret: "mvp-secret", jwtExpiresSec: 3600 });
    const parcelService = new ParcelService(uploadsDir);
    const transferService = new TransferService(ledger);
    return createApp({ ledger, authService, parcelService, transferService });
  }

  it("AC: citizen registers and logs in with CNIC", async () => {
    const app = buildApp();
    const reg = await request(app).post("/api/auth/signup").send({
      cnic: CNIC_SELLER,
      password: "SellerPass123",
      fullName: "Seller",
    });
    expect(reg.status).toBe(201);
    const login = await request(app).post("/api/auth/login").send({
      cnic: CNIC_SELLER,
      password: "SellerPass123",
    });
    expect(login.status).toBe(200);
    expect(login.body.user.cnic).toBe(CNIC_SELLER);
  });

  it("AC: search with no filters returns explicit no-record message", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/parcels/search");
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(false);
    expect(res.body.message).toBe("No record found.");
  });

  it("AC: search by district/moza/plot returns parcel; unknown search says no record", async () => {
    await seedAdminAndUsers();
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
        moza: "Ravi",
        plotNumber: "P-42",
        currentOwnerCnic: CNIC_SELLER,
        disputed: false,
        fardText: "Fard body",
        registryText: "Registry body",
      });
    expect(created.status).toBe(201);
    const parcelId = created.body.parcel.id as string;

    const hit = await request(app).get(
      "/api/parcels/search?district=Lahore&moza=Ravi&plotNumber=P-42",
    );
    expect(hit.status).toBe(200);
    expect(hit.body.found).toBe(true);
    expect(hit.body.parcels[0].id).toBe(parcelId);
    expect(hit.body.parcels[0].sensitiveDataRedacted).toBe(true);

    const miss = await request(app).get("/api/parcels/search?district=Nowhere");
    expect(miss.status).toBe(200);
    expect(miss.body.found).toBe(false);
    expect(miss.body.message).toBe("No record found.");
  });

  it("AC: parcel detail shows full ownership history and disputed flag", async () => {
    await seedAdminAndUsers();
    const app = buildApp();
    const adminTok = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_ADMIN,
      password: "AdminPass123",
    })).body.token as string;
    const created = await request(app)
      .post("/api/admin/parcels")
      .set("Authorization", `Bearer ${adminTok}`)
      .send({
        district: "Islamabad",
        moza: "Sihala",
        plotNumber: "A-1",
        currentOwnerCnic: CNIC_SELLER,
        disputed: true,
      });
    const parcelId = created.body.parcel.id as string;
    const detail = await request(app)
      .get(`/api/parcels/${parcelId}`)
      .set("Authorization", `Bearer ${adminTok}`);
    expect(detail.status).toBe(200);
    expect(detail.body.parcel.disputed).toBe(true);
    expect(detail.body.parcel.ownershipHistory.length).toBeGreaterThanOrEqual(1);
    expect(detail.body.parcel.currentOwnerCnic).toBe(CNIC_SELLER);
  });

  it("AC: search by owner CNIC returns parcels for that owner", async () => {
    await seedAdminAndUsers();
    const app = buildApp();
    const adminTok = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_ADMIN,
      password: "AdminPass123",
    })).body.token as string;
    await request(app)
      .post("/api/admin/parcels")
      .set("Authorization", `Bearer ${adminTok}`)
      .send({
        district: "Karachi",
        moza: "Gadap",
        plotNumber: "K-9",
        currentOwnerCnic: CNIC_SELLER,
      });
    const byOwner = await request(app)
      .get(`/api/parcels/search?ownerCnic=${CNIC_SELLER}`)
      .set("Authorization", `Bearer ${adminTok}`);
    expect(byOwner.status).toBe(200);
    expect(byOwner.body.found).toBe(true);
    expect(byOwner.body.parcels.length).toBeGreaterThanOrEqual(1);
  });

  it("AC: download Fard and registry; ownership certificate is PDF", async () => {
    await seedAdminAndUsers();
    const app = buildApp();
    const adminTok = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_ADMIN,
      password: "AdminPass123",
    })).body.token as string;
    const created = await request(app)
      .post("/api/admin/parcels")
      .set("Authorization", `Bearer ${adminTok}`)
      .send({
        district: "Multan",
        moza: "Shah Rukn",
        plotNumber: "M-1",
        currentOwnerCnic: CNIC_SELLER,
        fardText: "Fard content line",
        registryText: "Registry content line",
      });
    const parcelId = created.body.parcel.id as string;

    const fard = await request(app)
      .get(`/api/parcels/${parcelId}/documents/fard`)
      .set("Authorization", `Bearer ${adminTok}`);
    expect(fard.status).toBe(200);
    expect(fard.text).toContain("Fard content");

    const reg = await request(app)
      .get(`/api/parcels/${parcelId}/documents/registry`)
      .set("Authorization", `Bearer ${adminTok}`);
    expect(reg.status).toBe(200);
    expect(reg.text).toContain("Registry content");

    const pdf = await request(app)
      .get(`/api/parcels/${parcelId}/documents/ownership-certificate.pdf`)
      .set("Authorization", `Bearer ${adminTok}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toMatch(/application\/pdf/);
    expect(pdf.body.length).toBeGreaterThan(100);
  });

  it("AC: seller initiates transfer; simulate NADRA completes chain + updates owner", async () => {
    await seedAdminAndUsers();
    const app = buildApp();
    const adminTok = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_ADMIN,
      password: "AdminPass123",
    })).body.token as string;
    const created = await request(app)
      .post("/api/admin/parcels")
      .set("Authorization", `Bearer ${adminTok}`)
      .send({
        district: "Faisalabad",
        moza: "Jaranwala",
        plotNumber: "F-77",
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
    expect(start.status).toBe(201);
    const transferId = start.body.transferId as string;

    const beforeCount = (await ledger.listRecords()).length;

    const buyerTok = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_BUYER,
      password: "BuyerPass123",
    })).body.token as string;

    const view = await request(app)
      .get(`/api/transfers/${transferId}`)
      .set("Authorization", `Bearer ${buyerTok}`);
    expect(view.status).toBe(200);
    expect(view.body.transfer.buyerCnic).toBe(CNIC_BUYER);

    const approved = await request(app)
      .post(`/api/transfers/${transferId}/buyer-approve`)
      .set("Authorization", `Bearer ${buyerTok}`);
    expect(approved.status).toBe(200);
    expect(approved.body.transfer.buyerApprovedAt).toBeTruthy();

    const done = await request(app)
      .post(`/api/transfers/${transferId}/simulate-nadra`)
      .set("Authorization", `Bearer ${buyerTok}`);
    expect(done.status).toBe(200);
    expect(done.body.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(done.body.newOwnerCnic).toBe(CNIC_BUYER);

    expect((await ledger.listRecords()).length).toBeGreaterThanOrEqual(beforeCount + 1);

    const detail = await request(app)
      .get(`/api/parcels/${parcelId}`)
      .set("Authorization", `Bearer ${buyerTok}`);
    expect(detail.body.parcel.currentOwnerCnic).toBe(CNIC_BUYER);
    expect(detail.body.parcel.ownershipHistory.some((h: { ownerCnic: string }) => h.ownerCnic === CNIC_BUYER)).toBe(
      true,
    );
  });

  it("AC: disputed parcel blocks new transfer", async () => {
    await seedAdminAndUsers();
    const app = buildApp();
    const adminTok = (await request(app).post("/api/auth/login").send({
      cnic: CNIC_ADMIN,
      password: "AdminPass123",
    })).body.token as string;
    const created = await request(app)
      .post("/api/admin/parcels")
      .set("Authorization", `Bearer ${adminTok}`)
      .send({
        district: "Quetta",
        moza: "Hanna",
        plotNumber: "Q-1",
        currentOwnerCnic: CNIC_SELLER,
        disputed: true,
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
    expect(start.status).toBe(409);
  });
});
