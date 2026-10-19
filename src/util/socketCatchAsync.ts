import { Server, Socket } from "socket.io";
import { errorLogger } from "./logger";

// Socket counterpart of catchAsync: a failing handler is logged, never thrown
const socketCatchAsync =
  <P, R>(fn: (socket: Socket, io: Server, payload: P) => Promise<R>) =>
  async (socket: Socket, io: Server, payload: P): Promise<R | undefined> => {
    try {
      return await fn(socket, io, payload);
    } catch (error) {
      errorLogger.error(`Socket handler failed (socket ${socket.id})`, error);
      return undefined;
    }
  };

export = socketCatchAsync;
