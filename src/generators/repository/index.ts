#!/usr/bin/env node
import { generatorHandler } from "@prisma/generator-helper";
import { generate } from "./generate";

generatorHandler({
  onManifest() {
    return {
      defaultOutput: "__generated__/repository",
      prettyName: "[Frourio Framework]Repository",
      version: "1.0.0",
    };
  },
  onGenerate: generate,
});
