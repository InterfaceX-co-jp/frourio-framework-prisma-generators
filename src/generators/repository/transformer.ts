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
        // Enum or other
        return "string";
    }
  }

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

    // Single @id fields
    return model.fields.filter((f) => f.isId);
  }

  /**
   * Get fields marked with @unique (single-field uniques).
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
   * Generate findByXXXX method for a single @id or @unique field.
   */
  private generateFindByFieldMethod(
    model: ReadonlyDeep<PrismaDMMF.Model>,
    field: ReadonlyDeep<PrismaDMMF.Field>,
  ): string {
    const fieldName = changeCase.camelCase(field.name);
    const methodName = `findBy${changeCase.pascalCase(field.name)}`;
    const tsType = this.mapPrismaTypeToTs(field);

    return `
    async ${methodName}(${fieldName}: ${tsType}): Promise<${model.name}Model | null> {
      const record = await this.delegate.findUnique({ where: { ${fieldName} } });
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
    async ${methodName}(${params}): Promise<${model.name}Model | null> {
      const record = await this.delegate.findUnique({
        where: { ${compositeKeyName}: { ${whereFields} } },
      });
      return record ? this.toModel(record) : null;
    }`;
  }

  /**
   * Generate the paginate method with typed where filter.
   */
  private generatePaginateMethod(
    model: ReadonlyDeep<PrismaDMMF.Model>,
  ): { typeDefinition: string; method: string } {
    const scalarFields = model.fields.filter(
      (f) => !f.relationName && f.kind !== "unsupported",
    );

    // Build filter type - each field can be filtered with its type or undefined
    const filterFields = scalarFields
      .map((f) => {
        const tsType = this.mapPrismaTypeToTs(f);
        const fieldName = changeCase.camelCase(f.name);

        // For string fields, allow contains-style filtering
        if (f.type === "String") {
          return `${fieldName}?: ${tsType} | { contains: string; mode?: 'insensitive' | 'default' }`;
        }

        // For DateTime, allow range filtering
        if (f.type === "DateTime") {
          return `${fieldName}?: ${tsType} | { gte?: ${tsType}; lte?: ${tsType} }`;
        }

        // For numeric types, allow range filtering
        if (
          f.type === "Int" ||
          f.type === "Float" ||
          f.type === "Decimal" ||
          f.type === "BigInt"
        ) {
          return `${fieldName}?: ${tsType} | { gte?: ${tsType}; lte?: ${tsType} }`;
        }

        return `${fieldName}?: ${tsType}`;
      })
      .join(";\n      ");

    const sortableFields = scalarFields
      .map((f) => `'${changeCase.camelCase(f.name)}'`)
      .join(" | ");

    const typeDefinition = `
    export type ${model.name}WhereFilter = {
      ${filterFields};
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
      });
    }`;

    return { typeDefinition, method };
  }

  /**
   * Generate a full repository file for a model.
   */
  private generateRepositoryForModel(
    model: ReadonlyDeep<PrismaDMMF.Model>,
  ): string {
    const idFields = this.getIdFields(model);
    const uniqueFields = this.getUniqueFields(model);
    const compositeUniques = this.getCompositeUniques(model);

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

    // Generate paginate
    const { typeDefinition: paginateTypes, method: paginateMethod } =
      this.generatePaginateMethod(model);

    const allMethods = [
      ...findByIdMethods,
      ...findByUniqueMethods,
      ...findByCompositeMethods,
      paginateMethod,
    ].join("\n");

    return `
      import { ${model.name}Model } from '${this._modelImportPath}/${model.name}.model';
      import { BaseRepository, PaginateResult } from './BaseRepository';

      ${paginateTypes}

      export class ${model.name}Repository extends BaseRepository<${model.name}Model> {
        protected toModel(record: any): ${model.name}Model {
          return ${model.name}Model.builder().fromPrisma(record).build();
        }

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
