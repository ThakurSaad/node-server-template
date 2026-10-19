import { Router } from "express";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { ManageController } from "./manage.controller";
import ManageValidation from "./manage.validation";
import config from "../../../config";

const router = Router();

router
  .post(
    "/add-terms-conditions",
    auth(config.auth_level.admin),
    validateRequest(ManageValidation.addContent),
    ManageController.addTermsConditions,
  )
  .get("/get-terms-conditions", ManageController.getTermsConditions)
  .delete(
    "/delete-terms-conditions",
    auth(config.auth_level.admin),
    validateRequest(ManageValidation.deleteContent),
    ManageController.deleteTermsConditions,
  )

  .post(
    "/add-privacy-policy",
    auth(config.auth_level.admin),
    validateRequest(ManageValidation.addContent),
    ManageController.addPrivacyPolicy,
  )
  .get("/get-privacy-policy", ManageController.getPrivacyPolicy)
  .delete(
    "/delete-privacy-policy",
    auth(config.auth_level.admin),
    validateRequest(ManageValidation.deleteContent),
    ManageController.deletePrivacyPolicy,
  )

  .post(
    "/add-about-us",
    auth(config.auth_level.admin),
    validateRequest(ManageValidation.addContent),
    ManageController.addAboutUs,
  )
  .get("/get-about-us", ManageController.getAboutUs)
  .delete(
    "/delete-about-us",
    auth(config.auth_level.admin),
    validateRequest(ManageValidation.deleteContent),
    ManageController.deleteAboutUs,
  )

  .post(
    "/add-faq",
    auth(config.auth_level.admin),
    validateRequest(ManageValidation.addContent),
    ManageController.addFaq,
  )
  .get("/get-faq", ManageController.getFaq)
  .delete(
    "/delete-faq",
    auth(config.auth_level.admin),
    validateRequest(ManageValidation.deleteContent),
    ManageController.deleteFaq,
  )

  .post(
    "/add-contact-us",
    auth(config.auth_level.admin),
    validateRequest(ManageValidation.addContent),
    ManageController.addContactUs,
  )
  .get("/get-contact-us", ManageController.getContactUs)
  .delete(
    "/delete-contact-us",
    auth(config.auth_level.admin),
    validateRequest(ManageValidation.deleteContent),
    ManageController.deleteContactUs,
  );

export = router;
