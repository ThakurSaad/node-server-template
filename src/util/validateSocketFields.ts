import { status } from "./httpStatus";
import { Socket } from "socket.io";
import emitError from "../socket/emitError";

/**
 * Validates required fields in socket event payloads
 * Throws custom errors when validation fails
 *
 * @param {Object} payload - The data object from socket event
 * @param {Array} requiredFields - Array of field names that are required
 * @param {Object} socket - Socket.io socket instance for error emission
 */
const validateSocketFields = <T extends object>(
  socket: Socket,
  payload: T,
  requiredFields: (keyof T & string)[],
): void => {
  if (!payload) {
    emitError(socket, status.BAD_REQUEST, "Request payload is required");
  }

  for (const field of requiredFields) {
    const value = (payload as Record<string, unknown>)[field];
    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "")
    ) {
      emitError(socket, status.BAD_REQUEST, `${field} is required`);
    }
  }
};

export = validateSocketFields;
