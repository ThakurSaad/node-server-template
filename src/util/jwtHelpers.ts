import jwt, { Secret, SignOptions } from "jsonwebtoken";

export const createToken = (
  payload: object,
  secret: Secret,
  expireTime: SignOptions["expiresIn"],
): string => {
  const options: SignOptions = { expiresIn: expireTime };
  return jwt.sign(payload, secret, options);
};

export const verifyToken = <T>(token: string, secret: Secret): T => {
  return jwt.verify(token, secret) as T;
};

export const jwtHelpers = {
  createToken,
  verifyToken,
};
