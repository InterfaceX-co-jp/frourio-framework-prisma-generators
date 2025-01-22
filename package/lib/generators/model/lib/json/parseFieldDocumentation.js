"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFieldDocumentation = void 0;
const parseFieldDocumentation = (args) => {
    var _a;
    const documentation = args.field.documentation;
    if (documentation) {
        // use regexp to parse: @json(type: [T])
        const jsonType = (_a = documentation.match(/@json\(type: \[(.*)\]\)/)) === null || _a === void 0 ? void 0 : _a[1];
        return {
            type: {
                jsonType,
                hasJsonType: !!jsonType,
            },
        };
    }
};
exports.parseFieldDocumentation = parseFieldDocumentation;
//# sourceMappingURL=parseFieldDocumentation.js.map