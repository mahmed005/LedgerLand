/// <reference types="jest" />
import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp } from "../src/app.js";
import { signupAndLogin } from "./helpers.js";

describe("Admin dispute flow", () => {
  it("admin can mark property as disputed, dispute flag is visible to users, dispute status is saved", async () => {
    console.log("[admin-dispute] Step 1/5: initialize app and test users");
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

    console.log("[admin-dispute] Step 2/5: admin creates parcel");
    const created = await request(app)
      .post("/api/admin/parcels")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        plotNumber: "P-10",
        ownerCnic: "3520111111111",
      });
    expect(created.status).toBe(201);
    const parcelId = created.body.parcel.id as string;

    console.log("[admin-dispute] Step 3/5: admin marks parcel as disputed");
    const disputed = await request(app)
      .patch(`/api/admin/parcels/${parcelId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ disputed: true });
    expect(disputed.status).toBe(200);
    expect(disputed.body.parcel.disputed).toBe(true);

    console.log("[admin-dispute] Step 4/5: public visibility check");
    const visibleToUsers = await request(app).get(`/api/parcels/${parcelId}`);
    expect(visibleToUsers.status).toBe(200);
    expect(visibleToUsers.body.parcel.disputed).toBe(true);

    console.log("[admin-dispute] Step 5/5: owner visibility and persistence check");
    const visibleToOwner = await request(app)
      .get(`/api/parcels/${parcelId}`)
      .set("Authorization", `Bearer ${sellerToken}`);
    expect(visibleToOwner.status).toBe(200);
    expect(visibleToOwner.body.parcel.disputed).toBe(true);
    console.log("[admin-dispute] Completed successfully");
  });
});
