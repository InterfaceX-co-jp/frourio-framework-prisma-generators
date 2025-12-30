# frourio-framework-prisma-generators
- Generate model from prisma schema
- Can be compatible with `Json` type field by specifying type 

## Requirements
- prisma, @prisma/client@7.2.0 or later **(both need to be same version!)**

## Install

```bash
npm install -D frourio-framework-prisma-generators
```

```prisma
// model generator
generator frourio_framework_prisma_model_generator {
    provider = "frourio-framework-prisma-model-generator"
    output   = "__generated__/models"
    additionalTypePath = "./@additionalType/index" // If you need to type Json type field
}
```

## Typing Prisma Json field
- Please make sure you configure `additionalTypePath` attribute of generateor.

### 1. Add type annotation on your schema
```prisma
model JsonField {
  id Int @id @default(autoincrement())

  rawJson    Json
  jsonObject Json /// @json(type: [JsonObject])
  jsonArray  Json /// @json(type: [JsonArray])
}
```

### 2. Write your type equvalent to the annotated type
```ts
export type JsonObject = {
  foo: string;
  bar: number;
};

export type JsonArray = JsonObject[];
``` 

### 3. Boom 🚀
- Now your model can type the Json field with your annotated type

```ts
import { Prisma, JsonField as PrismaJsonField } from '@prisma/client';
import { JsonObject, JsonArray } from '../../@additionalType/index';

export type JsonFieldModelDto = {
  id: number;
  rawJson: Prisma.JsonValue;
  jsonObject: JsonObject;
  jsonArray: JsonArray;
};

export type JsonFieldModelConstructorArgs = {
  id: number;
  rawJson: Prisma.JsonValue;
  jsonObject: JsonObject;
  jsonArray: JsonArray;
};

export type JsonFieldModelFromPrismaValueArgs = {
  self: PrismaJsonField;
};

export class JsonFieldModel {
  private readonly _id: number;
  private readonly _rawJson: Prisma.JsonValue;
  private readonly _jsonObject: JsonObject;
  private readonly _jsonArray: JsonArray;

  constructor(args: JsonFieldModelConstructorArgs) {
    this._id = args.id;
    this._rawJson = args.rawJson;
    this._jsonObject = args.jsonObject;
    this._jsonArray = args.jsonArray;
  }

  static fromPrismaValue(args: JsonFieldModelFromPrismaValueArgs) {
    return new JsonFieldModel({
      id: args.self.id,
      rawJson: args.self.rawJson,
      jsonObject: args.self.jsonObject as unknown as JsonObject,
      jsonArray: args.self.jsonArray as unknown as JsonArray,
    });
  }

  toDto() {
    return {
      id: this._id,
      rawJson: this._rawJson,
      jsonObject: this._jsonObject,
      jsonArray: this._jsonArray,
    };
  }

  get id() {
    return this._id;
  }

  get rawJson() {
    return this._rawJson;
  }

  get jsonObject() {
    return this._jsonObject;
  }

  get jsonArray() {
    return this._jsonArray;
  }
}
```
