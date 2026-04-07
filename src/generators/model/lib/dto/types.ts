export type DtoFieldAnnotation = {
  hidden: boolean;
  nested?: boolean;
};

export type DtoProfile = {
  name: string;
  pick?: string[];
  omit?: string[];
};
