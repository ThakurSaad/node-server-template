// fileTemplates.ts

export const modelTemplate = (moduleName: string): string => {
  const moduleNameLowerCase = moduleName.toLowerCase();

  return `
import { Schema, model } from "mongoose";

const ${moduleNameLowerCase}Schema = new Schema(
  {
    
  },
  {
    timestamps: true,
  }
);

export const ${moduleName} = model("${moduleName}", ${moduleNameLowerCase}Schema);
`;
};

export const controllerTemplate = (moduleName: string): string => {
  const moduleNameLowerCase = moduleName.toLowerCase();

  return `
import { Request, Response } from "express";
import ${moduleName}Service from "./${moduleNameLowerCase}.service";
import sendResponse from "../../../util/sendResponse";
import catchAsync from "../../../util/catchAsync";

const create${moduleName} = catchAsync(async (req: Request, res: Response) => {
  const result = await ${moduleName}Service.create${moduleName}(req.user, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "${moduleName} created",
    data: result,
  });
});

const get${moduleName} = catchAsync(async (req: Request, res: Response) => {
  const result = await ${moduleName}Service.get${moduleName}(req.user, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "${moduleName} retrieved",
    data: result,
  });
});

const getAll${moduleName}s = catchAsync(async (req: Request, res: Response) => {
  const result = await ${moduleName}Service.getAll${moduleName}s(req.user, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "${moduleName}s retrieved",
    data: result,
  });
});

const update${moduleName} = catchAsync(async (req: Request, res: Response) => {
  const result = await ${moduleName}Service.update${moduleName}(req.user, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "${moduleName} updated",
    data: result,
  });
});

const delete${moduleName} = catchAsync(async (req: Request, res: Response) => {
  const result = await ${moduleName}Service.delete${moduleName}(req.user, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "${moduleName} deleted",
    data: result,
  });
});

const ${moduleName}Controller = {
  create${moduleName},
  get${moduleName},
  getAll${moduleName}s,
  update${moduleName},
  delete${moduleName},
};

export default ${moduleName}Controller;
`;
};

export const routesTemplate = (moduleName: string): string => {
  const moduleNameLowerCase = moduleName.toLowerCase();

  return `
import express from "express";
import auth from "../../middleware/auth";
import config from "../../../config";
import ${moduleName}Controller from "./${moduleNameLowerCase}.controller";

const router = express.Router();

router
  .post(
    "/post-${moduleNameLowerCase}",
    auth(config.auth_level.user),
    ${moduleName}Controller.create${moduleName}
  )
  .get(
    "/get-${moduleNameLowerCase}",
    auth(config.auth_level.user),
    ${moduleName}Controller.get${moduleName}
  )
  .get(
    "/get-all-${moduleNameLowerCase}s",
    auth(config.auth_level.user),
    ${moduleName}Controller.getAll${moduleName}s
  )
  .patch(
    "/update-${moduleNameLowerCase}",
    auth(config.auth_level.user),
    ${moduleName}Controller.update${moduleName}
  )
  .delete(
    "/delete-${moduleNameLowerCase}",
    auth(config.auth_level.user),
    ${moduleName}Controller.delete${moduleName}
  );

export default router;
`;
};

export const serviceTemplate = (moduleName: string): string => {
  const moduleNameLowerCase = moduleName.toLowerCase();

  return `
import status from "./httpStatus";
import { ${moduleName} } from "./${moduleName}";
import QueryBuilder from "../../../builder/queryBuilder";
import ApiError from "../../../error/ApiError";
import validateFields from "../../../util/validateFields";

const create${moduleName} = async (
  userData: any,
  payload: any
) => {
  // Add your logic here
};

const get${moduleName} = async (
  userData: any,
  query: any
) => {
  validateFields(query, ["${moduleNameLowerCase}Id"]);

  const ${moduleNameLowerCase} = await ${moduleName}
    .findOne({
      _id: query.${moduleNameLowerCase}Id,
    })
    .lean();

  if (!${moduleNameLowerCase}) {
    throw new ApiError(status.NOT_FOUND, "${moduleName} not found");
  }

  return ${moduleNameLowerCase};
};

const getAll${moduleName}s = async (
  userData: any,
  query: any
) => {
  const ${moduleNameLowerCase}Query = new QueryBuilder(
    ${moduleName}.find({}).lean(),
    query
  )
    .search([])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [${moduleNameLowerCase}s, meta] = await Promise.all([
    ${moduleNameLowerCase}Query.modelQuery,
    ${moduleNameLowerCase}Query.countTotal(),
  ]);

  return {
    meta,
    ${moduleNameLowerCase}s,
  };
};

const update${moduleName} = async (
  userData: any,
  payload: any
) => {
  // Add your logic here
};

const delete${moduleName} = async (
  userData: any,
  payload: any
) => {
  validateFields(payload, ["${moduleNameLowerCase}Id"]);

  const ${moduleNameLowerCase} = await ${moduleName}.deleteOne({
    _id: payload.${moduleNameLowerCase}Id,
  });

  if (!${moduleNameLowerCase}.deletedCount) {
    throw new ApiError(status.NOT_FOUND, "${moduleName} not found");
  }

  return ${moduleNameLowerCase};
};

const ${moduleName}Service = {
  create${moduleName},
  get${moduleName},
  getAll${moduleName}s,
  update${moduleName},
  delete${moduleName},
};

export default ${moduleName}Service;
`;
};
