import { AuthUserPayload } from "../types/auth.types";

export interface SocketData {
  user: AuthUserPayload;
}

export interface ServerToClientEvents {
  send_message: (payload: unknown) => void;
  socket_error: (payload: { status: number; message: string }) => void;
  online_status: (payload: unknown) => void;
  update_location: (payload: unknown) => void;
}

export interface ClientToServerEvents {
  send_message: (payload: {
    receiverId: string;
    chatId: string;
    message: string;
  }) => void;
}
