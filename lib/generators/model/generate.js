"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generate = generate;
const transformer_1 = __importDefault(require("./transformer"));
const internals_1 = require("@prisma/internals");
const removeDir_1 = __importDefault(require("../utils/removeDir"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function generate(options) {
    try {
        const models = options.dmmf.datamodel.models;
        const t = new transformer_1.default({
            models,
        });
        if (options.generator.output) {
            const parsedPath = (0, internals_1.parseEnvValue)(options.generator.output);
            t.setOutputPath({ path: parsedPath });
            const parsedAdditionalTypePath = options.generator.config
                .additionalTypePath;
            if (parsedAdditionalTypePath) {
                const absolutePath = path_1.default.join(options.schemaPath, "..", parsedAdditionalTypePath);
                const relativePath = path_1.default.relative(parsedPath, absolutePath);
                t.setAdditionalTypePath({
                    path: relativePath,
                });
            }
            if (fs_1.default.existsSync(parsedPath)) {
                await (0, removeDir_1.default)(parsedPath, true);
            }
            else {
                fs_1.default.mkdirSync(parsedPath, { recursive: true });
            }
        }
        await t.transform();
    }
    catch (e) {
        console.error(e);
    }
}
//# sourceMappingURL=generate.js.map