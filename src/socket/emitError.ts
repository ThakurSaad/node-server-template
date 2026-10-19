import { status } from "../util/httpStatus";
import chalk from "chalk";
import { EnumSocketEvent } from "../util/enum";
import { Socket } from "socket.io";

const emitError = (
  socket: Socket,
  statusCode = status.INTERNAL_SERVER_ERROR,
  message = "Internal sever error",
  disconnect?: string,
): never => {
  socket.emit(EnumSocketEvent.SOCKET_ERROR, { status: statusCode, message });

  if (disconnect) {
    socket.disconnect(true);
    console.log(chalk.red("💀 disconnected because of error"));
  }

  throw new Error(message);
};

export = emitError;
