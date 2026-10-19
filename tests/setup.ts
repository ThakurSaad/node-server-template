// Runs before each test file's imports — src/config parses process.env at
// import time, so required variables must exist before anything else loads.
process.env.NODE_ENV = "test";
process.env.MONGO_URL = "mongodb://127.0.0.1:27017/test-placeholder";
process.env.JWT_SECRET = "test-jwt-secret-0123456789-0123456789-0123456789";
process.env.JWT_REFRESH_SECRET =
  "test-refresh-secret-0123456789-0123456789-0123456789";
process.env.JWT_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "30d";
// Low cost factor keeps password hashing fast in tests
process.env.BCRYPT_SALT_ROUNDS = "4";
