import express from "express";
import auth from "../../middleware/auth";
import { uploadFile } from "../../middleware/fileUploader";
import { AdminController } from "./admin.controller";
import config from "../../../config";

const router = express.Router();

router
  .post(
    "/create-admin",
    auth(config.auth_level.super_admin),
    AdminController.createAdmin,
  )
  .get("/profile", auth(config.auth_level.admin), AdminController.getProfile)
  .patch(
    "/edit-profile",
    auth(config.auth_level.admin),
    uploadFile(),
    AdminController.updateProfile,
  )
  .delete(
    "/delete-account",
    auth(config.auth_level.admin),
    AdminController.deleteMyAccount,
  );

export = router;
