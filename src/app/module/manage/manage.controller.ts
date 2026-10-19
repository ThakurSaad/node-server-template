import { Request, Response } from "express";
import catchAsync from "../../../util/catchAsync";
import sendResponse from "../../../util/sendResponse";
import { ManageService } from "./manage.service";

const addTermsConditions = catchAsync(async (req: Request, res: Response) => {
  const { message, result } = await ManageService.addTermsConditions(req.body);
  sendResponse(res, { statusCode: 200, success: true, message, data: result });
});

const getTermsConditions = catchAsync(async (_req: Request, res: Response) => {
  const data = await ManageService.getTermsConditions();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Successful",
    data,
  });
});

const deleteTermsConditions = catchAsync(
  async (req: Request, res: Response) => {
    const data = await ManageService.deleteTermsConditions(
      req.query as { id: string },
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Deletion Successful",
      data,
    });
  },
);

const addPrivacyPolicy = catchAsync(async (req: Request, res: Response) => {
  const { message, result } = await ManageService.addPrivacyPolicy(req.body);
  sendResponse(res, { statusCode: 200, success: true, message, data: result });
});

const getPrivacyPolicy = catchAsync(async (_req: Request, res: Response) => {
  const data = await ManageService.getPrivacyPolicy();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Successful",
    data,
  });
});

const deletePrivacyPolicy = catchAsync(async (req: Request, res: Response) => {
  const data = await ManageService.deletePrivacyPolicy(
    req.query as { id: string },
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Deletion Successful",
    data,
  });
});

const addAboutUs = catchAsync(async (req: Request, res: Response) => {
  const { message, result } = await ManageService.addAboutUs(req.body);
  sendResponse(res, { statusCode: 200, success: true, message, data: result });
});

const getAboutUs = catchAsync(async (_req: Request, res: Response) => {
  const data = await ManageService.getAboutUs();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Successful",
    data,
  });
});

const deleteAboutUs = catchAsync(async (req: Request, res: Response) => {
  const data = await ManageService.deleteAboutUs(req.query as { id: string });
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Deletion Successful",
    data,
  });
});

const addFaq = catchAsync(async (req: Request, res: Response) => {
  const { message, result } = await ManageService.addFaq(req.body);
  sendResponse(res, { statusCode: 200, success: true, message, data: result });
});

const getFaq = catchAsync(async (_req: Request, res: Response) => {
  const data = await ManageService.getFaq();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Successful",
    data,
  });
});

const deleteFaq = catchAsync(async (req: Request, res: Response) => {
  const data = await ManageService.deleteFaq(req.query as { id: string });
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Deletion Successful",
    data,
  });
});

const addContactUs = catchAsync(async (req: Request, res: Response) => {
  const { message, result } = await ManageService.addContactUs(req.body);
  sendResponse(res, { statusCode: 200, success: true, message, data: result });
});

const getContactUs = catchAsync(async (_req: Request, res: Response) => {
  const data = await ManageService.getContactUs();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Successful",
    data,
  });
});

const deleteContactUs = catchAsync(async (req: Request, res: Response) => {
  const data = await ManageService.deleteContactUs(req.query as { id: string });
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Deletion Successful",
    data,
  });
});

const ManageController = {
  addPrivacyPolicy,
  getPrivacyPolicy,
  deletePrivacyPolicy,
  addTermsConditions,
  getTermsConditions,
  deleteTermsConditions,
  addAboutUs,
  getAboutUs,
  deleteAboutUs,
  addFaq,
  getFaq,
  deleteFaq,
  addContactUs,
  getContactUs,
  deleteContactUs,
};

export { ManageController };
