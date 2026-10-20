import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RegistrationService } from '../service/registration.service';
import { ApiResponse } from '../../common/dto/api-response.dto';

@ApiTags('registration')
@Controller('registrations')
export class RegistrationController {
  constructor(private readonly regService: RegistrationService) {}

  @Get('term/:termId')
  @ApiOperation({ summary: 'UC09: Danh sách đăng ký theo đợt' })
  async getByTerm(@Param('termId') termId: string) {
    const list = await this.regService.findByTerm(termId);
    return ApiResponse.ok(list);
  }
}
