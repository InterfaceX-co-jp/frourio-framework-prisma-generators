export type JsonObject = {
  foo: string;
  bar: number;
};

export type JsonArray = JsonObject[];

export type BankInfo = {
  accountNumber: string;
  bankName: string;
};

export type AnnotationType = {
  key: string;
  value: unknown;
};

export type SpecType = {
  specKey: string;
  specValue: unknown;
};
