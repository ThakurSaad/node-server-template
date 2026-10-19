import express from "express";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { uploadFile } from "../../middleware/fileUploader";
import { AdminController } from "./admin.controller";
import AdminValidation from "./admin.validation";
import config from "../../../config";

const router = express.Router();

router
  .post(
    "/create-admin",
    auth(config.auth_level.super_admin),
    validateRequest(AdminValidation.createAdmin),
    AdminController.createAdmin,
  )
  .get("/profile", auth(config.auth_level.admin), AdminController.getProfile)
  .patch(
    "/edit-profile",
    auth(config.auth_level.admin),
    uploadFile(),
    validateRequest(AdminValidation.editProfile),
    AdminController.updateProfile,
  )
  .delete(
    "/delete-account",
    auth(config.auth_level.admin),
    validateRequest(AdminValidation.deleteAccount),
    AdminController.deleteMyAccount,
  );

export = router;
