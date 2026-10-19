import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import express from "express";
import request from "supertest";
import { Types } from "mongoose";
import app from "../src/app";
import config from "../src/config";
import ApiError from "../src/error/ApiError";
import globalErrorHandler from "../src/app/middleware/globalErrorHandler";
import unlinkFile from "../src/util/unlinkFile";
import postNotification from "../src/util/postNotification";
import { connectTestDB, disconnectTestDB } from "./helpers/db";
import { createAccount } from "./helpers/accounts";

beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

describe("unlinkFile", () => {
  it("never throws and refuses paths outside uploads/", async () => {
    // Missing file under uploads/: a no-op, not a crash
    await expect(unlinkFile("uploads/missing.jpg")).resolves.toBe(false);

    // Outside uploads/ entirely: refused, even though the file exists
    const outside = path.join(os.tmpdir(), `unlinkfile-test-${Date.now()}.txt`);
    fs.writeFileSync(outside, "x");
    await expect(unlinkFile(outside)).resolves.toBe(false);
    expect(fs.existsSync(outside)).toBe(true);
    fs.unlinkSync(outside);
  });

  it("deletes a real file under uploads/", async () => {
    const dir = path.resolve("uploads");
    fs.mkdirSync(dir, { recursive: true });
    const inside = path.join(dir, `unlinkfile-test-${Date.now()}.txt`);
    fs.writeFileSync(inside, "x");

    await expect(unlinkFile(inside)).resolves.toBe(true);
    expect(fs.existsSync(inside)).toBe(false);
  });
});

describe("postNotification", () => {
  it("never rejects, even with an invalid message", async () => {
    await expect(
      postNotification(
        "t",
        0 as unknown as string,
        new Types.ObjectId().toString(),
      ),
    ).resolves.toBeUndefined();
  });
});

describe("globalErrorHandler", () => {
  const failingApp = (e: unknown) =>
    express()
      .get("/boom", () => {
        throw e;
      })
      .use(globalErrorHandler);

  it("reports a TypeError as 500", async () => {
    const res = await request(failingApp(new TypeError("boom"))).get("/boom");
    expect(res.status).toBe(500);
  });

  it("hides internal messages in production but keeps ApiError messages", async () => {
    config.env = "production";
    try {
      const genericRes = await request(
        failingApp(new Error("E11000 internals")),
      ).get("/boom");
      expect(genericRes.status).toBe(500);
      expect(JSON.stringify(genericRes.body)).not.toContain("internals");

      const apiErrorRes = await request(
        failingApp(new ApiError(404, "Review not found")),
      ).get("/boom");
      expect(apiErrorRes.status).toBe(404);
      expect(apiErrorRes.body.message).toBe("Review not found");
    } finally {
      config.env = "test";
    }
  });
});

describe("auth middleware", () => {
  it("rejects a bare Bearer header with 401, not 500", async () => {
    const res = await request(app)
      .get("/user/profile")
      .set("Authorization", "Bearer");
    expect(res.status).toBe(401);
  });
});

describe("file uploads", () => {
  it("rejects a disallowed upload type with 400", async () => {
    const account = await createAccount("USER");

    const res = await request(app)
      .patch("/user/edit-profile")
      .set("Authorization", `Bearer ${account.token}`)
      .attach("profile_image", Buffer.from("x"), {
        filename: "a.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(400);
  });
});
