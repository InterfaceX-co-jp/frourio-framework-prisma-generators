export type DtoFieldAnnotation = {
  hidden: boolean;
  nested?: boolean;
  hide?: boolean;
  map?: Record<string, string>;
};

export type DtoProfile = {
  name: string;
  pick?: string[];
  omit?: string[];
};
