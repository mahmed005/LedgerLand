import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";

const MONGO_URI = process.env.MONGODB_TEST_URI || "mongodb://127.0.0.1:27017/ledgerland_test";

beforeAll(async () => {
  await mongoose.connect(MONGO_URI);
});

afterAll(async () => {
  await mongoose.connection.db!.dropDatabase();
  await mongoose.disconnect();
});

describe("Core smoke tests", () => {
  it("GET /health returns { status: ok }", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("POST /api/auth/signup → 400 for missing CNIC", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ password: "test1234", fullName: "Test" });
    expect(res.status).toBe(400);
  });

  it("POST /api/auth/login → 401 for unknown credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ cnic: "9999999999999", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/me → 401 without token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("GET /api/parcels/search with no filters → No record found.", async () => {
    const res = await request(app).get("/api/parcels/search");
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(false);
    expect(res.body.message).toBe("No record found.");
  });
});
