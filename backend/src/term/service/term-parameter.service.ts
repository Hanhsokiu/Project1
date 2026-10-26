import { Injectable, NotFoundException } from "@nestjs/common";
import { TermRepository } from "../repository/term.repository";
@Injectable()
export class TermParameterService {
  constructor(private readonly repository: TermRepository) {}
  async getParameters(termId: string) {
    const term = await this.repository.findById(termId);
    if (!term) throw new NotFoundException("Không tìm thấy đợt.");
    return term.parameters;
  }
}
