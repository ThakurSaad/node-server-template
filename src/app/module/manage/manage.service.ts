import { status } from "../../../util/httpStatus";
import {
  TermsConditions,
  PrivacyPolicy,
  AboutUs,
  FAQ,
  ContactUs,
} from "./Manage";
import ApiError from "../../../error/ApiError";

interface IdQuery {
  id: string;
}

interface UpsertResult {
  message: string;
  result: unknown;
}

const upsertDoc = async (
  Model: typeof TermsConditions,
  payload: object,
  updatedMessage: string,
): Promise<UpsertResult | unknown> => {
  const exists = await Model.findOne();

  if (exists) {
    const result = await Model.findOneAndUpdate({}, payload, {
      returnDocument: "after",
      runValidators: true,
    });
    return { message: updatedMessage, result };
  }

  return await Model.create(payload);
};

const addTermsConditions = (payload: object) =>
  upsertDoc(TermsConditions, payload, "Terms & conditions updated");

const getTermsConditions = () => TermsConditions.findOne();

const deleteTermsConditions = async ({ id }: IdQuery) => {
  const result = await TermsConditions.deleteOne({ _id: id });
  if (!result.deletedCount)
    throw new ApiError(status.NOT_FOUND, "TermsConditions not found");
  return result;
};

const addPrivacyPolicy = (payload: object) =>
  upsertDoc(PrivacyPolicy, payload, "Privacy policy updated");

const getPrivacyPolicy = () => PrivacyPolicy.findOne();

const deletePrivacyPolicy = async ({ id }: IdQuery) => {
  const result = await PrivacyPolicy.deleteOne({ _id: id });
  if (!result.deletedCount)
    throw new ApiError(status.NOT_FOUND, "Privacy Policy not found");
  return result;
};

const addAboutUs = (payload: object) =>
  upsertDoc(AboutUs, payload, "About Us updated");

const getAboutUs = () => AboutUs.findOne();

const deleteAboutUs = async ({ id }: IdQuery) => {
  const result = await AboutUs.deleteOne({ _id: id });
  if (!result.deletedCount)
    throw new ApiError(status.NOT_FOUND, "About Us not found");
  return result;
};

const addFaq = (payload: object) => upsertDoc(FAQ, payload, "FAQ updated");

const getFaq = () => FAQ.findOne({});

const deleteFaq = async ({ id }: IdQuery) => {
  const result = await FAQ.deleteOne({ _id: id });
  if (!result.deletedCount)
    throw new ApiError(status.NOT_FOUND, "FAQ not found");
  return result;
};

const addContactUs = (payload: object) =>
  upsertDoc(ContactUs, payload, "Contact Us updated");

const getContactUs = () => ContactUs.findOne({});

const deleteContactUs = async ({ id }: IdQuery) => {
  const result = await ContactUs.deleteOne({ _id: id });
  if (!result.deletedCount)
    throw new ApiError(status.NOT_FOUND, "Contact Us not found");
  return result;
};

const ManageService = {
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

export { ManageService };
