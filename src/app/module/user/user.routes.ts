import express from "express";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { uploadFile } from "../../middleware/fileUploader";
import { UserController } from "./user.controller";
import UserValidation from "./user.validation";
import config from "../../../config";

const router = express.Router();

router
  .get("/profile", auth(config.auth_level.user), UserController.getProfile)
  .patch(
    "/edit-profile",
    auth(config.auth_level.user),
    uploadFile(),
    validateRequest(UserValidation.editProfile),
    UserController.updateProfile,
  )
  .delete(
    "/delete-account",
    auth(config.auth_level.user),
    validateRequest(UserValidation.deleteAccount),
    UserController.deleteMyAccount,
  );

export = router;
