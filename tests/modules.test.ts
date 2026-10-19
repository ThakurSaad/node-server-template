import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";

// Several routes under test send emails (feedback notifications do not, but
// keep this file independent of SMTP regardless)
vi.mock("../src/util/sendEmail", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import app from "../src/app";
import User from "../src/app/module/user/User";
import Notification from "../src/app/module/notification/Notification";
import AdminNotification from "../src/app/module/notification/AdminNotification";
import Review from "../src/app/module/review/Review";
import Feedback from "../src/app/module/feedback/Feedback";
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

describe("chat ownership", () => {
  it("only participants can read a chat", async () => {
    const a = await createAccount("USER");
    const b = await createAccount("USER");
    const outsider = await createAccount("USER");

    const started = await request(app)
      .post("/chat/post-chat")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ receiverId: b.userId });
    expect(started.status).toBe(200);
    const chatId = started.body.data._id;

    const outsiderRes = await request(app)
      .get("/chat/get-chat-messages")
      .set("Authorization", `Bearer ${outsider.token}`)
      .query({ chatId });
    expect(outsiderRes.status).toBe(404);

    const participantRes = await request(app)
      .get("/chat/get-chat-messages")
      .set("Authorization", `Bearer ${b.token}`)
      .query({ chatId });
    expect(participantRes.status).toBe(200);
  });
});

describe("notification ownership", () => {
  it("notifications are private to their recipient", async () => {
    const owner = await createAccount("USER");
    const outsider = await createAccount("USER");
    const note = await Notification.create({
      toId: owner.userId,
      title: "t",
      message: "m",
    });
    const notificationId = String(note._id);

    const outsiderGet = await request(app)
      .get("/notification/get-notification")
      .set("Authorization", `Bearer ${outsider.token}`)
      .query({ notificationId });
    expect(outsiderGet.status).toBe(404);

    const ownerGet = await request(app)
      .get("/notification/get-notification")
      .set("Authorization", `Bearer ${owner.token}`)
      .query({ notificationId });
    expect(ownerGet.status).toBe(200);

    const outsiderDelete = await request(app)
      .delete("/notification/delete-notification")
      .set("Authorization", `Bearer ${outsider.token}`)
      .send({ notificationId });
    expect(outsiderDelete.status).toBe(404);

    const ownerDelete = await request(app)
      .delete("/notification/delete-notification")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ notificationId });
    expect(ownerDelete.status).toBe(200);
  });

  it("gives SUPER_ADMIN the admin notification inbox", async () => {
    const superAdmin = await createAccount("SUPER_ADMIN");
    await AdminNotification.create({
      title: "Admin alert",
      message: "something happened",
    });

    const res = await request(app)
      .get("/notification/get-all-notifications")
      .set("Authorization", `Bearer ${superAdmin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

describe("review ownership", () => {
  it("only the author edits; the author or an admin reads and deletes", async () => {
    const author = await createAccount("USER");
    const other = await createAccount("USER");
    const admin = await createAccount("ADMIN");
    const review = await Review.create({
      user: author.userId,
      rating: 4,
      review: "nice",
    });
    const reviewId = String(review._id);

    const outsiderGet = await request(app)
      .get("/review/get-review")
      .set("Authorization", `Bearer ${other.token}`)
      .query({ reviewId });
    expect(outsiderGet.status).toBe(404);

    const authorGet = await request(app)
      .get("/review/get-review")
      .set("Authorization", `Bearer ${author.token}`)
      .query({ reviewId });
    expect(authorGet.status).toBe(200);

    const adminGet = await request(app)
      .get("/review/get-review")
      .set("Authorization", `Bearer ${admin.token}`)
      .query({ reviewId });
    expect(adminGet.status).toBe(200);

    const otherUpdate = await request(app)
      .patch("/review/update-review")
      .set("Authorization", `Bearer ${other.token}`)
      .send({ reviewId, review: "hacked" });
    expect(otherUpdate.status).toBe(404);

    const adminUpdate = await request(app)
      .patch("/review/update-review")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ reviewId, review: "admin edit" });
    expect(adminUpdate.status).toBe(404); // admins read/delete, but never edit someone else's text

    const authorUpdate = await request(app)
      .patch("/review/update-review")
      .set("Authorization", `Bearer ${author.token}`)
      .send({ reviewId, review: "updated by author" });
    expect(authorUpdate.status).toBe(200);

    const outsiderDelete = await request(app)
      .delete("/review/delete-review")
      .set("Authorization", `Bearer ${other.token}`)
      .query({ reviewId });
    expect(outsiderDelete.status).toBe(404);

    const adminDelete = await request(app)
      .delete("/review/delete-review")
      .set("Authorization", `Bearer ${admin.token}`)
      .query({ reviewId });
    expect(adminDelete.status).toBe(200);

    // the author can also delete their own review, not just an admin
    const ownReview = await Review.create({
      user: author.userId,
      rating: 5,
      review: "another one",
    });
    const selfDelete = await request(app)
      .delete("/review/delete-review")
      .set("Authorization", `Bearer ${author.token}`)
      .query({ reviewId: String(ownReview._id) });
    expect(selfDelete.status).toBe(200);
  });
});

describe("feedback ownership", () => {
  it("feedback is visible to its author and to admins, incl. SUPER_ADMIN", async () => {
    const author = await createAccount("USER");
    const other = await createAccount("USER");
    const admin = await createAccount("ADMIN");
    const superAdmin = await createAccount("SUPER_ADMIN");
    const feedback = await Feedback.create({
      user: author.userId,
      name: author.email,
      email: author.email,
      feedback: "great app",
    });
    const feedbackId = String(feedback._id);

    const outsider = await request(app)
      .get("/feedback/get-feedback")
      .set("Authorization", `Bearer ${other.token}`)
      .query({ feedbackId });
    expect(outsider.status).toBe(404);

    const ownerRes = await request(app)
      .get("/feedback/get-feedback")
      .set("Authorization", `Bearer ${author.token}`)
      .query({ feedbackId });
    expect(ownerRes.status).toBe(200);

    const adminRes = await request(app)
      .get("/feedback/get-feedback")
      .set("Authorization", `Bearer ${admin.token}`)
      .query({ feedbackId });
    expect(adminRes.status).toBe(200);

    const superAdminRes = await request(app)
      .get("/feedback/get-feedback")
      .set("Authorization", `Bearer ${superAdmin.token}`)
      .query({ feedbackId });
    expect(superAdminRes.status).toBe(200);
  });
});
