import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";

// Several routes under test send emails (feedback notifications do not, but
// keep this file independent of SMTP regardless)
vi.mock("../src/util/sendEmail", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import app from "../src/app";
import User from "../src/app/module/user/User";
import { connectTestDB, disconnectTestDB } from "./helpers/db";
import { createAccount } from "./helpers/accounts";

beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

describe("user profile", () => {
  it("edit-profile only writes whitelisted fields", async () => {
    const me = await createAccount("USER");
    const other = await createAccount("USER");

    const res = await request(app)
      .patch("/user/edit-profile")
      .set("Authorization", `Bearer ${me.token}`)
      .send({
        name: "New Name",
        profile_image: ".env",
        authId: other.authId,
        email: other.email,
      });

    expect(res.status).toBe(200);

    const updated = await User.findById(me.userId).lean();
    expect(updated!.name).toBe("New Name");
    expect(updated!.profile_image).toBeUndefined();
    expect(String(updated!.authId)).toBe(me.authId);
    expect(updated!.email).toBe(me.email);
  });
});
