import { z } from "zod";
import objectId from "../../../util/objectIdSchema";

const addContent = z.object({
  body: z.object({
    description: z.string().trim().min(1, "Description is required"),
  }),
});

const deleteContent = z.object({
  query: z.object({
    id: objectId,
  }),
});

const ManageValidation = {
  addContent,
  deleteContent,
};

export = ManageValidation;
