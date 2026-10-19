import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";

// Emails are fired without await inside the services — mock the transport
// so tests never touch SMTP (and never produce unhandled rejections)
vi.mock("../src/util/sendEmail", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import app from "../src/app";
import Auth from "../src/app/module/auth/Auth";
import User from "../src/app/module/user/User";
import { AuthService } from "../src/app/module/auth/auth.service";
import { sendEmail } from "../src/util/sendEmail";
import { connectTestDB, disconnectTestDB } from "./helpers/db";
import { createAccount } from "./helpers/accounts";

const sendEmailMock = vi.mocked(sendEmail);

const user = {
  name: "Test User",
  email: "test.user@example.com",
  role: "USER",
  password: "password123",
  confirmPassword: "password123",
};

// The app trusts one proxy hop, so X-Forwarded-For becomes req.ip. A fresh
// IP per request keeps the per-IP auth limiters from leaking between tests;
// pass the same ip explicitly to exercise a limiter.
let ipSeq = 0;
const nextIp = () => {
  ipSeq += 1;
  return `10.0.${Math.floor(ipSeq / 256)}.${ipSeq % 256}`;
};
const client = (ip = nextIp()) => ({
  get: (url: string) => request(app).get(url).set("X-Forwarded-For", ip),
  post: (url: string) => request(app).post(url).set("X-Forwarded-For", ip),
  patch: (url: string) => request(app).patch(url).set("X-Forwarded-For", ip),
});

// The OTP from the most recent (mocked) email to this address: the DB only has its hash
const lastCodeSentTo = (email: string) => {
  const html = sendEmailMock.mock.calls
    .filter(([o]) => o.email === email)
    .at(-1)?.[0].html;
  const code = html?.match(/class="code">(\d{6})</)?.[1]; // all three templates render class="code"
  if (!code) throw new Error(`no code emailed to ${email}`);
  return code;
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
      const res = await client()
        .post("/auth/register")
        .send({ ...user, email: `evil-${role}@example.com`, role });
      expect(res.status).toBe(400);
    }
  });

  it("rejects invalid bodies via zod validation", async () => {
    const res = await client()
      .post("/auth/register")
      .send({ ...user, email: "not-an-email", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.errorMessages.length).toBeGreaterThan(0);
  });

  it("creates an inactive account and stores only a hash of the code", async () => {
    const res = await client().post("/auth/register").send(user);
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);

    const auth = await Auth.findOne({ email: user.email });
    expect(auth).not.toBeNull();
    expect(auth!.isActive).toBe(false);
    expect(auth!.activationCode).toMatch(/^[a-f0-9]{64}$/);
    // password must be stored as a bcrypt hash, never plaintext
    const withPassword = await Auth.findOne({ email: user.email }).select(
      "+password",
    );
    expect(withPassword!.password).toMatch(/^\$2[aby]\$/);
  });

  it("returns 500 instead of crashing when the email cannot be sent", async () => {
    sendEmailMock.mockRejectedValueOnce(new Error("SMTP down"));

    const email = "smtp-down@example.com";
    const res = await client()
      .post("/auth/register")
      .send({ ...user, email });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Email was not sent");
    expect(await Auth.exists({ email })).toBeTruthy();
  });

  it("escapes HTML in the name before it goes into the email", async () => {
    const maliciousName = '<a href="https://evil.test">Verify</a>';
    const email = "html-escape@example.com";

    await client()
      .post("/auth/register")
      .send({ ...user, name: maliciousName, email });

    const html = sendEmailMock.mock.calls
      .filter(([o]) => o.email === email)
      .at(-1)?.[0].html;

    expect(html).not.toContain('<a href="https://evil.test">');
    expect(html).toContain("&lt;a href=");
  });

  it("rolls back the Auth record when creating the profile fails", async () => {
    const createSpy = vi
      .spyOn(User, "create")
      .mockRejectedValueOnce(new Error("db down"));

    const email = "profile-create-fails@example.com";
    const res = await client()
      .post("/auth/register")
      .send({ ...user, email });

    expect(res.status).toBe(500);
    expect(await Auth.exists({ email })).toBeNull();

    createSpy.mockRestore();
  });
});

describe("activation and login", () => {
  let accessToken: string;
  let refreshToken: string;

  it("rejects a wrong activation code", async () => {
    const res = await client()
      .post("/auth/activate-account")
      .send({ email: user.email, activationCode: "000000" });
    expect(res.status).toBe(400);
  });

  it("activates with the correct code and issues tokens", async () => {
    const code = lastCodeSentTo(user.email);
    const res = await client()
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
    const res = await client()
      .post("/auth/login")
      .send({ email: user.email, password: user.password });

    expect(res.status).toBe(200);
    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
    expect(accessToken).toBeTruthy();
  });

  it("rejects a wrong password", async () => {
    const res = await client()
      .post("/auth/login")
      .send({ email: user.email, password: "wrong-password" });
    expect(res.status).toBe(400);
  });

  it("issues a fresh access token from a refresh token", async () => {
    const res = await client()
      .post("/auth/refresh-token")
      .send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it("rejects a garbage refresh token", async () => {
    const res = await client()
      .post("/auth/refresh-token")
      .send({ refreshToken: "garbage" });
    expect(res.status).toBe(401);
  });

  it("changes the password, revokes older tokens and allows re-login", async () => {
    const newPassword = "new-password-456";

    // iat has 1-second resolution: without the wait, a token issued in the
    // same second as the change could legitimately still be valid
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const change = await client()
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

    // the pre-change access and refresh tokens are both revoked
    const oldAccess = await client()
      .get("/user/profile")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(oldAccess.status).toBe(401);

    const oldRefresh = await client()
      .post("/auth/refresh-token")
      .send({ refreshToken });
    expect(oldRefresh.status).toBe(401);

    const relogin = await client()
      .post("/auth/login")
      .send({ email: user.email, password: newPassword });
    expect(relogin.status).toBe(200);
    accessToken = relogin.body.data.accessToken;

    const newTokenWorks = await client()
      .get("/user/profile")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(newTokenWorks.status).toBe(200);
  });

  it("blocks API access for blocked accounts even with a valid token", async () => {
    await Auth.updateOne({ email: user.email }, { isBlocked: true });

    const res = await client()
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
    await client().post("/auth/register").send(target);

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
    await client().post("/auth/register").send(expired);

    await Auth.updateOne(
      { email: expired.email },
      { activationCodeExpire: new Date(Date.now() - 1000) },
    );
    const code = lastCodeSentTo(expired.email);

    await expect(
      AuthService.activateAccount({
        email: expired.email,
        activationCode: code,
      }),
    ).rejects.toThrow(/expired/i);
  });
});

describe("password reset", () => {
  it("a verified code does not let someone who only knows the email reset the password", async () => {
    const account = await createAccount("USER");

    const forgot = await client()
      .post("/auth/forgot-password")
      .send({ email: account.email });
    expect(forgot.status).toBe(200);

    const code = lastCodeSentTo(account.email);

    const verify = await client()
      .post("/auth/forget-pass-otp-verify")
      .send({ email: account.email, code });
    expect(verify.status).toBe(200);

    // knowing the email (and that it was verified) is not enough: the code
    // is required again on reset-password, and a wrong one is rejected
    const missingCode = await client().post("/auth/reset-password").send({
      email: account.email,
      newPassword: "brand-new-pass-1",
      confirmPassword: "brand-new-pass-1",
    });
    expect(missingCode.status).toBe(400);

    const wrongCode = await client().post("/auth/reset-password").send({
      email: account.email,
      code: "000000",
      newPassword: "brand-new-pass-1",
      confirmPassword: "brand-new-pass-1",
    });
    expect(wrongCode.status).toBe(400);
  });

  it("resets with the emailed code once", async () => {
    const account = await createAccount("USER");
    const newPassword = "brand-new-pass-2";

    // iat has 1-second resolution: without the wait, the pre-reset token
    // (issued in the same second) could legitimately still be valid
    await new Promise((resolve) => setTimeout(resolve, 1100));

    await client().post("/auth/forgot-password").send({ email: account.email });
    const code = lastCodeSentTo(account.email);

    const reset = await client().post("/auth/reset-password").send({
      email: account.email,
      code,
      newPassword,
      confirmPassword: newPassword,
    });
    expect(reset.status).toBe(200);

    // the code is consumed: the same request again fails
    const reuse = await client().post("/auth/reset-password").send({
      email: account.email,
      code,
      newPassword,
      confirmPassword: newPassword,
    });
    expect(reuse.status).toBe(404);

    const login = await client()
      .post("/auth/login")
      .send({ email: account.email, password: newPassword });
    expect(login.status).toBe(200);

    // the token issued before the reset is revoked
    const oldToken = await client()
      .get("/user/profile")
      .set("Authorization", `Bearer ${account.token}`);
    expect(oldToken.status).toBe(401);
  });
});

describe("refresh cookie", () => {
  it("sets an httpOnly, strict refresh cookie scoped to the refresh endpoint", async () => {
    const account = await createAccount("USER");

    const res = await client()
      .post("/auth/login")
      .send({ email: account.email, password: account.password });

    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/auth/refresh-token");
    expect(cookie).toContain("Expires=");
  });

  it("refreshes with only the refresh cookie and no body", async () => {
    const account = await createAccount("USER");

    const login = await client()
      .post("/auth/login")
      .send({ email: account.email, password: account.password });

    const refreshed = await client()
      .post("/auth/refresh-token")
      .set("Cookie", login.headers["set-cookie"]);

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).toBeTruthy();
  });
});

describe("register rate limit", () => {
  it("allows 3 OTP emails per IP per 15 minutes", async () => {
    const ip = "203.0.113.10";

    for (let i = 0; i < 3; i++) {
      const res = await client(ip).post("/auth/register").send({});
      expect(res.status).toBe(400);
    }

    const fourth = await client(ip).post("/auth/register").send({});
    expect(fourth.status).toBe(429);
  });
});
