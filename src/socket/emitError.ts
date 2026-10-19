import { status } from "../util/httpStatus";
import { EnumSocketEvent } from "../util/enum";
import { Socket } from "socket.io";
import { errorLogger } from "../util/logger";

const emitError = (
  socket: Socket,
  statusCode = status.INTERNAL_SERVER_ERROR,
  message = "Internal sever error",
  disconnect?: string,
): never => {
  socket.emit(EnumSocketEvent.SOCKET_ERROR, { status: statusCode, message });

  if (disconnect) {
    socket.disconnect(true);
    errorLogger.error(`Socket disconnected: ${message}`);
  }

  throw new Error(message);
};

export = emitError;
