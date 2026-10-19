import crypto from "crypto";
import Auth from "../../src/app/module/auth/Auth";
import User from "../../src/app/module/user/User";
import Admin from "../../src/app/module/admin/Admin";
import config from "../../src/config";
import { jwtHelpers } from "../../src/util/jwtHelpers";

// An active account created straight in the DB, plus a signed access token.
// No emails, no rate limits: use the HTTP flow only when testing auth itself.
export const createAccount = async (
  role: "USER" | "ADMIN" | "SUPER_ADMIN" = "USER",
  password = "password123",
) => {
  const email = `${role.toLowerCase()}-${crypto.randomUUID()}@example.com`;
  const auth = await Auth.create({
    name: role,
    email,
    password,
    role,
    isActive: true,
  });
  const profile =
    role === "USER"
      ? await User.create({ authId: auth._id, name: role, email })
      : await Admin.create({ authId: auth._id, name: role, email });
  const payload = {
    authId: String(auth._id),
    userId: String(profile._id),
    email,
    role,
  };
  const token = jwtHelpers.createToken(payload, config.jwt.secret, "15m");
  return { ...payload, password, token };
};
