export type AppRole = "USER" | "ADMIN" | "SUPER_ADMIN";

export interface AuthUserPayload {
  authId: string;
  userId: string;
  email: string;
  role: AppRole;
  iat?: number;
  exp?: number;
}
