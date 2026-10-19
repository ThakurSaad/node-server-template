import config from "../config";

const socketCors = {
  origin: config.cors_origins,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};

export = socketCors;
