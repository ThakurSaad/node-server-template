import fs from "fs/promises";
import path from "path";
import { errorLogger } from "./logger";

const UPLOADS_DIR = path.resolve("uploads") + path.sep;

// Best-effort delete of an uploaded file. Never throws (a missing file must
// not fail the request, and an unhandled rejection stops the server) and
// never touches anything outside uploads/ (paths come from the database).
const unlinkFile = async (filePath: string): Promise<boolean> => {
  if (!filePath || !path.resolve(filePath).startsWith(UPLOADS_DIR)) {
    errorLogger.error(`unlinkFile: refusing to delete ${filePath}`);
    return false;
  }
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    errorLogger.error(`unlinkFile: could not delete ${filePath}`, error);
    return false;
  }
};

export = unlinkFile;
