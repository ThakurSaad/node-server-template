import fs from "fs";
import path from "path";
import {
  modelTemplate,
  controllerTemplate,
  routesTemplate,
  serviceTemplate,
} from "./fileTemplates";

// Scaffolds a new domain module under src/app/module/<name>.
// Usage: npm run make:file -- <ModuleName>
const generateModule = (rawName: string): void => {
  const moduleName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const moduleFolder = rawName.toLowerCase();
  const dirPath = path.join(
    process.cwd(),
    "src",
    "app",
    "module",
    moduleFolder,
  );

  if (fs.existsSync(dirPath)) {
    console.log(`🚫 ${moduleName} module already exists.`);
    return;
  }

  fs.mkdirSync(dirPath, { recursive: true });

  fs.writeFileSync(
    path.join(dirPath, `${moduleName}.ts`),
    modelTemplate(moduleName),
  );

  fs.writeFileSync(
    path.join(dirPath, `${moduleFolder}.controller.ts`),
    controllerTemplate(moduleName),
  );

  fs.writeFileSync(
    path.join(dirPath, `${moduleFolder}.routes.ts`),
    routesTemplate(moduleName),
  );

  fs.writeFileSync(
    path.join(dirPath, `${moduleFolder}.service.ts`),
    serviceTemplate(moduleName),
  );

  console.log(`✅ ${moduleName} module files created successfully!`);
  console.log(`👉 Remember to mount the new router in src/app/routes/index.ts`);
};

const moduleName = process.argv[2];

if (!moduleName) {
  console.error("Usage: npm run make:file -- <ModuleName>");
  process.exit(1);
}

generateModule(moduleName);
