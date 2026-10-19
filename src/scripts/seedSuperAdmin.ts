import mongoose from "mongoose";
import config from "../config";
import connectDB from "../connection/connectDB";
import Auth from "../app/module/auth/Auth";
import Admin from "../app/module/admin/Admin";
import { EnumUserRole } from "../util/enum";

// Idempotent: creates the SUPER_ADMIN account once; exits quietly if it exists.
// Usage: npm run seed:admin (requires SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in .env)
const seedSuperAdmin = async () => {
  const email = config.super_admin.email;
  const password = config.super_admin.password;
  const name = "Super Admin";

  if (!email || !password) {
    console.error(
      "Missing SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD in the environment",
    );
    process.exit(1);
  }

  await connectDB();

  const existing = await Auth.findOne({ email });
  if (existing) {
    console.log(`Super admin already exists: ${email}`);
  } else {
    const auth = await Auth.create({
      name,
      email,
      password,
      role: EnumUserRole.SUPER_ADMIN,
      isActive: true,
    });

    await Admin.create({
      authId: auth._id,
      name,
      email,
    });

    console.log(`Super admin created: ${email}`);
  }

  await mongoose.disconnect();
  process.exit(0);
};

seedSuperAdmin().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
