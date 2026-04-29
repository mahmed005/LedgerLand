import request from "supertest";
import { createApp } from "../src/app.js";

export async function signupAndLogin(
  app: ReturnType<typeof createApp>,
  payload: { cnic: string; password: string; role: "admin" | "seller" | "buyer" },
) {
  await request(app).post("/api/auth/signup").send(payload);
  const login = await request(app).post("/api/auth/login").send({
    cnic: payload.cnic,
    password: payload.password,
  });
  return login.body.token as string;
}
