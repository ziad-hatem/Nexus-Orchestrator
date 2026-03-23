import nextEnv from "@next/env";
import path from "node:path";
import { pathToFileURL } from "node:url";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd(), process.env.NODE_ENV === "development");

try {
  const cliModulePath = path.resolve(
    process.cwd(),
    "node_modules",
    "next-sitemap",
    "dist",
    "esm",
    "cli.js",
  );
  const { CLI } = await import(pathToFileURL(cliModulePath).href);
  await new CLI().execute();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
