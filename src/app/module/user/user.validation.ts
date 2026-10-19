import { z } from "zod";

const text = z.string().trim().optional();

const editProfile = z.object({
  body: z.object({
    name: text,
    phoneNumber: text,
    address: text,
    dateOfBirth: text,
  }),
});

const deleteAccount = z.object({
  body: z.object({
    password: z.string().min(1, "Password is required"),
  }),
});

const UserValidation = {
  editProfile,
  deleteAccount,
};

export = UserValidation;
