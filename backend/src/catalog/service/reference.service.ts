import { Injectable } from "@nestjs/common";
import { CatalogRepository } from "../repository/catalog.repository";
import {
  areaSchema,
  namedCatalogSchema,
  type ReferenceKind,
} from "../dto/catalog.dto";
import { CatalogInputValidator } from "../validator/catalog.validator";
@Injectable()
export class ReferenceService {
  constructor(private readonly repo: CatalogRepository) {}
  list(kind: ReferenceKind) {
    return this.repo.references(kind);
  }
  async save(
    kind: ReferenceKind,
    id: string | undefined,
    raw: unknown,
    actorId: string,
  ) {
    let values = raw;
    if (id) {
      const records = await this.repo.references(kind);
      const previous = records.find((r) => r.id === id);
      CatalogInputValidator.exists(previous, "Danh mục không tồn tại");
      if (raw && typeof raw === "object" && !Array.isArray(raw))
        values = { ...previous, ...raw };
    }
    const input =
      kind === "research-areas"
        ? CatalogInputValidator.parse(areaSchema, values)
        : CatalogInputValidator.parse(namedCatalogSchema, values);
    try {
      return await this.repo.saveReference(kind, id, input, actorId);
    } catch (error) {
      CatalogInputValidator.duplicate(error);
    }
  }
}
