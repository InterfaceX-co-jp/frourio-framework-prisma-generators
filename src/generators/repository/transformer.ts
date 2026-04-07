import type { DMMF as PrismaDMMF } from "@prisma/generator-helper";
import type { ReadonlyDeep } from "../utils/types";
import { writeFileSafely } from "../utils/writeFileSafely";
import * as changeCase from "change-case-all";

interface UniqueComposite {
  name: string | null;
  fields: string[];
}

export class RepositoryTransformer {
  private readonly _models: ReadonlyDeep<PrismaDMMF.Model[]>;
  private readonly _outputPath: string;
  private readonly _modelImportPath: string;

  constructor(args: {
    models: ReadonlyDeep<PrismaDMMF.Model[]>;
    outputPath: string;
    modelImportPath: string;
  }) {
    this._models = args.models;
    this._outputPath = args.outputPath;
    this._modelImportPath = args.modelImportPath;
  }

  // =========================================
  // Type mapping
  // =========================================

  private mapPrismaTypeToTs(field: ReadonlyDeep<PrismaDMMF.Field>): string {
    switch (field.type) {
      case "String":
        return "string";
      case "Int":
      case "Float":
      case "Decimal":
        return "number";
      case "Boolean":
        return "boolean";
      case "DateTime":
        return "Date";
      case "BigInt":
        return "bigint";
      case "Bytes":
        return "ArrayBuffer";
      case "Json":
        return "any";
      default:
        // Enum or other — return the Prisma enum type name
        if (field.kind === "enum") {
          return `Prisma${field.type}`;
        }
        return "string";
    }
  }

  private isEnumField(field: ReadonlyDeep<PrismaDMMF.Field>): boolean {
    return field.kind === "enum";
  }

  // =========================================
  // Field categorization
  // =========================================

  /**
   * Get fields marked with @id (single-field PKs).
   * If a composite @@id exists, returns those fields instead.
   */
  private getIdFields(
    model: ReadonlyDeep<PrismaDMMF.Model>,
  ): ReadonlyDeep<PrismaDMMF.Field>[] {
    // Check for composite @@id first
    if (model.primaryKey && model.primaryKey.fields.length > 0) {
      return model.primaryKey.fields
        .map((name) => model.fields.find((f) => f.name === name))
        .filter((f): f is ReadonlyDeep<PrismaDMMF.Field> => f !== undefined);
    }

    // Single @id fields only (not @unique)
    return model.fields.filter((f) => f.isId);
  }

  /**
   * Get fields marked with @unique (single-field uniques),
   * excluding @id fields.
   */
  private getUniqueFields(
    model: ReadonlyDeep<PrismaDMMF.Model>,
  ): ReadonlyDeep<PrismaDMMF.Field>[] {
    return model.fields.filter(
      (f) => f.isUnique && !f.isId && !f.relationName,
    );
  }

  /**
   * Get composite @@unique constraints.
   */
  private getCompositeUniques(
    model: ReadonlyDeep<PrismaDMMF.Model>,
  ): UniqueComposite[] {
    return (model.uniqueFields ?? [])
      .filter((fields) => fields.length > 1)
      .map((fields) => ({
        name: null,
        fields: [...fields],
      }));
  }

  /**
   * Get relation fields for the model.
   */
  private getRelationFields(
    model: ReadonlyDeep<PrismaDMMF.Model>,
  ): ReadonlyDeep<PrismaDMMF.Field>[] {
    return model.fields.filter((f) => f.relationName);
  }

  /**
   * Get scalar fields excluding FK fields that have a corresponding relation.
   */
  private getScalarFieldsExcludingFk(
    model: ReadonlyDeep<PrismaDMMF.Model>,
  ): ReadonlyDeep<PrismaDMMF.Field>[] {
    const fkFieldNames = new Set<string>();
    for (const field of model.fields) {
      if (field.relationName && field.relationFromFields) {
        for (const fk of field.relationFromFields) {
          fkFieldNames.add(fk);
        }
      }
    }

    return model.fields.filter(
      (f) => !f.relationName && f.kind !== "unsupported" && !fkFieldNames.has(f.name),
    );
  }

  /**
   * Collect all enum types used by a model's fields.
   */
  private getEnumImports(
    model: ReadonlyDeep<PrismaDMMF.Model>,
  ): string[] {
    const enums = new Set<string>();
    for (const field of model.fields) {
      if (field.kind === "enum") {
        enums.add(field.type);
      }
    }
    return [...enums];
  }

  // =========================================
  // findBy method generation
  // =========================================

  /**
   * Generate findByXXXX method for a single @id or @unique field.
   * Includes optional `options` parameter for include/select.
   */
  private generateFindByFieldMethod(
    model: ReadonlyDeep<PrismaDMMF.Model>,
    field: ReadonlyDeep<PrismaDMMF.Field>,
  ): string {
    const fieldName = changeCase.camelCase(field.name);
    const methodName = `findBy${changeCase.pascalCase(field.name)}`;
    const tsType = this.mapPrismaTypeToTs(field);

    return `
    async ${methodName}(${fieldName}: ${tsType}, options?: FindOptions): Promise<${model.name}Model | null> {
      const record = await this.delegate.findUnique({
        where: { ${fieldName} },
        ...options,
      });
      return record ? this.toModel(record) : null;
    }`;
  }

  /**
   * Generate findByXXXXAndYYYY method for @@unique composite keys.
   */
  private generateFindByCompositeMethod(
    model: ReadonlyDeep<PrismaDMMF.Model>,
    composite: UniqueComposite,
  ): string {
    const resolvedFields = composite.fields
      .map((name) => model.fields.find((f) => f.name === name))
      .filter((f): f is ReadonlyDeep<PrismaDMMF.Field> => f !== undefined);

    const methodName =
      "findBy" +
      resolvedFields
        .map((f) => changeCase.pascalCase(f.name))
        .join("And");

    const params = resolvedFields
      .map((f) => `${changeCase.camelCase(f.name)}: ${this.mapPrismaTypeToTs(f)}`)
      .join(", ");

    const whereFields = resolvedFields
      .map((f) => changeCase.camelCase(f.name))
      .join(", ");

    // Prisma uses a composite unique key name: fieldA_fieldB
    const compositeKeyName = composite.fields.join("_");

    return `
    async ${methodName}(${params}, options?: FindOptions): Promise<${model.name}Model | null> {
      const record = await this.delegate.findUnique({
        where: { ${compositeKeyName}: { ${whereFields} } },
        ...options,
      });
      return record ? this.toModel(record) : null;
    }`;
  }

  // =========================================
  // toModel generation with relation support
  // =========================================

  /**
   * Generate toModel that sets relation fields from the record if present.
   */
  private generateToModel(
    model: ReadonlyDeep<PrismaDMMF.Model>,
  ): string {
    const relationFields = this.getRelationFields(model);

    if (relationFields.length === 0) {
      return `
    protected toModel(record: any): ${model.name}Model {
      return ${model.name}Model.builder().fromPrisma(record).build();
    }`;
    }

    const relationSetters = relationFields.map((f) => {
      const camelName = changeCase.camelCase(f.name);
      return `    if (record.${camelName} !== undefined) builder.${camelName}(record.${camelName});`;
    });

    return `
    protected toModel(record: any): ${model.name}Model {
      const builder = ${model.name}Model.builder().fromPrisma(record);
${relationSetters.join("\n")}
      return builder.build();
    }`;
  }

  // =========================================
  // WhereFilter generation
  // =========================================

  private generateWhereFilterField(field: ReadonlyDeep<PrismaDMMF.Field>): string {
    const fieldName = changeCase.camelCase(field.name);
    const tsType = this.mapPrismaTypeToTs(field);
    const nullSuffix = field.isRequired ? "" : " | null";

    // Array fields — use Prisma array filter operators
    if (field.isList) {
      return `${fieldName}?: { has?: ${tsType}; hasEvery?: ${tsType}[]; hasSome?: ${tsType}[]; isEmpty?: boolean }`;
    }

    // String fields — exact match, contains, startsWith, endsWith
    if (field.type === "String") {
      return `${fieldName}?: ${tsType}${nullSuffix} | { contains?: string; startsWith?: string; endsWith?: string; mode?: 'insensitive' | 'default'; not?: ${tsType}${nullSuffix} }`;
    }

    // DateTime — exact, range, not
    if (field.type === "DateTime") {
      return `${fieldName}?: ${tsType}${nullSuffix} | { equals?: ${tsType}; gte?: ${tsType}; gt?: ${tsType}; lte?: ${tsType}; lt?: ${tsType}; not?: ${tsType}${nullSuffix} }`;
    }

    // Numeric types — exact, range, not
    if (
      field.type === "Int" ||
      field.type === "Float" ||
      field.type === "Decimal" ||
      field.type === "BigInt"
    ) {
      return `${fieldName}?: ${tsType}${nullSuffix} | { equals?: ${tsType}; gte?: ${tsType}; gt?: ${tsType}; lte?: ${tsType}; lt?: ${tsType}; in?: ${tsType}[]; notIn?: ${tsType}[]; not?: ${tsType}${nullSuffix} }`;
    }

    // Boolean — exact, not
    if (field.type === "Boolean") {
      return `${fieldName}?: ${tsType}${nullSuffix} | { equals?: ${tsType}; not?: ${tsType}${nullSuffix} }`;
    }

    // Enum — exact, in, notIn, not
    if (this.isEnumField(field)) {
      return `${fieldName}?: ${tsType}${nullSuffix} | { equals?: ${tsType}; in?: ${tsType}[]; notIn?: ${tsType}[]; not?: ${tsType}${nullSuffix} }`;
    }

    // Json, Bytes, etc. — passthrough
    return `${fieldName}?: ${tsType}${nullSuffix}`;
  }

  // =========================================
  // Relation filter generation
  // =========================================

  private generateRelationFilterFields(
    model: ReadonlyDeep<PrismaDMMF.Model>,
  ): string {
    const relationFields = this.getRelationFields(model);
    if (relationFields.length === 0) return "";

    return relationFields
      .map((f) => {
        const camelName = changeCase.camelCase(f.name);
        if (f.isList) {
          // List relation: some, every, none
          return `${camelName}?: { some?: Record<string, any>; every?: Record<string, any>; none?: Record<string, any> }`;
        }
        // Single relation: is, isNot
        return `${camelName}?: { is?: Record<string, any>; isNot?: Record<string, any> } | null`;
      })
      .join(";\n      ");
  }

  // =========================================
  // Paginate generation
  // =========================================

  private generatePaginateMethod(
    model: ReadonlyDeep<PrismaDMMF.Model>,
  ): { typeDefinition: string; method: string; cursorMethod: string } {
    const scalarFields = this.getScalarFieldsExcludingFk(model);

    const filterFields = scalarFields
      .map((f) => this.generateWhereFilterField(f))
      .join(";\n      ");

    const relationFilterFields = this.generateRelationFilterFields(model);

    const sortableFields = scalarFields
      .map((f) => `'${changeCase.camelCase(f.name)}'`)
      .join(" | ");

    // Get the cursor field type (default: id)
    const idFields = this.getIdFields(model);
    const cursorField = idFields.length > 0 ? idFields[0] : null;
    const cursorType = cursorField ? this.mapPrismaTypeToTs(cursorField) : "string | number";
    const cursorFieldName = cursorField ? changeCase.camelCase(cursorField.name) : "id";

    const typeDefinition = `
    export type ${model.name}WhereFilter = {
      ${filterFields};${relationFilterFields ? `\n      ${relationFilterFields};` : ""}
    };

    export type ${model.name}OrderBy = {
      field: ${sortableFields};
      direction: 'asc' | 'desc';
    };

    export type ${model.name}PaginateArgs = {
      page?: number;
      perPage?: number;
      where?: ${model.name}WhereFilter;
      orderBy?: ${model.name}OrderBy | ${model.name}OrderBy[];
      include?: Record<string, any>;
    };

    export type ${model.name}CursorPaginateArgs = {
      cursor?: ${cursorType};
      take?: number;
      where?: ${model.name}WhereFilter;
      orderBy?: ${model.name}OrderBy;
      include?: Record<string, any>;
    };`;

    const method = `
    async paginate(args?: ${model.name}PaginateArgs): Promise<PaginateResult<${model.name}Model>> {
      const page = args?.page ?? 1;
      const perPage = args?.perPage ?? 20;

      const orderBy = args?.orderBy
        ? (Array.isArray(args.orderBy)
            ? args.orderBy.map((o) => ({ [o.field]: o.direction }))
            : { [args.orderBy.field]: args.orderBy.direction })
        : undefined;

      return super.paginate({
        page,
        perPage,
        where: args?.where as Record<string, any>,
        orderBy: orderBy as Record<string, any>,
        include: args?.include,
      });
    }`;

    const cursorMethod = `
    async cursorPaginate(args?: ${model.name}CursorPaginateArgs): Promise<CursorPaginateResult<${model.name}Model>> {
      const take = args?.take ?? 20;

      const orderBy = args?.orderBy
        ? { [args.orderBy.field]: args.orderBy.direction }
        : undefined;

      return super.cursorPaginate({
        cursor: args?.cursor,
        take,
        cursorField: '${cursorFieldName}',
        where: args?.where as Record<string, any>,
        orderBy: orderBy as Record<string, any>,
        include: args?.include,
      });
    }`;

    return { typeDefinition, method, cursorMethod };
  }

  // =========================================
  // Full repository file generation
  // =========================================

  private generateRepositoryForModel(
    model: ReadonlyDeep<PrismaDMMF.Model>,
  ): string {
    const idFields = this.getIdFields(model);
    const uniqueFields = this.getUniqueFields(model);
    const compositeUniques = this.getCompositeUniques(model);
    const enumImports = this.getEnumImports(model);

    // Generate findBy methods for @id fields
    const findByIdMethods = idFields.map((f) =>
      this.generateFindByFieldMethod(model, f),
    );

    // Generate findBy methods for @unique fields
    const findByUniqueMethods = uniqueFields.map((f) =>
      this.generateFindByFieldMethod(model, f),
    );

    // Generate findByXXXAndYYY methods for @@unique composites
    const findByCompositeMethods = compositeUniques.map((c) =>
      this.generateFindByCompositeMethod(model, c),
    );

    // Generate paginate + cursor paginate
    const { typeDefinition: paginateTypes, method: paginateMethod, cursorMethod } =
      this.generatePaginateMethod(model);

    // Generate toModel with relation support
    const toModelMethod = this.generateToModel(model);

    const allMethods = [
      ...findByIdMethods,
      ...findByUniqueMethods,
      ...findByCompositeMethods,
      paginateMethod,
      cursorMethod,
    ].join("\n");

    // Build import for enums from @prisma/client
    const enumImportLine = enumImports.length > 0
      ? `import { ${enumImports.map((e) => `${e} as Prisma${e}`).join(", ")} } from '@prisma/client';`
      : "";

    return `
      import { ${model.name}Model } from '${this._modelImportPath}/${model.name}.model';
      import { BaseRepository, PaginateResult, CursorPaginateResult, FindOptions } from './BaseRepository';
      ${enumImportLine}

      ${paginateTypes}

      export class ${model.name}Repository extends BaseRepository<${model.name}Model> {
        ${toModelMethod}

        ${allMethods}
      }
    `;
  }

  async transform() {
    for (const model of this._models) {
      const content = this.generateRepositoryForModel(model);
      const fileName = `${model.name}.repository.ts`;

      await writeFileSafely(`${this._outputPath}/${fileName}`, content);
      console.log(
        `[Frourio Framework]Repository Generated: ${fileName}`,
      );
    }
  }
}
