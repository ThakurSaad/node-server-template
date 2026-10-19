import { Socket } from "socket.io";

type ExtendedError = Error & { data?: unknown };
import config from "../config";
import { jwtHelpers } from "../util/jwtHelpers";
import Auth from "../app/module/auth/Auth";
import { AuthUserPayload } from "../types/auth.types";

// Socket.IO middleware: authenticates the handshake with the same JWT used
// by the REST API. The client must connect with `{ auth: { token } }`.
// Errors surface on the client as a `connect_error` event.
const socketAuth = async (
  socket: Socket,
  next: (err?: ExtendedError) => void,
) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, "");

    if (!token) return next(new Error("Authentication token is required"));

    const user = jwtHelpers.verifyToken<AuthUserPayload>(
      token,
      config.jwt.secret,
    );

    const auth = await Auth.findById(user.authId);
    if (!auth) return next(new Error("Account does not exist"));
    if (auth.isBlocked) return next(new Error("You are blocked"));
    if (!auth.isActive) return next(new Error("Account is not activated"));

    socket.data.user = user;
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
};

export = socketAuth;
