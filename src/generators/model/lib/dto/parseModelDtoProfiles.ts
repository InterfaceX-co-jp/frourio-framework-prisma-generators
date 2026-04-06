import type { DMMF as PrismaDMMF } from "@prisma/generator-helper";
import type { ReadonlyDeep } from "../../../utils/types";
import type { DtoProfile } from "./types";

export const parseModelDtoProfiles = (args: {
  model: ReadonlyDeep<PrismaDMMF.Model>;
}): DtoProfile[] => {
  const documentation = args.model.documentation;

  if (!documentation) {
    return [];
  }

  const profileRegex =
    /@dto\.profile\(name:\s*(\w+),\s*(pick|omit):\s*\[([^\]]*)\]\)/g;

  const profiles: DtoProfile[] = [];
  const seenNames = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = profileRegex.exec(documentation)) !== null) {
    const name = match[1];
    const mode = match[2] as "pick" | "omit";
    const fields = match[3]
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    if (seenNames.has(name)) {
      console.warn(
        `[Frourio Framework] Duplicate @dto.profile name "${name}" on model "${args.model.name}". Skipping.`,
      );
      continue;
    }

    if (fields.length === 0) {
      console.warn(
        `[Frourio Framework] Empty ${mode} list in @dto.profile "${name}" on model "${args.model.name}". Skipping.`,
      );
      continue;
    }

    seenNames.add(name);

    const profile: DtoProfile = { name };
    if (mode === "pick") {
      profile.pick = fields;
    } else {
      profile.omit = fields;
    }

    profiles.push(profile);
  }

  return profiles;
};
