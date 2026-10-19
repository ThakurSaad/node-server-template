import { z } from "zod";

const text = z.string().trim().optional();

const editProfile = z.object({
  body: z.object({
    name: text,
    phoneNumber: text,
    address: text,
  }),
});

const deleteAccount = z.object({
  body: z.object({
    password: z.string().min(1, "Password is required"),
  }),
});

const createAdmin = z.object({
  body: z.object({
    name: z.string().trim().min(1, "Name is required"),
    email: z.string().email("Please provide a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
  }),
});

const AdminValidation = {
  editProfile,
  deleteAccount,
  createAdmin,
};

export = AdminValidation;
