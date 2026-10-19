import { z } from "zod";

// A Mongo ObjectId as a 24-hex string. Objects such as {"$ne": null} fail
// here, so request values can never carry query operators into a filter.
const objectId = z.string().regex(/^[0-9a-f]{24}$/i, "Invalid id");

export = objectId;
