import fs from "fs";
import { logger, errorLogger } from "./logger";

const deleteUploadedFiles = (uploadedFiles?: string[]): void => {
  if (!uploadedFiles || uploadedFiles.length === 0) return;

  uploadedFiles.forEach((filePath: string) => {
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err: NodeJS.ErrnoException | null) => {
        if (err) {
          errorLogger.error(`Failed to delete file: ${filePath}`, err);
        } else {
          logger.info(`Deleted file: ${filePath}`);
        }
      });
    } else {
      errorLogger.error(`File does not exist: ${filePath}`);
    }
  });
};

export = deleteUploadedFiles;
