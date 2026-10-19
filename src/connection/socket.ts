import http from "http";
import { Server } from "socket.io";
import app from "../app";
import socketHandlers from "../socket/socketHandlers";
import socketAuth from "../socket/socketAuth";
import socketCors from "./socketCors";
import { EnumSocketEvent } from "../util/enum";

const mainServer = http.createServer(app);

const io = new Server(mainServer, {
  cors: socketCors,
});

io.use(socketAuth);

io.on(EnumSocketEvent.CONNECTION, (socket) => {
  socketHandlers(socket, io, {});
});

export { mainServer, io };
