import { writeFileSafely } from "../utils/writeFileSafely";

export async function generateBaseRepository(outputPath: string) {
  const content = `
    /**
     * BaseRepository
     *
     * Abstract base class providing type-safe CRUD operations
     * backed by a Prisma delegate.
     *
     * @beta This feature is in beta.
     */

    /** Minimal Prisma delegate shape used by BaseRepository. */
    export interface PrismaDelegate {
      findUnique(args: any): Promise<any>;
      findFirst(args?: any): Promise<any>;
      findMany(args?: any): Promise<any[]>;
      create(args: any): Promise<any>;
      update(args: any): Promise<any>;
      delete(args: any): Promise<any>;
      count(args?: any): Promise<number>;
    }

    /** Options for findBy methods (include/select). */
    export type FindOptions = {
      include?: Record<string, any>;
      select?: Record<string, any>;
    };

    export type PaginateResult<TModel> = {
      data: TModel[];
      total: number;
      page: number;
      perPage: number;
      totalPages: number;
    };

    export abstract class BaseRepository<TModel> {
      constructor(protected readonly delegate: PrismaDelegate) {}

      /**
       * Convert a raw Prisma record into a domain model instance.
       * Subclasses MUST implement this method.
       */
      protected abstract toModel(record: any): TModel;

      /**
       * Find all records matching the given conditions.
       */
      async findMany(args?: Parameters<PrismaDelegate['findMany']>[0]): Promise<TModel[]> {
        const records = await this.delegate.findMany(args);
        return records.map((record) => this.toModel(record));
      }

      /**
       * Find the first record matching the given conditions.
       */
      async findFirst(args?: Parameters<PrismaDelegate['findFirst']>[0]): Promise<TModel | null> {
        const record = await this.delegate.findFirst(args);
        return record ? this.toModel(record) : null;
      }

      /**
       * Create a new record and return the domain model.
       */
      async create(args: Parameters<PrismaDelegate['create']>[0]): Promise<TModel> {
        const record = await this.delegate.create(args);
        return this.toModel(record);
      }

      /**
       * Update an existing record and return the domain model.
       */
      async update(args: Parameters<PrismaDelegate['update']>[0]): Promise<TModel> {
        const record = await this.delegate.update(args);
        return this.toModel(record);
      }

      /**
       * Delete a record and return the domain model of the deleted row.
       */
      async delete(args: Parameters<PrismaDelegate['delete']>[0]): Promise<TModel> {
        const record = await this.delegate.delete(args);
        return this.toModel(record);
      }

      /**
       * Count records matching the given conditions.
       */
      async count(args?: Parameters<PrismaDelegate['count']>[0]): Promise<number> {
        return this.delegate.count(args);
      }

      /**
       * Paginate records with the given conditions.
       */
      protected async paginate(args: {
        page: number;
        perPage: number;
        where?: Record<string, any>;
        orderBy?: Record<string, any>;
        include?: Record<string, any>;
      }): Promise<PaginateResult<TModel>> {
        const { page, perPage, where, orderBy, include } = args;
        const skip = (page - 1) * perPage;

        const [records, total] = await Promise.all([
          this.delegate.findMany({
            where,
            orderBy,
            include,
            skip,
            take: perPage,
          }),
          this.delegate.count({ where }),
        ]);

        return {
          data: records.map((record) => this.toModel(record)),
          total,
          page,
          perPage,
          totalPages: Math.ceil(total / perPage),
        };
      }
    }
  `;

  await writeFileSafely(`${outputPath}/BaseRepository.ts`, content);
  console.log("[Frourio Framework]Repository Generated: BaseRepository.ts");
}
