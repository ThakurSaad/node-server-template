import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";

// Emails are fired without await inside the services — mock the transport
// so tests never touch SMTP (and never produce unhandled rejections)
vi.mock("../src/util/sendEmail", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import app from "../src/app";
import Auth from "../src/app/module/auth/Auth";
import { AuthService } from "../src/app/module/auth/auth.service";
import { connectTestDB, disconnectTestDB } from "./helpers/db";

const user = {
  name: "Test User",
  email: "test.user@example.com",
  role: "USER",
  password: "password123",
  confirmPassword: "password123",
};

const getActivationCode = async (email: string) => {
  const auth = await Auth.findOne({ email });
  return auth?.activationCode;
};

beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

describe("health check", () => {
  it("reports ok when the database is connected", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.db).toBe("up");
  });
});

describe("registration", () => {
  it("rejects privileged roles on the public endpoint", async () => {
    for (const role of ["ADMIN", "SUPER_ADMIN"]) {
      const res = await request(app)
        .post("/auth/register")
        .send({ ...user, email: `evil-${role}@example.com`, role });
      expect(res.status).toBe(400);
    }
  });

  it("rejects invalid bodies via zod validation", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ ...user, email: "not-an-email", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.errorMessages.length).toBeGreaterThan(0);
  });

  it("creates an inactive account and stores an activation code", async () => {
    const res = await request(app).post("/auth/register").send(user);
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);

    const auth = await Auth.findOne({ email: user.email });
    expect(auth).not.toBeNull();
    expect(auth!.isActive).toBe(false);
    expect(auth!.activationCode).toBeTruthy();
    // password must be stored as a bcrypt hash, never plaintext
    const withPassword = await Auth.findOne({ email: user.email }).select(
      "+password",
    );
    expect(withPassword!.password).toMatch(/^\$2[aby]\$/);
  });
});

describe("activation and login", () => {
  let accessToken: string;
  let refreshToken: string;

  it("rejects a wrong activation code", async () => {
    const res = await request(app)
      .post("/auth/activate-account")
      .send({ email: user.email, activationCode: "000000" });
    expect(res.status).toBe(400);
  });

  it("activates with the correct code and issues tokens", async () => {
    const code = await getActivationCode(user.email);
    const res = await request(app)
      .post("/auth/activate-account")
      .send({ email: user.email, activationCode: code });

    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();

    const auth = await Auth.findOne({ email: user.email });
    expect(auth!.isActive).toBe(true);
    expect(auth!.activationCode).toBeUndefined();
  });

  it("logs in with the correct password", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: user.email, password: user.password });

    expect(res.status).toBe(200);
    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
    expect(accessToken).toBeTruthy();
  });

  it("rejects a wrong password", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: user.email, password: "wrong-password" });
    expect(res.status).toBe(400);
  });

  it("issues a fresh access token from a refresh token", async () => {
    const res = await request(app)
      .post("/auth/refresh-token")
      .send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it("rejects a garbage refresh token", async () => {
    const res = await request(app)
      .post("/auth/refresh-token")
      .send({ refreshToken: "garbage" });
    expect(res.status).toBe(401);
  });

  it("changes the password (hashed) and allows re-login", async () => {
    const newPassword = "new-password-456";

    const change = await request(app)
      .patch("/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        oldPassword: user.password,
        newPassword,
        confirmPassword: newPassword,
      });
    expect(change.status).toBe(200);

    const auth = await Auth.findOne({ email: user.email }).select("+password");
    expect(auth!.password).toMatch(/^\$2[aby]\$/);

    const relogin = await request(app)
      .post("/auth/login")
      .send({ email: user.email, password: newPassword });
    expect(relogin.status).toBe(200);
  });

  it("blocks API access for blocked accounts even with a valid token", async () => {
    await Auth.updateOne({ email: user.email }, { isBlocked: true });

    const res = await request(app)
      .get("/user/profile")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(403);

    await Auth.updateOne({ email: user.email }, { isBlocked: false });
  });
});

describe("OTP brute-force protection (service level)", () => {
  const target = {
    ...user,
    email: "otp.lockout@example.com",
  };

  it("invalidates the code after too many wrong attempts", async () => {
    await request(app).post("/auth/register").send(target);

    // 5 wrong guesses hit the attempt cap...
    for (let i = 0; i < 5; i++) {
      await expect(
        AuthService.activateAccount({
          email: target.email,
          activationCode: "999999",
        }),
      ).rejects.toThrow("Code didn't match!");
    }

    // ...the 6th is rejected outright and the code is invalidated
    await expect(
      AuthService.activateAccount({
        email: target.email,
        activationCode: "999999",
      }),
    ).rejects.toThrow(/Too many attempts/);

    const auth = await Auth.findOne({ email: target.email });
    expect(auth!.activationCode).toBeUndefined();
  });

  it("rejects expired codes even when they match", async () => {
    const expired = {
      ...user,
      email: "otp.expired@example.com",
    };
    await request(app).post("/auth/register").send(expired);

    await Auth.updateOne(
      { email: expired.email },
      { activationCodeExpire: new Date(Date.now() - 1000) },
    );
    const code = await getActivationCode(expired.email);

    await expect(
      AuthService.activateAccount({
        email: expired.email,
        activationCode: code!,
      }),
    ).rejects.toThrow(/expired/i);
  });
});
