#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const generator_helper_1 = require("@prisma/generator-helper");
const generate_1 = require("./generate");
const package_json_1 = __importDefault(require("../../../package.json"));
(0, generator_helper_1.generatorHandler)({
    onManifest() {
        return {
            defaultOutput: "__generated__/models",
            prettyName: "[Frourio Framework]Models",
            version: package_json_1.default.version,
        };
    },
    onGenerate: generate_1.generate,
});
//# sourceMappingURL=index.js.map