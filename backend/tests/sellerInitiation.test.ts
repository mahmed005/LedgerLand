/// <reference types="jest" />
import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp } from "../src/app.js";
import { signupAndLogin } from "./helpers.js";

describe("Seller transfer initiation flow", () => {
  it("a seller can initiate land transfer after buyer cnic and plot are selected, then a transfer request is created", async () => {
    console.log("[seller-initiation] Step 1/4: initialize app and users");
    const app = createApp();
    const adminToken = await signupAndLogin(app, {
      cnic: "3520999999999",
      password: "AdminPass123",
      role: "admin",
    });
    const sellerToken = await signupAndLogin(app, {
      cnic: "3520111111111",
      password: "SellerPass123",
      role: "seller",
    });
    await signupAndLogin(app, {
      cnic: "3520222222222",
      password: "BuyerPass123",
      role: "buyer",
    });

    console.log("[seller-initiation] Step 2/4: admin creates parcel for seller");
    const createdParcel = await request(app)
      .post("/api/admin/parcels")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        plotNumber: "P-42",
        ownerCnic: "3520111111111",
      });
    const parcelId = createdParcel.body.parcel.id as string;

    console.log("[seller-initiation] Step 3/4: seller initiates transfer request");
    const transfer = await request(app)
      .post("/api/transfers")
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({
        parcelId,
        buyerCnic: "3520222222222",
      });

    expect(transfer.status).toBe(201);
    expect(transfer.body.transfer.parcelId).toBe(parcelId);
    expect(transfer.body.transfer.sellerCnic).toBe("3520111111111");
    expect(transfer.body.transfer.buyerCnic).toBe("3520222222222");
    expect(transfer.body.transfer.buyerApproved).toBe(false);
    console.log("[seller-initiation] Step 4/4: transfer request created and validated");
    console.log("[seller-initiation] Completed successfully");
  });
});
