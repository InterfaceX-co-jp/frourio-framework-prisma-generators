export type DtoFieldAnnotation = {
  hidden: boolean;
};

export type DtoProfile = {
  name: string;
  pick?: string[];
  omit?: string[];
};
