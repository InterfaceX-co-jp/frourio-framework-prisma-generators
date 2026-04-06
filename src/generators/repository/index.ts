#!/usr/bin/env node
import { generatorHandler } from "@prisma/generator-helper";
import { generate as generateRepository } from "./generate";
import packageJson from "../../../package.json";

generatorHandler({
  onManifest() {
    return {
      defaultOutput: "__generated__/repository",
      prettyName: "[Frourio Framework]Repositories",
      version: packageJson.version,
    };
  },
  onGenerate: generateRepository,
});
