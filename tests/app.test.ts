import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { Types } from "mongoose";
import unlinkFile from "../src/util/unlinkFile";
import postNotification from "../src/util/postNotification";
import { connectTestDB, disconnectTestDB } from "./helpers/db";

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
