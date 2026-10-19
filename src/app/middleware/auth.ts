import type { NextFunction, Request, Response } from "express";
import { status as httpStatus } from "../../util/httpStatus";
import config from "../../config";
import ApiError from "../../error/ApiError";
import { jwtHelpers } from "../../util/jwtHelpers";
import Auth from "../module/auth/Auth";
import type { AuthUserPayload } from "../../types/auth.types";

const auth =
  (roles: string[], isAccessible = true) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const tokenWithBearer = req.headers.authorization;
      if (!tokenWithBearer && !isAccessible) return next();
      if (!tokenWithBearer) {
        throw new ApiError(
          httpStatus.UNAUTHORIZED,
          "You are not authorized for this role",
        );
      }
      if (!tokenWithBearer.startsWith("Bearer")) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid token format");
      }

      const token = tokenWithBearer.split(" ")[1].trim();

      const verifyUser = jwtHelpers.verifyToken<AuthUserPayload>(
        token,
        config.jwt.secret,
      );
      req.user = verifyUser;

      const isExist = await Auth.findById(verifyUser.authId);
      if (!isExist) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "You are not authorized");
      }
      if (isExist.isBlocked) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "You are blocked. Contact support",
        );
      }
      if (!isExist.isActive) {
        throw new ApiError(httpStatus.FORBIDDEN, "Account is not activated");
      }

      if (roles.length && !roles.includes(verifyUser.role)) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "Access Forbidden: You do not have permission to perform this action",
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };

export = auth;
