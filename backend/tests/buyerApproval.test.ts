/// <reference types="jest" />
import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp } from "../src/app.js";
import { signupAndLogin } from "./helpers.js";

describe("Buyer approval flow", () => {
  it("buyer can view and approve transfer, process cannot continue without approval, and ownership transfers securely after approval", async () => {
    console.log("[buyer-approval] Step 1/6: initialize app and users");
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
    const buyerToken = await signupAndLogin(app, {
      cnic: "3520222222222",
      password: "BuyerPass123",
      role: "buyer",
    });

    console.log("[buyer-approval] Step 2/6: create parcel and transfer request");
    const parcel = await request(app)
      .post("/api/admin/parcels")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        plotNumber: "P-77",
        ownerCnic: "3520111111111",
      });
    const parcelId = parcel.body.parcel.id as string;

    const transfer = await request(app)
      .post("/api/transfers")
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({
        parcelId,
        buyerCnic: "3520222222222",
      });
    const transferId = transfer.body.transfer.id as string;

    console.log("[buyer-approval] Step 3/6: ensure completion is blocked before approval");
    const cannotContinueWithoutApproval = await request(app)
      .post(`/api/transfers/${transferId}/complete`)
      .set("Authorization", `Bearer ${sellerToken}`);
    expect(cannotContinueWithoutApproval.status).toBe(409);
    expect(cannotContinueWithoutApproval.body.error).toBe("BUYER_APPROVAL_REQUIRED");

    console.log("[buyer-approval] Step 4/6: buyer views transfer request");
    const buyerCanView = await request(app)
      .get(`/api/transfers/${transferId}`)
      .set("Authorization", `Bearer ${buyerToken}`);
    expect(buyerCanView.status).toBe(200);
    expect(buyerCanView.body.transfer.buyerCnic).toBe("3520222222222");

    console.log("[buyer-approval] Step 5/6: buyer approves transfer");
    const buyerApproves = await request(app)
      .post(`/api/transfers/${transferId}/buyer-approve`)
      .set("Authorization", `Bearer ${buyerToken}`);
    expect(buyerApproves.status).toBe(200);
    expect(buyerApproves.body.transfer.buyerApproved).toBe(true);

    console.log("[buyer-approval] Step 6/6: seller completes transfer and ownership moves");
    const complete = await request(app)
      .post(`/api/transfers/${transferId}/complete`)
      .set("Authorization", `Bearer ${sellerToken}`);
    expect(complete.status).toBe(200);
    expect(complete.body.transfer.completed).toBe(true);
    expect(complete.body.parcel.ownerCnic).toBe("3520222222222");
    console.log("[buyer-approval] Completed successfully");
  });
});
