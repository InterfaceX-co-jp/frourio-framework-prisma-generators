import { PrismaClient } from "@prisma/client";
import { JsonFieldModel } from "../../prisma/__generated__/model/JsonField.model";

export class JsonFieldRepository {
  private readonly _prisma: PrismaClient;

  async findById(args: { id: number }) {
    const jsonField = await this._prisma.jsonField.findUnique({
      where: { id: args.id },
    });

    if (!jsonField) {
      return null;
    }

    return JsonFieldModel.fromPrismaValue({ self: jsonField });
  }
}
