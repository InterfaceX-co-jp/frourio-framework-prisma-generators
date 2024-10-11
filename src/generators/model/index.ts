#!/usr/bin/env node
import { generatorHandler } from "@prisma/generator-helper";
import { generate as generateDomainModel } from "./generate";
import packageJson from "../../../package.json";

generatorHandler({
  onManifest() {
    return {
      defaultOutput: "__generated__/models",
      prettyName: "[Frourio Framework]Models",
      version: packageJson.version,
    };
  },
  onGenerate: generateDomainModel,
});
