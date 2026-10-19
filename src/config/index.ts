import * as dotenv from "dotenv";
import * as path from "path";
import { z } from "zod";

dotenv.config({
  path: path.join(process.cwd(), ".env"),
});

// Single source of truth for environment variables. Keep .env.example in
// sync with this schema — the app refuses to boot on a mismatch.
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  BASE_URL: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().default(8001),

  MONGO_URL: z.string().min(1, "MONGO_URL is required"),

  BCRYPT_SALT_ROUNDS: z.coerce.number().default(10),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SERVICE: z.string().optional(),
  SMTP_MAIL: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SERVICE_NAME: z.string().default("Server Template"),

  SUPER_ADMIN_EMAIL: z.string().optional(),
  SUPER_ADMIN_PASSWORD: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),

  CLOUD_NAME: z.string().optional(),
  API_KEY: z.string().optional(),
  API_SECRET: z.string().optional(),
  CLOUDINARY_URL: z.string().optional(),

  EMAIL_TEMP_IMAGE: z.string().optional(),
  EMAIL_TEMP_TEXT_SECONDARY_COLOR: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

// Shape kept identical to the pre-zod config so consumers are unaffected
const config = {
  env: env.NODE_ENV,
  port: env.PORT,
  base_url: env.BASE_URL,
  database_url: env.MONGO_URL,
  bcrypt_salt_rounds: env.BCRYPT_SALT_ROUNDS,
  auth_level: {
    user: ["USER", "ADMIN", "SUPER_ADMIN"],
    admin: ["ADMIN", "SUPER_ADMIN"],
    super_admin: ["SUPER_ADMIN"],
  },
  jwt: {
    secret: env.JWT_SECRET,
    refresh_secret: env.JWT_REFRESH_SECRET,
    expires_in: env.JWT_EXPIRES_IN,
    refresh_expires_in: env.JWT_REFRESH_EXPIRES_IN,
  },
  smtp: {
    smtp_host: env.SMTP_HOST,
    smtp_port: env.SMTP_PORT,
    smtp_service: env.SMTP_SERVICE,
    smtp_mail: env.SMTP_MAIL,
    smtp_password: env.SMTP_PASSWORD,
    NAME: env.SERVICE_NAME,
  },
  cloudinary: {
    cloud_name: env.CLOUD_NAME,
    api_key: env.API_KEY,
    api_secret: env.API_SECRET,
    cloudinary_url: env.CLOUDINARY_URL,
  },
  stripe: {
    stripe_secret_key: env.STRIPE_SECRET_KEY,
  },
  super_admin: {
    email: env.SUPER_ADMIN_EMAIL,
    password: env.SUPER_ADMIN_PASSWORD,
  },
  variables: {
    email_temp_image: env.EMAIL_TEMP_IMAGE,
    email_temp_text_secondary_color: env.EMAIL_TEMP_TEXT_SECONDARY_COLOR,
  },
};

export = config;
