import config from "../config";

// ADMIN and SUPER_ADMIN share admin privileges everywhere (config.auth_level)
const isAdmin = (role: string): boolean =>
  config.auth_level.admin.includes(role);

export = isAdmin;
