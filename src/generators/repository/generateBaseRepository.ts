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
      createMany(args: any): Promise<{ count: number }>;
      update(args: any): Promise<any>;
      updateMany(args: any): Promise<{ count: number }>;
      delete(args: any): Promise<any>;
      deleteMany(args?: any): Promise<{ count: number }>;
      upsert(args: any): Promise<any>;
      count(args?: any): Promise<number>;
      aggregate(args: any): Promise<any>;
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

    export type CursorPaginateResult<TModel> = {
      data: TModel[];
      nextCursor: string | number | null;
      hasMore: boolean;
    };

    export type BatchResult = {
      count: number;
    };

    export type AggregateResult = {
      _count: number | null;
      _sum: Record<string, number | null> | null;
      _avg: Record<string, number | null> | null;
      _min: Record<string, any> | null;
      _max: Record<string, any> | null;
    };

    export abstract class BaseRepository<TModel> {
      constructor(protected readonly delegate: PrismaDelegate) {}

      /**
       * Convert a raw Prisma record into a domain model instance.
       * Subclasses MUST implement this method.
       */
      protected abstract toModel(record: any): TModel;

      // =========================================
      // Read
      // =========================================

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
       * Count records matching the given conditions.
       */
      async count(args?: Parameters<PrismaDelegate['count']>[0]): Promise<number> {
        return this.delegate.count(args);
      }

      /**
       * Check if a record matching the given conditions exists.
       */
      async exists(where: Record<string, any>): Promise<boolean> {
        const count = await this.delegate.count({ where });
        return count > 0;
      }

      // =========================================
      // Create
      // =========================================

      /**
       * Create a new record and return the domain model.
       */
      async create(args: Parameters<PrismaDelegate['create']>[0]): Promise<TModel> {
        const record = await this.delegate.create(args);
        return this.toModel(record);
      }

      /**
       * Create multiple records at once.
       * Returns the count of created records.
       */
      async createMany(args: Parameters<PrismaDelegate['createMany']>[0]): Promise<BatchResult> {
        return this.delegate.createMany(args);
      }

      // =========================================
      // Update
      // =========================================

      /**
       * Update an existing record and return the domain model.
       */
      async update(args: Parameters<PrismaDelegate['update']>[0]): Promise<TModel> {
        const record = await this.delegate.update(args);
        return this.toModel(record);
      }

      /**
       * Update multiple records matching the given conditions.
       * Returns the count of updated records.
       */
      async updateMany(args: Parameters<PrismaDelegate['updateMany']>[0]): Promise<BatchResult> {
        return this.delegate.updateMany(args);
      }

      /**
       * Create or update a record.
       */
      async upsert(args: Parameters<PrismaDelegate['upsert']>[0]): Promise<TModel> {
        const record = await this.delegate.upsert(args);
        return this.toModel(record);
      }

      // =========================================
      // Delete
      // =========================================

      /**
       * Delete a record and return the domain model of the deleted row.
       */
      async delete(args: Parameters<PrismaDelegate['delete']>[0]): Promise<TModel> {
        const record = await this.delegate.delete(args);
        return this.toModel(record);
      }

      /**
       * Delete multiple records matching the given conditions.
       * Returns the count of deleted records.
       */
      async deleteMany(args?: Parameters<PrismaDelegate['deleteMany']>[0]): Promise<BatchResult> {
        return this.delegate.deleteMany(args);
      }

      // =========================================
      // Aggregate
      // =========================================

      /**
       * Perform aggregate operations (count, sum, avg, min, max).
       */
      async aggregate(args: {
        where?: Record<string, any>;
        _count?: boolean | Record<string, boolean>;
        _sum?: Record<string, boolean>;
        _avg?: Record<string, boolean>;
        _min?: Record<string, boolean>;
        _max?: Record<string, boolean>;
      }): Promise<AggregateResult> {
        return this.delegate.aggregate(args);
      }

      // =========================================
      // Pagination
      // =========================================

      /**
       * Offset-based pagination.
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

      /**
       * Cursor-based pagination.
       * More efficient than offset pagination for large datasets.
       *
       * @param args.cursor - The cursor value (id of the last item from previous page)
       * @param args.take - Number of items to fetch
       * @param args.cursorField - The field to use as cursor (defaults to 'id')
       */
      protected async cursorPaginate(args: {
        cursor?: string | number;
        take: number;
        cursorField?: string;
        where?: Record<string, any>;
        orderBy?: Record<string, any>;
        include?: Record<string, any>;
      }): Promise<CursorPaginateResult<TModel>> {
        const { cursor, take, where, orderBy, include } = args;
        const cursorField = args.cursorField ?? 'id';

        const findArgs: any = {
          where,
          orderBy: orderBy ?? { [cursorField]: 'asc' },
          include,
          take: take + 1, // Fetch one extra to check hasMore
        };

        if (cursor !== undefined) {
          findArgs.cursor = { [cursorField]: cursor };
          findArgs.skip = 1; // Skip the cursor itself
        }

        const records = await this.delegate.findMany(findArgs);
        const hasMore = records.length > take;
        const data = hasMore ? records.slice(0, take) : records;

        const lastItem = data[data.length - 1];
        const nextCursor = hasMore && lastItem ? lastItem[cursorField] : null;

        return {
          data: data.map((record: any) => this.toModel(record)),
          nextCursor,
          hasMore,
        };
      }

      // =========================================
      // Transaction support
      // =========================================

      /**
       * Create a new repository instance that uses a transaction client.
       * Usage:
       *   await prisma.$transaction(async (tx) => {
       *     const txRepo = repo.withTransaction(tx.user);
       *     await txRepo.create({ data: { ... } });
       *     await txRepo.update({ ... });
       *   });
       */
      withTransaction(txDelegate: PrismaDelegate): this {
        const TransactionRepo = this.constructor as new (delegate: PrismaDelegate) => this;
        return new TransactionRepo(txDelegate);
      }
    }
  `;

  await writeFileSafely(`${outputPath}/BaseRepository.ts`, content);
  console.log("[Frourio Framework]Repository Generated: BaseRepository.ts");
}
