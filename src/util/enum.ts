const EnumUserRole = {
  USER: "USER",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
};

const EnumSocketEvent = {
  CONNECTION: "connection",
  DISCONNECT: "disconnect",

  SOCKET_ERROR: "socket_error",
  ONLINE_STATUS: "online_status",
  UPDATE_LOCATION: "update_location",

  SEND_MESSAGE: "send_message",
};

export { EnumUserRole, EnumSocketEvent };
