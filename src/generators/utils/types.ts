/**
 * Utility type to make all properties of an object deeply readonly
 * This replaces the ReadonlyDeep type that was removed from @prisma/generator-helper
 */
export type ReadonlyDeep<T> = {
  readonly [P in keyof T]: T[P] extends (infer U)[]
    ? ReadonlyArray<ReadonlyDeep<U>>
    : T[P] extends object
      ? ReadonlyDeep<T[P]>
      : T[P];
};
